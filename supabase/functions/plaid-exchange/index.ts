// Exchanges a Plaid public_token for an access_token, stores it server-side,
// and upserts one app account per Plaid account.
// POST body: { public_token: string }
import { CountryCode } from 'npm:plaid@27'
import { corsHeaders, json } from '../_shared/cors.ts'
import { getUser, serviceClient } from '../_shared/auth.ts'
import {
  plaidClient,
  mapAccountType,
  accountBalance,
} from '../_shared/plaid.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const user = await getUser(req)
  if (!user) return json({ error: 'Unauthorized' }, 401)

  const { public_token } = await req.json().catch(() => ({}))
  if (!public_token) return json({ error: 'Missing public_token' }, 400)

  const plaid = plaidClient()
  const svc = serviceClient()

  try {
    // Exchange the short-lived public token for a long-lived access token.
    const exchange = await plaid.itemPublicTokenExchange({ public_token })
    const accessToken = exchange.data.access_token
    const plaidItemId = exchange.data.item_id

    // Resolve institution name (best-effort).
    let institutionName: string | null = null
    const itemResp = await plaid.itemGet({ access_token: accessToken })
    const institutionId = itemResp.data.item.institution_id
    if (institutionId) {
      const inst = await plaid.institutionsGetById({
        institution_id: institutionId,
        country_codes: [CountryCode.Us],
      })
      institutionName = inst.data.institution.name
    }

    // Pull accounts BEFORE persisting the item, so a failure here doesn't leave
    // an orphaned plaid_items row (holding a live access_token, zero accounts).
    const acctResp = await plaid.accountsGet({ access_token: accessToken })

    // Store the item (access_token never leaves the server).
    const { data: itemRow, error: itemErr } = await svc
      .from('plaid_items')
      .insert({
        user_id: user.id,
        item_id: plaidItemId,
        access_token: accessToken,
        institution_name: institutionName,
        cursor: null,
        status: 'good',
      })
      .select('id')
      .single()
    if (itemErr || !itemRow) {
      console.error('insert plaid_item failed', itemErr)
      return json({ error: 'Failed to store item' }, 500)
    }

    const institution = institutionName ?? 'Bank'

    // Re-attach support: Plaid issues fresh account_ids per Item, so re-linking a
    // previously-disconnected bank can't match on plaid_account_id. Instead, match
    // orphaned accounts (those a prior disconnect-keep converted to manual) by their
    // natural key — (name, type, institution) — and reuse the row so we don't create
    // a duplicate. Only accounts with no live link (plaid_item_id IS NULL) are eligible.
    const { data: orphans } = await svc
      .from('accounts')
      .select('id, name, type, institution')
      .eq('user_id', user.id)
      .is('plaid_item_id', null)
    const orphanByKey = new Map<string, string>(
      (orphans ?? []).map((o) => [`${o.institution}|${o.name}|${o.type}`, o.id]),
    )
    const usedOrphanIds = new Set<string>()

    const inserts: Record<string, unknown>[] = []
    const reattached: { id: string; name: string; type: string; balance: number }[] = []

    for (const a of acctResp.data.accounts) {
      const type = mapAccountType(a)
      const balance = accountBalance(a)
      const key = `${institution}|${a.name}|${type}`
      const orphanId = orphanByKey.get(key)

      if (orphanId && !usedOrphanIds.has(orphanId)) {
        usedOrphanIds.add(orphanId)
        // Reuse the existing row; clear its stale Plaid transactions so the next
        // sync repopulates them fresh (the new Item has new plaid_transaction_ids).
        const { error: updErr } = await svc
          .from('accounts')
          .update({
            type,
            institution,
            balance,
            plaid_item_id: itemRow.id,
            plaid_account_id: a.account_id,
            is_manual: false,
          })
          .eq('id', orphanId)
        if (updErr) {
          console.error('re-attach account failed', updErr)
          await svc.from('plaid_items').delete().eq('id', itemRow.id)
          return json({ error: 'Failed to store accounts' }, 500)
        }
        await svc
          .from('transactions')
          .delete()
          .eq('user_id', user.id)
          .eq('account_id', orphanId)
          .eq('source', 'plaid')
        reattached.push({ id: orphanId, name: a.name, type, balance })
      } else {
        inserts.push({
          user_id: user.id,
          name: a.name,
          type,
          institution,
          balance,
          plaid_item_id: itemRow.id,
          plaid_account_id: a.account_id,
          is_manual: false,
        })
      }
    }

    let inserted: { id: string; name: string; type: string; balance: number }[] = []
    if (inserts.length > 0) {
      const { data: up, error: upErr } = await svc
        .from('accounts')
        .upsert(inserts, { onConflict: 'user_id,plaid_account_id' })
        .select('id, name, type, balance')
      if (upErr) {
        // Roll back the item so the user can cleanly retry.
        console.error('upsert accounts failed', upErr)
        await svc.from('plaid_items').delete().eq('id', itemRow.id)
        return json({ error: 'Failed to store accounts' }, 500)
      }
      inserted = up ?? []
    }

    return json({
      item_id: plaidItemId,
      institution: institutionName,
      accounts: [...reattached, ...inserted],
    })
  } catch (e) {
    console.error('exchange failed', e)
    return json({ error: 'Failed to link account' }, 500)
  }
})
