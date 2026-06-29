// Pulls transactions and refreshes balances for the user's linked Plaid items.
// POST body (optional): { item_id?: string } — sync one item, else all.
//
// Uses Plaid's /transactions/sync cursor model for incremental, idempotent
// pulls. Investment/loan accounts are balance-only (transactions/sync simply
// returns no rows for them in this phase).
import { corsHeaders, json } from '../_shared/cors.ts'
import { getUser, serviceClient } from '../_shared/auth.ts'
import { plaidClient, accountBalance } from '../_shared/plaid.ts'
import { assignCategory, type CategoryRuleLike } from '../../../src/lib/categorize.ts'
import type { Transaction as PlaidTxn } from 'npm:plaid@27'

interface SyncSummary {
  item_id: string
  added: number
  modified: number
  removed: number
  status: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const user = await getUser(req)
  if (!user) return json({ error: 'Unauthorized' }, 401)

  const { item_id } = await req.json().catch(() => ({}))

  const plaid = plaidClient()
  const svc = serviceClient()

  // Load the items to sync.
  let itemQuery = svc.from('plaid_items').select('*').eq('user_id', user.id)
  if (item_id) itemQuery = itemQuery.eq('item_id', item_id)
  const { data: items, error: itemsErr } = await itemQuery
  if (itemsErr) {
    console.error('load items failed', itemsErr)
    return json({ error: 'Failed to load items' }, 500)
  }
  if (!items || items.length === 0) return json({ items: [] })

  // Category assignment context (shared with CSV import).
  const [{ data: rulesData }, { data: incomeCategory }] = await Promise.all([
    svc.from('category_rules').select('pattern, category_id').eq('user_id', user.id),
    svc.from('categories').select('id').eq('name', 'Income').eq('is_system', true).maybeSingle(),
  ])
  const rules: CategoryRuleLike[] = rulesData ?? []
  const incomeCategoryId: string | null = incomeCategory?.id ?? null

  const summaries: SyncSummary[] = []

  for (const item of items) {
    // Map this item's Plaid account ids -> our account ids.
    const { data: accts } = await svc
      .from('accounts')
      .select('id, plaid_account_id')
      .eq('plaid_item_id', item.id)
    const acctMap = new Map<string, string>(
      (accts ?? [])
        .filter((a) => a.plaid_account_id)
        .map((a) => [a.plaid_account_id as string, a.id]),
    )

    try {
      // ── Incremental transaction pull ──────────────────────────────────────
      let cursor: string | undefined = item.cursor ?? undefined
      let hasMore = true
      let added = 0
      let modified = 0
      let removed = 0

      while (hasMore) {
        const resp = await plaid.transactionsSync({
          access_token: item.access_token,
          cursor,
        })
        const d = resp.data

        const upserts = [...d.added, ...d.modified]
          .map((t) => toRow(t, user.id, acctMap, rules, incomeCategoryId))
          .filter((r): r is NonNullable<typeof r> => r !== null)

        if (upserts.length > 0) {
          const { error: upErr } = await svc
            .from('transactions')
            .upsert(upserts, { onConflict: 'user_id,plaid_transaction_id' })
          if (upErr) throw upErr
        }

        const removeIds = d.removed
          .map((r) => r.transaction_id)
          .filter((id): id is string => Boolean(id))
        if (removeIds.length > 0) {
          await svc
            .from('transactions')
            .delete()
            .eq('user_id', user.id)
            .in('plaid_transaction_id', removeIds)
        }

        added += d.added.length
        modified += d.modified.length
        removed += d.removed.length
        cursor = d.next_cursor
        hasMore = d.has_more
      }

      // Persist the advanced cursor and clear any prior error status.
      await svc
        .from('plaid_items')
        .update({ cursor, status: 'good', updated_at: new Date().toISOString() })
        .eq('id', item.id)

      // ── Balance refresh (all account types) ───────────────────────────────
      const balResp = await plaid.accountsBalanceGet({ access_token: item.access_token })
      for (const a of balResp.data.accounts) {
        const acctId = acctMap.get(a.account_id)
        if (acctId) {
          await svc
            .from('accounts')
            .update({ balance: accountBalance(a), updated_at: new Date().toISOString() })
            .eq('id', acctId)
        }
      }

      summaries.push({ item_id: item.item_id, added, modified, removed, status: 'good' })
    } catch (e) {
      const status = isLoginRequired(e) ? 'login_required' : 'error'
      await svc.from('plaid_items').update({ status }).eq('id', item.id)
      console.error(`sync failed for item ${item.item_id}`, e)
      summaries.push({ item_id: item.item_id, added: 0, modified: 0, removed: 0, status })
    }
  }

  return json({ items: summaries })
})

// Plaid amounts are positive when money leaves the account (debit/expense) and
// negative when money enters (credit/income). We store absolute amount + type.
function toRow(
  t: PlaidTxn,
  userId: string,
  acctMap: Map<string, string>,
  rules: CategoryRuleLike[],
  incomeCategoryId: string | null,
) {
  const accountId = acctMap.get(t.account_id)
  if (!accountId) return null // account we don't track (e.g. unmapped)

  const type: 'debit' | 'credit' = t.amount > 0 ? 'debit' : 'credit'
  const description = t.name ?? t.merchant_name ?? 'Transaction'

  return {
    user_id: userId,
    account_id: accountId,
    date: t.date, // YYYY-MM-DD
    description,
    amount: Math.abs(t.amount),
    category_id: assignCategory(description, type, rules, incomeCategoryId),
    source: 'plaid' as const,
    plaid_transaction_id: t.transaction_id,
    pending: t.pending ?? false,
    notes: null,
  }
}

// deno-lint-ignore no-explicit-any
function isLoginRequired(e: any): boolean {
  return e?.response?.data?.error_code === 'ITEM_LOGIN_REQUIRED'
}
