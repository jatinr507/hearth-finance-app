import { useState, useRef } from 'react'
import { Upload, CheckCircle, AlertCircle, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { formatCurrency, formatDate } from '@/lib/utils'
import { parseCSV, detectBank, type SupportedBank, type ParsedTransaction } from '@/lib/csvParsers'
import { supabase } from '@/lib/supabase'
import { useAccounts } from '@/hooks/useAccounts'
import type { User } from '@supabase/supabase-js'
import type { CategoryRule } from '@/types/database'

interface ImportPageProps {
  user: User
}

type ImportStep = 'upload' | 'preview' | 'success'

const selectCls = 'w-full appearance-none bg-sand border border-hairline rounded-sm px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-clay pr-8'

export function ImportPage({ user }: ImportPageProps) {
  const { accounts } = useAccounts(user.id)
  const [step, setStep] = useState<ImportStep>('upload')
  const [parsed, setParsed] = useState<ParsedTransaction[]>([])
  const [bank, setBank] = useState<SupportedBank | ''>('')
  const [accountId, setAccountId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    setError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const csv = e.target?.result as string
        const detectedBank = detectBank(csv)
        const selectedBank = (bank as SupportedBank) || detectedBank
        if (!selectedBank) {
          setError('Could not detect bank format. Please select your bank manually.')
          return
        }
        setBank(selectedBank)
        const rows = parseCSV(csv, selectedBank)
        setParsed(rows)
        setStep('preview')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse CSV')
      }
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!accountId) {
      setError('Please select an account')
      return
    }
    setImporting(true)
    setError(null)

    const baseRows = parsed.map((t) => ({
      user_id: user.id,
      account_id: accountId,
      date: t.date,
      description: t.description,
      amount: t.amount,
      category_id: null as string | null,
      source: 'csv' as const,
      notes: null,
    }))

    const { data: rulesData } = await supabase
      .from('category_rules')
      .select('*')
      .eq('user_id', user.id)
    const rules: CategoryRule[] = rulesData ?? []

    const rows = baseRows.map((row) => {
      const match = rules.find((r) =>
        row.description.toLowerCase().includes(r.pattern.toLowerCase())
      )
      return { ...row, category_id: match?.category_id ?? null }
    })

    let count = 0
    for (let i = 0; i < rows.length; i += 100) {
      const { error: err, data } = await supabase
        .from('transactions')
        .upsert(rows.slice(i, i + 100), { onConflict: 'user_id,account_id,date,description,amount' })
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
    setParsed([])
    setBank('')
    setAccountId('')
    setError(null)
    setStep('upload')
    if (fileRef.current) fileRef.current.value = ''
  }

  if (step === 'success') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center space-y-4">
        <CheckCircle className="w-16 h-16 text-sage" />
        <h2 className="text-xl font-bold text-ink">Import Complete</h2>
        <p className="text-muted">{importedCount} new transactions imported</p>
        <Button onClick={reset} variant="secondary">Import Another File</Button>
      </div>
    )
  }

  if (step === 'preview') {
    return (
      <div className="pb-24 lg:pb-10 px-4 lg:px-8 space-y-4 pt-6 lg:pt-8 max-w-3xl mx-auto">
        <h1 className="text-xl font-bold text-ink">Review Import</h1>

        <Card>
          <label className="text-sm font-semibold text-ink-2 block mb-2">Import to account</label>
          <div className="relative">
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className={selectCls}
            >
              <option value="">Select account…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name} — {a.institution}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          </div>
          {accounts.length === 0 && (
            <p className="text-xs text-clay mt-2">No accounts yet — add one in the Accounts tab first.</p>
          )}
        </Card>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">{parsed.length} transactions detected</p>
          <span className="text-xs bg-tint-clay text-tint-clay-ink px-2.5 py-1 rounded-pill capitalize">{bank?.replace('_', ' ')}</span>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-rust bg-tint-clay/50 rounded-sm px-4 py-3 text-sm border border-rust/20">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <Card className="p-0 overflow-hidden">
          <div className="divide-y divide-hairline">
            {parsed.slice(0, 20).map((t, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{t.description}</p>
                  <p className="text-xs text-muted">{formatDate(t.date)}</p>
                </div>
                <span className={`text-sm font-semibold amount ${t.type === 'credit' ? 'text-sage' : 'text-ink'}`}>
                  {t.type === 'credit' ? '+' : '−'}{formatCurrency(t.amount)}
                </span>
              </div>
            ))}
            {parsed.length > 20 && (
              <div className="px-4 py-3 text-center text-xs text-muted">
                +{parsed.length - 20} more transactions
              </div>
            )}
          </div>
        </Card>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={reset} className="flex-1">Cancel</Button>
          <Button onClick={handleImport} disabled={importing || !accountId} className="flex-1">
            {importing ? 'Importing…' : `Import ${parsed.length} transactions`}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-24 lg:pb-10 px-4 lg:px-8 pt-6 lg:pt-8 space-y-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-ink">Import Transactions</h1>
      <p className="text-sm text-muted">Upload a CSV export from Chase, Capital One, or PNC.</p>

      <Card>
        <label className="text-sm font-semibold text-ink-2 block mb-2">Bank (optional — auto-detected)</label>
        <div className="relative">
          <select
            value={bank}
            onChange={(e) => setBank(e.target.value as SupportedBank | '')}
            className={selectCls}
          >
            <option value="">Auto-detect</option>
            <option value="chase">Chase</option>
            <option value="capital_one">Capital One</option>
            <option value="pnc">PNC</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
        </div>
      </Card>

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
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
      </label>

      {error && (
        <div className="flex items-center gap-2 text-rust bg-tint-clay/50 rounded-sm px-4 py-3 text-sm border border-rust/20">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <Card>
        <h3 className="text-sm font-semibold text-ink-2 mb-3">How to export your CSV</h3>
        <div className="space-y-3 text-xs text-muted">
          <div>
            <p className="font-semibold text-ink-2">Chase</p>
            <p>Log in → Account → Download Account Activity → CSV</p>
          </div>
          <div>
            <p className="font-semibold text-ink-2">Capital One</p>
            <p>Log in → Account → Download → CSV</p>
          </div>
          <div>
            <p className="font-semibold text-ink-2">PNC</p>
            <p>Log in → Activity → Download → Spreadsheet (CSV)</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
