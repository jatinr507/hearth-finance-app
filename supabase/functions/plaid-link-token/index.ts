// Creates a Plaid Link token for the authenticated user.
// POST body (optional): { item_id?: string } — when present, creates an
// update-mode link token to re-authenticate an existing Item (reconnect flow).
import { Products, CountryCode } from 'npm:plaid@27'
import { corsHeaders, json } from '../_shared/cors.ts'
import { getUser, serviceClient } from '../_shared/auth.ts'
import { plaidClient } from '../_shared/plaid.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const user = await getUser(req)
  if (!user) return json({ error: 'Unauthorized' }, 401)

  let itemId: string | undefined
  try {
    const body = await req.json().catch(() => ({}))
    itemId = body?.item_id
  } catch {
    // no body — fresh link
  }

  const plaid = plaidClient()

  // Update mode: re-auth an existing Item. Look up its access_token server-side.
  let accessToken: string | undefined
  if (itemId) {
    const svc = serviceClient()
    const { data: item } = await svc
      .from('plaid_items')
      .select('access_token')
      .eq('item_id', itemId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!item) return json({ error: 'Item not found' }, 404)
    accessToken = item.access_token
  }

  try {
    const resp = await plaid.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: 'Hearth Finance',
      language: 'en',
      country_codes: [CountryCode.Us],
      // update mode omits `products`
      products: accessToken ? [] : [Products.Transactions],
      access_token: accessToken,
    })
    return json({ link_token: resp.data.link_token })
  } catch (e) {
    console.error('linkTokenCreate failed', e)
    return json({ error: 'Failed to create link token' }, 500)
  }
})
