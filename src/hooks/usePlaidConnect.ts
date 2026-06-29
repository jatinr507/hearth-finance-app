import { useCallback, useEffect, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { createLinkToken, exchangePublicToken } from '@/lib/plaid'

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
  // When set, this is a reconnect (update mode) rather than a fresh link.
  const [reconnecting, setReconnecting] = useState(false)

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (publicToken) => {
      try {
        setLoading(true)
        // Update mode returns no new accounts to exchange; just refresh.
        if (!reconnecting) {
          await exchangePublicToken(publicToken)
        }
        await onLinked?.()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to link account')
      } finally {
        setLoading(false)
        setLinkToken(null)
        setReconnecting(false)
      }
    },
    onExit: () => {
      setLinkToken(null)
      setReconnecting(false)
      setLoading(false)
    },
  })

  const start = useCallback(async (itemId?: string) => {
    setError(null)
    setLoading(true)
    try {
      const token = await createLinkToken(itemId)
      setReconnecting(Boolean(itemId))
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
