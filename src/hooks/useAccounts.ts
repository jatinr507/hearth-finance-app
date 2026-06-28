import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Account } from '@/types/database'

export function useAccounts(userId: string | undefined) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    setAccounts(data ?? [])
    setLoading(false)
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  return { accounts, loading, refetch: fetch }
}
