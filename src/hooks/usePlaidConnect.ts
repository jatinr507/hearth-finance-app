import { useCallback, useEffect, useRef, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { createLinkToken, exchangePublicToken, syncTransactions } from '@/lib/plaid'

interface UsePlaidConnectOptions {
  /** Called after a successful link + exchange (e.g. to refetch accounts). */
  onLinked?: () => void | Promise<void>
}

// Drives the Plaid Link flow: fetch a link token, open Link, then exchange the
// public token server-side. Supports both fresh links and update-mode reconnect.
export function usePlaidConnect({ onLinked }: UsePlaidConnectOptions = {}) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The Plaid item_id when this is a reconnect (update mode); null for a fresh link.
  const reconnectItemId = useRef<string | null>(null)

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (publicToken) => {
      try {
        setLoading(true)
        const itemId = reconnectItemId.current
        if (itemId) {
          // Update mode: no new accounts to exchange. Re-sync so the item's
          // status resets to 'good' and fresh transactions come in.
          await syncTransactions(itemId)
        } else {
          await exchangePublicToken(publicToken)
        }
        await onLinked?.()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to link account')
      } finally {
        setLoading(false)
        setLinkToken(null)
        reconnectItemId.current = null
      }
    },
    onExit: () => {
      setLinkToken(null)
      reconnectItemId.current = null
      setLoading(false)
    },
  })

  const start = useCallback(async (itemId?: string) => {
    setError(null)
    setLoading(true)
    try {
      const token = await createLinkToken(itemId)
      reconnectItemId.current = itemId ?? null
      setLinkToken(token)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start linking')
      setLoading(false)
    }
  }, [])

  // Once the token is set and Link is ready, open the widget.
  useEffect(() => {
    if (linkToken && ready) open()
  }, [linkToken, ready, open])

  return {
    /** Begin a fresh bank link. */
    link: () => start(),
    /** Begin update-mode reconnect for an existing Plaid item. */
    reconnect: (itemId: string) => start(itemId),
    loading,
    error,
  }
}
