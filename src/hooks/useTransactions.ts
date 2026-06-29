import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Transaction } from '@/types/database'

export function useTransactions(userId: string | undefined) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('transactions')
      .select('*, account:accounts(id,name,institution,type), category:categories(id,name,color,icon,is_income,is_transfer)')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(500)

    if (error) setError(error.message)
    else setTransactions(data as Transaction[])
    setLoading(false)
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  return { transactions, loading, error, refetch: fetch }
}
