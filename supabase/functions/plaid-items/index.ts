// Returns the authenticated user's linked Plaid items WITHOUT the access_token,
// so the client can show connection health / reconnect prompts. The plaid_items
// table itself is unreadable by the client (RLS has no policies); this function
// is the only safe window onto it.
import { corsHeaders, json } from '../_shared/cors.ts'
import { getUser, serviceClient } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const user = await getUser(req)
  if (!user) return json({ error: 'Unauthorized' }, 401)

  const svc = serviceClient()
  const { data, error } = await svc
    .from('plaid_items')
    // Deliberately NOT selecting access_token.
    .select('id, item_id, institution_name, status, updated_at')
    .eq('user_id', user.id)

  if (error) {
    console.error('load items failed', error)
    return json({ error: 'Failed to load items' }, 500)
  }

  return json({ items: data ?? [] })
})
