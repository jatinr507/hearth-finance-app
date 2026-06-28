import { useEffect, useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import type { Category, CategoryRule } from '@/types/database'

interface CategoryRulesSectionProps {
  userId: string
}

const inputCls = 'w-full bg-sand border border-hairline rounded-sm px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-clay'

export function CategoryRulesSection({ userId }: CategoryRulesSectionProps) {
  const [rules, setRules] = useState<CategoryRule[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [newPattern, setNewPattern] = useState('')
  const [newCategoryId, setNewCategoryId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('category_rules').select('*').eq('user_id', userId).order('pattern'),
      supabase.from('categories').select('*').or(`user_id.is.null,user_id.eq.${userId}`).order('name'),
    ]).then(([rulesRes, catsRes]) => {
      setRules(rulesRes.data ?? [])
      setCategories(catsRes.data ?? [])
    })
  }, [userId])

  async function fetchRules() {
    const { data } = await supabase
      .from('category_rules')
      .select('*')
      .eq('user_id', userId)
      .order('pattern')
    setRules(data ?? [])
  }

  async function handleAdd() {
    if (!newPattern.trim() || !newCategoryId) return
    setSaving(true)
    await supabase.from('category_rules').insert({
      user_id: userId,
      pattern: newPattern.trim(),
      category_id: newCategoryId,
    })
    setNewPattern('')
    setNewCategoryId('')
    setSaving(false)
    fetchRules()
  }

  async function handleDelete(id: string) {
    await supabase.from('category_rules').delete().eq('id', id)
    fetchRules()
  }

  const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]))

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-ink-2">Category Rules</h2>
        <p className="text-xs text-muted mt-0.5">
          Auto-assign categories on import when a description matches a keyword.
        </p>
      </div>

      {/* Existing rules */}
      {rules.length === 0 ? (
        <p className="text-xs text-muted text-center py-2">No rules yet</p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => {
            const cat = categoryById[rule.category_id]
            return (
              <div key={rule.id} className="flex items-center gap-2">
                <code className="text-xs bg-sand px-1.5 py-1 rounded text-ink-2 truncate max-w-[120px]">
                  {rule.pattern}
                </code>
                <span className="text-muted text-xs">→</span>
                <span className="flex-1 text-xs text-ink-2 truncate">
                  {cat ? (
                    <span className="flex items-center gap-1">
                      <span
                        className="w-2 h-2 rounded-full inline-block shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      {cat.name}
                    </span>
                  ) : (
                    <span className="text-muted">Unknown</span>
                  )}
                </span>
                <button
                  onClick={() => handleDelete(rule.id)}
                  className="text-muted/60 hover:text-rust transition-colors p-1 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Add rule form */}
      <div className="border-t border-hairline pt-3 space-y-2">
        <input
          value={newPattern}
          onChange={(e) => setNewPattern(e.target.value)}
          placeholder="Keyword or phrase…"
          className={inputCls}
        />
        <div className="flex gap-2">
          <select
            value={newCategoryId}
            onChange={(e) => setNewCategoryId(e.target.value)}
            className="flex-1 bg-sand border border-hairline rounded-sm px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-clay"
          >
            <option value="">Select category…</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={saving || !newPattern.trim() || !newCategoryId}
          >
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
      </div>
    </Card>
  )
}
