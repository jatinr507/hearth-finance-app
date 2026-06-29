import { supabase } from './supabase'
import type { PlaidItemStatus } from '@/types/database'

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

export interface SyncItemSummary {
  item_id: string
  added: number
  modified: number
  removed: number
  status: string
}

/** Sync transactions + balances. Omit `itemId` to sync all linked items. */
export async function syncTransactions(itemId?: string): Promise<SyncItemSummary[]> {
  const { data, error } = await supabase.functions.invoke('plaid-sync', {
    body: itemId ? { item_id: itemId } : {},
  })
  if (error) throw error
  return (data?.items ?? []) as SyncItemSummary[]
}

export interface PlaidItemSummary {
  id: string
  item_id: string
  institution_name: string | null
  status: PlaidItemStatus
  updated_at: string
}

/** List the user's linked items (no access_token) for connection-health UI. */
export async function getPlaidItems(): Promise<PlaidItemSummary[]> {
  const { data, error } = await supabase.functions.invoke('plaid-items', { body: {} })
  if (error) throw error
  return (data?.items ?? []) as PlaidItemSummary[]
}

/**
 * Disconnect a linked item. Revokes it at Plaid and converts its accounts back
 * to manual. With `purge`, also deletes the synced transactions.
 */
export async function disconnectItem(itemId: string, purge: boolean): Promise<void> {
  const { error } = await supabase.functions.invoke('plaid-remove', {
    body: { item_id: itemId, purge },
  })
  if (error) throw error
}
