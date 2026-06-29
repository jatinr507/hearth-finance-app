// Disconnects a Plaid item: revokes it at Plaid, converts its accounts back to
// manual (preserving history by default), and deletes the stored access_token.
// POST body: { item_id: string, purge?: boolean }
//   purge=true also deletes the synced transactions for the item's accounts.
import { corsHeaders, json } from '../_shared/cors.ts'
import { getUser, serviceClient } from '../_shared/auth.ts'
import { plaidClient, plaidErrorInfo } from '../_shared/plaid.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const user = await getUser(req)
  if (!user) return json({ error: 'Unauthorized' }, 401)

  const { item_id, purge } = await req.json().catch(() => ({}))
  if (!item_id) return json({ error: 'Missing item_id' }, 400)

  const svc = serviceClient()

  // Look up the item (scoped to this user) to get its access_token + uuid.
  const { data: item } = await svc
    .from('plaid_items')
    .select('id, access_token')
    .eq('item_id', item_id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!item) return json({ error: 'Item not found' }, 404)

  // Revoke at Plaid first — if this fails, leave local state intact for retry.
  try {
    await plaidClient().itemRemove({ access_token: item.access_token })
  } catch (e) {
    console.error('itemRemove failed:', plaidErrorInfo(e))
    return json({ error: 'Failed to disconnect at Plaid' }, 502)
  }

  // Find this item's accounts.
  const { data: accts } = await svc
    .from('accounts')
    .select('id')
    .eq('plaid_item_id', item.id)
    .eq('user_id', user.id)
  const accountIds = (accts ?? []).map((a) => a.id)

  if (purge && accountIds.length > 0) {
    await svc
      .from('transactions')
      .delete()
      .eq('user_id', user.id)
      .in('account_id', accountIds)
  }

  // Convert accounts back to manual (keeps them + their history).
  if (accountIds.length > 0) {
    await svc
      .from('accounts')
      .update({ plaid_item_id: null, plaid_account_id: null, is_manual: true })
      .in('id', accountIds)
  }

  // Delete the item row (drops the stored access_token).
  await svc.from('plaid_items').delete().eq('id', item.id)

  return json({ ok: true, converted: accountIds.length, purged: Boolean(purge) })
})
