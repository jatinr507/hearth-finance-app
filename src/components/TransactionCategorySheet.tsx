import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import type { Transaction, Category } from '@/types/database'

interface TransactionCategorySheetProps {
  transaction: Transaction | null
  userId: string
  onClose: () => void
  onUpdated: () => void
}

export function TransactionCategorySheet({
  transaction,
  userId,
  onClose,
  onUpdated,
}: TransactionCategorySheetProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .order('name')
      .then(({ data }) => setCategories(data ?? []))
  }, [userId])

  async function handleSelect(categoryId: string | null) {
    if (!transaction || saving) return
    setSaving(true)
    await supabase
      .from('transactions')
      .update({ category_id: categoryId })
      .eq('id', transaction.id)
    setSaving(false)
    onUpdated()
    onClose()
  }

  return (
    <BottomSheet open={transaction !== null} onClose={onClose}>
      <div className="px-4 pb-8">
        {transaction && (
          <>
            <p className="text-base font-semibold text-ink truncate mb-1">
              {transaction.description}
            </p>
            <div className="mb-4">
              {transaction.category ? (
                <Badge label={transaction.category.name} color={transaction.category.color} />
              ) : (
                <span className="text-xs text-muted">No category</span>
              )}
            </div>
          </>
        )}

        <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">
          Select category
        </p>

        <div className="divide-y divide-hairline -mx-4">
          <button
            className="w-full flex items-center gap-3 px-4 py-3 active:bg-paper text-left"
            onClick={() => handleSelect(null)}
            disabled={saving}
          >
            <span className="w-3 h-3 rounded-full bg-sand" />
            <span className="flex-1 text-sm text-muted">No category</span>
            {transaction?.category_id === null && (
              <Check className="w-4 h-4 text-clay" />
            )}
          </button>

          {categories.map((cat) => (
            <button
              key={cat.id}
              className="w-full flex items-center gap-3 px-4 py-3 active:bg-paper text-left"
              onClick={() => handleSelect(cat.id)}
              disabled={saving}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              <span className="flex-1 text-sm text-ink">{cat.name}</span>
              {transaction?.category_id === cat.id && (
                <Check className="w-4 h-4 text-clay" />
              )}
            </button>
          ))}
        </div>
      </div>
    </BottomSheet>
  )
}
