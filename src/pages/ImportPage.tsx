import { useState, useRef, useCallback } from 'react'
import { Upload, CheckCircle, AlertCircle, ChevronDown, AlertTriangle, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  getHeaders,
  autoDetectMapping,
  parseWithMapping,
  type ColumnMapping,
  type ParsedTransaction,
  type ParseResult,
} from '@/lib/csvParsers'
import { supabase } from '@/lib/supabase'
import { assignCategory } from '@/lib/categorize'
import { directionFromType } from '@/lib/txnDirection'
import { useAccounts } from '@/hooks/useAccounts'
import type { User } from '@supabase/supabase-js'
import type { AccountType, CategoryRule } from '@/types/database'

interface ImportPageProps {
  user: User
}

type ImportStep = 'upload' | 'map' | 'preview' | 'success'

const selectCls =
  'w-full appearance-none bg-sand border border-hairline rounded-sm px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-clay pr-8'
const inputCls =
  'w-full bg-sand border border-hairline rounded-sm px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-clay'
const inputLabelCls = 'text-xs font-semibold text-ink-2 block mb-1'

function ColSelect({
  label,
  value,
  headers,
  onChange,
  placeholder = '— none —',
}: {
  label: string
  value: string
  headers: string[]
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className={inputLabelCls}>{label}</label>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
          <option value="">{placeholder}</option>
          {headers.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
      </div>
    </div>
  )
}

function dupKey(t: { date: string; description: string; amount: number }) {
  return `${t.date}|${t.description}|${t.amount}`
}

export function ImportPage({ user }: ImportPageProps) {
  const { accounts, refetch: refetchAccounts } = useAccounts(user.id)
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<ImportStep>('upload')
  const [accountId, setAccountId] = useState('')
  const [rawCsv, setRawCsv] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: '',
    description: '',
    amountMode: 'single',
    amount: '',
  })
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [duplicateKeys, setDuplicateKeys] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState(0)

  // Inline account creation state
  const [showNewAccount, setShowNewAccount] = useState(false)
  const [newAccount, setNewAccount] = useState({ name: '', institution: '', type: 'checking' as AccountType })
  const [creatingAccount, setCreatingAccount] = useState(false)

  function handleFile(file: File) {
    setError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const csv = e.target?.result as string
        const hdrs = getHeaders(csv)
        if (hdrs.length === 0) {
          setError('Could not read CSV headers. Make sure the file is a valid CSV.')
          return
        }
        setRawCsv(csv)
        setHeaders(hdrs)
        setMapping(autoDetectMapping(hdrs))
        setStep('map')
      } catch {
        setError('Failed to read file. Make sure it is a valid CSV.')
      }
    }
    reader.readAsText(file)
  }

  const sampleRows = useCallback((): ParsedTransaction[] => {
    try {
      return parseWithMapping(rawCsv, mapping).transactions.slice(0, 3)
    } catch {
      return []
    }
  }, [rawCsv, mapping])

  async function handleCreateAccount() {
    if (!newAccount.name || !newAccount.institution) return
    setCreatingAccount(true)
    const { data, error: err } = await supabase
      .from('accounts')
      .insert({
        user_id: user.id,
        name: newAccount.name,
        institution: newAccount.institution,
        type: newAccount.type,
        balance: 0,
      })
      .select()
      .single()
    setCreatingAccount(false)
    if (err) { setError(err.message); return }
    if (!data) { setError('Failed to create account'); return }
    await refetchAccounts()
    setAccountId(data.id)
    await loadDuplicates(data.id)
    setShowNewAccount(false)
    setNewAccount({ name: '', institution: '', type: 'checking' })
  }

  async function handleAdvanceToPreview() {
    if (!mapping.date) { setError('Please map a Date column.'); return }
    if (!mapping.description) { setError('Please map a Description column.'); return }
    if (mapping.amountMode === 'single' && !mapping.amount) { setError('Please map an Amount column.'); return }
    if (mapping.amountMode === 'split' && (!mapping.debit || !mapping.credit)) {
      setError('Please map both Debit and Credit columns.'); return
    }
    setError(null)
    const result = parseWithMapping(rawCsv, mapping)
    setParseResult(result)
    // If account already selected (e.g. user pressed Back), reload duplicates immediately
    if (accountId) {
      await loadDuplicates(accountId)
    } else {
      setDuplicateKeys(new Set())
    }
    setStep('preview')
  }

  // Called when accountId changes on the preview step — refresh duplicate set
  async function loadDuplicates(accId: string) {
    if (!accId) { setDuplicateKeys(new Set()); return }
    const { data } = await supabase
      .from('transactions')
      .select('date, description, amount')
      .eq('account_id', accId)
      .eq('user_id', user.id)
    setDuplicateKeys(new Set((data ?? []).map(dupKey)))
  }

  async function handleImport() {
    if (!parseResult || !accountId) { setError('Please select or create an account first.'); return }
    setImporting(true)
    setError(null)

    const [{ data: rulesData }, { data: incomeCategory }] = await Promise.all([
      supabase.from('category_rules').select('*').eq('user_id', user.id),
      supabase.from('categories').select('id').eq('name', 'Income').eq('is_system', true).maybeSingle(),
    ])
    const rules: CategoryRule[] = rulesData ?? []
    const incomeCategoryId: string | null = incomeCategory?.id ?? null

    const newRows = parseResult.transactions
      .filter((t) => !duplicateKeys.has(dupKey(t)))
      .map((t) => {
        const category_id = assignCategory(t.description, t.type, rules, incomeCategoryId)
        return {
          user_id: user.id,
          account_id: accountId,
          date: t.date,
          description: t.description,
          amount: t.amount,
          category_id,
          source: 'csv' as const,
          direction: directionFromType(t.type),
          notes: null,
        }
      })

    let count = 0
    for (let i = 0; i < newRows.length; i += 100) {
      const { error: err, data } = await supabase
        .from('transactions')
        .upsert(newRows.slice(i, i + 100), {
          onConflict: 'user_id,account_id,date,description,amount',
        })
        .select()
      if (err) {
        setError(err.message)
        setImporting(false)
        return
      }
      count += data?.length ?? 0
    }

    setImportedCount(count)
    setImporting(false)
    setStep('success')
  }

  function reset() {
    setStep('upload')
    setRawCsv('')
    setHeaders([])
    setMapping({ date: '', description: '', amountMode: 'single', amount: '' })
    setParseResult(null)
    setDuplicateKeys(new Set())
    setAccountId('')
    setError(null)
    setShowNewAccount(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── Step: Success ──────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center space-y-4">
        <CheckCircle className="w-16 h-16 text-sage" />
        <h2 className="text-xl font-bold text-ink">Import Complete</h2>
        <p className="text-muted">{importedCount} new transactions imported</p>
        <Button onClick={reset} variant="secondary">
          Import Another File
        </Button>
      </div>
    )
  }

  // ── Step: Preview ──────────────────────────────────────────────────────────
  if (step === 'preview' && parseResult) {
    const newTx = parseResult.transactions.filter((t) => !duplicateKeys.has(dupKey(t)))
    const dupTx = parseResult.transactions.filter((t) => duplicateKeys.has(dupKey(t)))

    return (
      <div className="pb-24 lg:pb-10 px-4 lg:px-8 space-y-4 pt-6 lg:pt-8 max-w-3xl mx-auto">
        <h1 className="text-xl font-bold text-ink">Review Import</h1>

        {/* Account selection — at the bottom of the flow, right before importing */}
        <Card className="space-y-3">
          <div>
            <label className="text-sm font-semibold text-ink-2 block mb-1">Which account are these transactions from?</label>
            <p className="text-xs text-muted mb-2">Used to organise your transactions. You can create a new account here if needed.</p>
            <div className="relative">
              <select
                value={accountId}
                onChange={(e) => {
                  setAccountId(e.target.value)
                  loadDuplicates(e.target.value)
                }}
                className={selectCls}
              >
                <option value="">Select account…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {a.institution}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
            </div>
          </div>

          {!showNewAccount ? (
            <button
              onClick={() => setShowNewAccount(true)}
              className="flex items-center gap-1.5 text-xs text-clay font-medium hover:text-rust transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Create new account
            </button>
          ) : (
            <div className="border-t border-hairline pt-3 space-y-3">
              <p className="text-xs font-semibold text-ink-2">New account</p>
              <input
                placeholder="Account name (e.g. 360 Checking)"
                value={newAccount.name}
                onChange={(e) => setNewAccount((a) => ({ ...a, name: e.target.value }))}
                className={inputCls}
              />
              <input
                placeholder="Institution (e.g. Capital One)"
                value={newAccount.institution}
                onChange={(e) => setNewAccount((a) => ({ ...a, institution: e.target.value }))}
                className={inputCls}
              />
              <div className="relative">
                <select
                  value={newAccount.type}
                  onChange={(e) => setNewAccount((a) => ({ ...a, type: e.target.value as AccountType }))}
                  className={selectCls}
                >
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                  <option value="credit">Credit Card</option>
                  <option value="investment">Investment</option>
                  <option value="loan">Loan</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setShowNewAccount(false)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={creatingAccount || !newAccount.name || !newAccount.institution}
                  onClick={handleCreateAccount}
                >
                  {creatingAccount ? 'Creating…' : 'Create account'}
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Summary badges */}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="bg-tint-sage text-sage px-2.5 py-1 rounded-pill font-semibold">
            {newTx.length} new
          </span>
          {dupTx.length > 0 && (
            <span className="bg-sand text-ink-2 px-2.5 py-1 rounded-pill">
              {dupTx.length} already imported
            </span>
          )}
          {parseResult.skippedCount > 0 && (
            <span className="bg-tint-clay text-rust px-2.5 py-1 rounded-pill">
              {parseResult.skippedCount} skipped
            </span>
          )}
        </div>

        {/* Skipped rows detail */}
        {parseResult.skippedCount > 0 && (
          <div className="flex items-start gap-2 text-rust bg-tint-clay/50 rounded-sm px-4 py-3 text-xs border border-rust/20">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">{parseResult.skippedCount} rows skipped:</p>
              <ul className="space-y-0.5">
                {parseResult.skippedReasons.slice(0, 5).map((r) => (
                  <li key={r.row}>
                    Row {r.row}: {r.reason}
                  </li>
                ))}
                {parseResult.skippedReasons.length > 5 && (
                  <li>+{parseResult.skippedReasons.length - 5} more…</li>
                )}
              </ul>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-rust bg-tint-clay/50 rounded-sm px-4 py-3 text-sm border border-rust/20">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Transaction list */}
        <Card className="p-0 overflow-hidden">
          <div className="divide-y divide-hairline">
            {parseResult.transactions.slice(0, 30).map((t, i) => {
              const isDup = duplicateKeys.has(dupKey(t))
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-4 py-3 ${isDup ? 'opacity-40' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{t.description || '—'}</p>
                    <p className="text-xs text-muted">{formatDate(t.date)}</p>
                  </div>
                  {isDup && (
                    <span className="text-xs bg-sand text-ink-2 px-2 py-0.5 rounded-pill shrink-0">
                      imported
                    </span>
                  )}
                  <span
                    className={`text-sm font-semibold amount ${t.type === 'credit' ? 'text-sage' : 'text-ink'}`}
                  >
                    {t.type === 'credit' ? '+' : '−'}
                    {formatCurrency(t.amount)}
                  </span>
                </div>
              )
            })}
            {parseResult.transactions.length > 30 && (
              <div className="px-4 py-3 text-center text-xs text-muted">
                +{parseResult.transactions.length - 30} more transactions
              </div>
            )}
          </div>
        </Card>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setStep('map')} className="flex-1">
            Back
          </Button>
          <Button
            onClick={handleImport}
            disabled={importing || newTx.length === 0 || !accountId}
            className="flex-1"
          >
            {importing ? 'Importing…' : `Import ${newTx.length} transactions`}
          </Button>
        </div>
      </div>
    )
  }

  // ── Step: Map Columns ──────────────────────────────────────────────────────
  if (step === 'map') {
    const samples = sampleRows()
    return (
      <div className="pb-24 lg:pb-10 px-4 lg:px-8 space-y-4 pt-6 lg:pt-8 max-w-3xl mx-auto">
        <h1 className="text-xl font-bold text-ink">Map Columns</h1>
        <p className="text-sm text-muted">
          We auto-detected the column mapping below. Adjust if anything looks off.
        </p>

        <Card className="space-y-4">
          <ColSelect
            label="Date column"
            value={mapping.date}
            headers={headers}
            onChange={(v) => setMapping((m) => ({ ...m, date: v }))}
          />
          <ColSelect
            label="Description column"
            value={mapping.description}
            headers={headers}
            onChange={(v) => setMapping((m) => ({ ...m, description: v }))}
          />

          <div>
            <label className={inputLabelCls}>Amount style</label>
            <div className="flex gap-3">
              {(['single', 'split'] as const).map((mode) => (
                <label key={mode} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="amountMode"
                    checked={mapping.amountMode === mode}
                    onChange={() =>
                      setMapping((m) => ({ ...m, amountMode: mode, amount: '', debit: '', credit: '', typeColumn: undefined }))
                    }
                    className="accent-clay"
                  />
                  <span className="text-sm text-ink">
                    {mode === 'single' ? 'Single column (signed ±)' : 'Separate Debit / Credit'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {mapping.amountMode === 'single' ? (
            <div className="space-y-3">
              <ColSelect
                label="Amount column"
                value={mapping.amount ?? ''}
                headers={headers}
                onChange={(v) => setMapping((m) => ({ ...m, amount: v }))}
              />
              <ColSelect
                label="Debit/Credit type column (optional)"
                value={mapping.typeColumn ?? ''}
                headers={headers}
                onChange={(v) => setMapping((m) => ({ ...m, typeColumn: v || undefined }))}
                placeholder="— not needed if amount is signed —"
              />
              {mapping.typeColumn && (
                <p className="text-xs text-muted -mt-1">
                  Used when amounts are always positive and a separate column says "Debit" or "Credit".
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <ColSelect
                label="Debit column"
                value={mapping.debit ?? ''}
                headers={headers}
                onChange={(v) => setMapping((m) => ({ ...m, debit: v }))}
              />
              <ColSelect
                label="Credit column"
                value={mapping.credit ?? ''}
                headers={headers}
                onChange={(v) => setMapping((m) => ({ ...m, credit: v }))}
              />
            </div>
          )}
        </Card>

        {/* Sample preview */}
        {samples.length > 0 && (
          <Card className="p-0 overflow-hidden">
            <p className="text-xs font-semibold text-ink-2 px-4 pt-3 pb-2">Preview (first 3 rows)</p>
            <div className="divide-y divide-hairline">
              {samples.map((t, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{t.description || '—'}</p>
                    <p className="text-xs text-muted">{t.date}</p>
                  </div>
                  <span
                    className={`text-sm font-semibold amount ${t.type === 'credit' ? 'text-sage' : 'text-ink'}`}
                  >
                    {t.type === 'credit' ? '+' : '−'}
                    {formatCurrency(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {error && (
          <div className="flex items-center gap-2 text-rust bg-tint-clay/50 rounded-sm px-4 py-3 text-sm border border-rust/20">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" onClick={reset} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleAdvanceToPreview} className="flex-1">
            Continue
          </Button>
        </div>
      </div>
    )
  }

  // ── Step: Upload ───────────────────────────────────────────────────────────
  return (
    <div className="pb-24 lg:pb-10 px-4 lg:px-8 pt-6 lg:pt-8 space-y-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-ink">Import Transactions</h1>
      <p className="text-sm text-muted">
        Upload any CSV export — bank statements, credit card statements, brokerage exports, or 401k
        statements. We'll detect the columns automatically.
      </p>

      {/* Drop zone */}
      <label
        className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-clay/30 rounded-md bg-tint-clay py-12 px-6 cursor-pointer hover:bg-tint-clay/70 transition-colors"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const file = e.dataTransfer.files[0]
          if (file) handleFile(file)
        }}
      >
        <Upload className="w-8 h-8 text-clay" />
        <div className="text-center">
          <p className="text-sm font-semibold text-clay">Tap to select CSV file</p>
          <p className="text-xs text-clay/70 mt-1">or drag and drop</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
          }}
        />
      </label>

      {error && (
        <div className="flex items-center gap-2 text-rust bg-tint-clay/50 rounded-sm px-4 py-3 text-sm border border-rust/20">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <Card>
        <h3 className="text-sm font-semibold text-ink-2 mb-2">Supported formats</h3>
        <p className="text-xs text-muted leading-relaxed">
          Any CSV with at least a date column, a description column, and an amount column (signed or
          separate debit/credit). Works with bank statements, credit card statements, brokerage
          exports, 401k exports, and custom date-range downloads.
        </p>
      </Card>
    </div>
  )
}
