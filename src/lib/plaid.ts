import { supabase } from './supabase'

// Thin client wrappers over the Plaid Edge Functions. supabase.functions.invoke
// auto-attaches the user's auth JWT. The browser only ever handles short-lived
// link/public tokens — never the Plaid access_token.

export interface LinkedAccountSummary {
  id: string
  name: string
  type: string
  balance: number
}

export interface ExchangeResult {
  item_id: string
  institution: string | null
  accounts: LinkedAccountSummary[]
}

/** Create a Plaid Link token. Pass `itemId` for update-mode (reconnect). */
export async function createLinkToken(itemId?: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('plaid-link-token', {
    body: itemId ? { item_id: itemId } : {},
  })
  if (error) throw error
  if (!data?.link_token) throw new Error('No link token returned')
  return data.link_token as string
}

/** Exchange a public token from Plaid Link for stored credentials + accounts. */
export async function exchangePublicToken(
  publicToken: string,
): Promise<ExchangeResult> {
  const { data, error } = await supabase.functions.invoke('plaid-exchange', {
    body: { public_token: publicToken },
  })
  if (error) throw error
  return data as ExchangeResult
}
