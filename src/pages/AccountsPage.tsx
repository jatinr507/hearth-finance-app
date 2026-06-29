import { useCallback, useEffect, useState } from 'react'
import { Plus, CreditCard, Building2, PiggyBank, TrendingUp, Trash2, Pencil, Link2, RefreshCw, AlertTriangle, Unlink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { syncTransactions, getPlaidItems, disconnectItem, type PlaidItemSummary } from '@/lib/plaid'
import { useAccounts } from '@/hooks/useAccounts'
import { usePlaidConnect } from '@/hooks/usePlaidConnect'
import type { User } from '@supabase/supabase-js'
import type { Account, AccountType } from '@/types/database'

interface AccountsPageProps {
  user: User
}

const ACCOUNT_ICONS: Record<AccountType, React.ReactNode> = {
  checking: <Building2 className="w-5 h-5" />,
  savings: <PiggyBank className="w-5 h-5" />,
  credit: <CreditCard className="w-5 h-5" />,
  investment: <TrendingUp className="w-5 h-5" />,
  loan: <CreditCard className="w-5 h-5" />,
}

const ACCOUNT_COLORS: Record<AccountType, string> = {
  checking:   'bg-tint-clay text-tint-clay-ink',
  savings:    'bg-tint-sage text-tint-sage-ink',
  credit:     'bg-sand text-ink-2',
  investment: 'bg-sand text-ink',
  loan:       'bg-sand text-rust',
}

const inputCls = 'w-full bg-sand border border-hairline rounded-sm px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-clay'
const selectCls = 'bg-sand border border-hairline rounded-sm px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-clay'

export function AccountsPage({ user }: AccountsPageProps) {
  const { accounts, loading, refetch } = useAccounts(user.id)
  const [items, setItems] = useState<PlaidItemSummary[]>([])

  const loadItems = useCallback(async () => {
    try {
      setItems(await getPlaidItems())
    } catch {
      // Non-fatal: connection-health UI just won't show.
    }
  }, [])

  const refreshAll = useCallback(async () => {
    await Promise.all([refetch(), loadItems()])
  }, [refetch, loadItems])

  const { link, reconnect, loading: linking, error: linkError } = usePlaidConnect({ onLinked: refreshAll })
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  // Item pending disconnect confirmation.
  const [disconnectTarget, setDisconnectTarget] = useState<PlaidItemSummary | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  async function handleDisconnect(purge: boolean) {
    if (!disconnectTarget) return
    setDisconnecting(true)
    try {
      await disconnectItem(disconnectTarget.item_id, purge)
      await refreshAll()
      setDisconnectTarget(null)
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : 'Failed to disconnect.')
    } finally {
      setDisconnecting(false)
    }
  }

  useEffect(() => { loadItems() }, [loadItems])

  const hasLinked = accounts.some((a) => !a.is_manual)
  // Map our account's plaid_item_id (uuid) -> the item's health + Plaid item_id.
  const itemById = new Map(items.map((i) => [i.id, i]))

  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const results = await syncTransactions()
      const added = results.reduce((n, r) => n + r.added, 0)
      const needsAuth = results.some((r) => r.status === 'login_required')
      await refreshAll()
      setSyncMsg(
        needsAuth
          ? 'Some accounts need reconnecting.'
          : `Synced — ${added} new transaction${added === 1 ? '' : 's'}.`,
      )
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : 'Sync failed.')
    } finally {
      setSyncing(false)
    }
  }
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', institution: '', type: 'checking' as AccountType, balance: '' })

  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', balance: '', type: 'checking' as AccountType })
  const [editSaving, setEditSaving] = useState(false)

  const netWorth = accounts.reduce((sum, a) => {
    return a.type === 'credit' || a.type === 'loan' ? sum - a.balance : sum + a.balance
  }, 0)

  async function handleAdd() {
    if (!form.name || !form.institution) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('accounts').insert({
      user_id: user.id,
      name: form.name,
      institution: form.institution,
      type: form.type,
      balance: parseFloat(form.balance) || 0,
    })
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setForm({ name: '', institution: '', type: 'checking', balance: '' })
    setShowForm(false)
    refetch()
  }

  async function handleDelete(id: string) {
    await supabase.from('accounts').delete().eq('id', id)
    refetch()
  }

  function handleStartEdit(acc: Account) {
    setEditingId(acc.id)
    setEditForm({ name: acc.name, balance: String(acc.balance), type: acc.type })
  }

  async function handleSaveEdit() {
    if (!editingId) return
    setEditSaving(true)
    await supabase
      .from('accounts')
      .update({
        name: editForm.name,
        balance: parseFloat(editForm.balance) || 0,
        type: editForm.type,
      })
      .eq('id', editingId)
    setEditingId(null)
    setEditSaving(false)
    refetch()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-clay border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="pb-24 lg:pb-10 px-4 lg:px-8 pt-6 lg:pt-8 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-ink">Accounts</h1>
        <div className="flex items-center gap-2">
          {hasLinked && (
            <Button size="sm" variant="secondary" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync now'}
            </Button>
          )}
          <Button size="sm" onClick={link} disabled={linking}>
            <Link2 className="w-4 h-4" />
            {linking ? 'Linking…' : 'Link a bank'}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
      </div>

      {linkError && (
        <p className="text-xs text-rust">{linkError}</p>
      )}
      {syncMsg && (
        <p className="text-xs text-muted">{syncMsg}</p>
      )}

      {/* Disconnect confirmation */}
      {disconnectTarget && (
        <Card className="space-y-3 border border-rust/30">
          <div className="flex items-start gap-2">
            <Unlink className="w-4 h-4 text-rust shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-ink">
                Disconnect {disconnectTarget.institution_name ?? 'this bank'}?
              </h2>
              <p className="text-xs text-muted mt-1">
                We'll revoke access at Plaid and delete the stored connection. Its accounts stay and
                become manual. Choose whether to keep the transactions already synced.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setDisconnectTarget(null)} disabled={disconnecting}>
              Cancel
            </Button>
            <Button onClick={() => handleDisconnect(false)} disabled={disconnecting}>
              {disconnecting ? 'Working…' : 'Keep transactions'}
            </Button>
            <button
              onClick={() => handleDisconnect(true)}
              disabled={disconnecting}
              className="text-xs text-rust hover:underline disabled:opacity-50 px-2"
            >
              Disconnect & delete transactions
            </button>
          </div>
        </Card>
      )}

      {/* Net worth hero card */}
      <Card className="bg-ink border-0 rounded-lg">
        <p className="text-on-ink-muted text-xs font-semibold uppercase tracking-widest">Total Net Worth</p>
        <p className="text-2xl font-bold mt-1 text-on-ink amount">{formatCurrency(netWorth)}</p>
      </Card>

      {/* Add account form */}
      {showForm && (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-ink-2">New Account</h2>
          <input
            placeholder="Account name (e.g. Chase Checking)"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className={inputCls}
          />
          <input
            placeholder="Institution (e.g. Chase)"
            value={form.institution}
            onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))}
            className={inputCls}
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AccountType }))}
              className={selectCls}
            >
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="credit">Credit Card</option>
              <option value="investment">Investment</option>
              <option value="loan">Loan</option>
            </select>
            <input
              type="number"
              placeholder="Balance"
              value={form.balance}
              onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))}
              className={inputCls}
            />
          </div>
          {error && <p className="text-xs text-rust">{error}</p>}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handleAdd} disabled={saving || !form.name}>
              {saving ? 'Saving…' : 'Add Account'}
            </Button>
          </div>
        </Card>
      )}

      {/* Account list */}
      {accounts.length === 0 ? (
        <div className="text-center py-12 text-muted">
          <p className="text-lg">No accounts yet</p>
          <p className="text-sm mt-1">Add an account to get started</p>
        </div>
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          {accounts.map((acc) => {
            const item = acc.plaid_item_id ? itemById.get(acc.plaid_item_id) : undefined
            const needsReconnect = Boolean(item && item.status !== 'good')
            return (
            <div key={acc.id} className="space-y-2">
              <Card className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${ACCOUNT_COLORS[acc.type]}`}>
                  {ACCOUNT_ICONS[acc.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-ink truncate">{acc.name}</p>
                    {!acc.is_manual && needsReconnect && (
                      <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold bg-tint-clay text-rust px-1.5 py-0.5 rounded-pill">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        Reconnect
                      </span>
                    )}
                    {!acc.is_manual && !needsReconnect && (
                      <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold bg-tint-sage text-tint-sage-ink px-1.5 py-0.5 rounded-pill">
                        <Link2 className="w-2.5 h-2.5" />
                        Synced
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted capitalize">{acc.institution} · {acc.type}</p>
                </div>
                <p className={`text-sm font-semibold amount ${acc.type === 'credit' || acc.type === 'loan' ? 'text-rust' : 'text-ink'}`}>
                  {formatCurrency(acc.balance)}
                </p>
                {needsReconnect && item && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => reconnect(item.item_id)}
                    disabled={linking}
                  >
                    Reconnect
                  </Button>
                )}
                {!acc.is_manual && item && (
                  <button
                    onClick={() => setDisconnectTarget(item)}
                    title="Disconnect bank"
                    className="text-muted/60 hover:text-rust transition-colors p-1"
                  >
                    <Unlink className="w-4 h-4" />
                  </button>
                )}
                {acc.is_manual && (
                  <>
                    <button
                      onClick={() => handleStartEdit(acc)}
                      className="text-muted/60 hover:text-clay transition-colors p-1"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(acc.id)}
                      className="text-muted/60 hover:text-rust transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </Card>

              {editingId === acc.id && (
                <Card className="space-y-3">
                  <h2 className="text-sm font-semibold text-ink-2">Edit Account</h2>
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Account name"
                    className={inputCls}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={editForm.type}
                      onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value as AccountType }))}
                      className={selectCls}
                    >
                      <option value="checking">Checking</option>
                      <option value="savings">Savings</option>
                      <option value="credit">Credit Card</option>
                      <option value="investment">Investment</option>
                      <option value="loan">Loan</option>
                    </select>
                    <input
                      type="number"
                      value={editForm.balance}
                      onChange={(e) => setEditForm((f) => ({ ...f, balance: e.target.value }))}
                      placeholder="Balance"
                      className={inputCls}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                    <Button className="flex-1" onClick={handleSaveEdit} disabled={editSaving || !editForm.name}>
                      {editSaving ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                </Card>
              )}
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
