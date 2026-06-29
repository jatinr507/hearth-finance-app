// Shared transaction categorization, used by both CSV import and Plaid sync so
// the two paths assign categories identically. Kept dependency-free so the Deno
// Edge Functions can import it directly (see supabase/functions/plaid-sync).

export interface CategoryRuleLike {
  pattern: string
  category_id: string
}

/**
 * Resolve a category id for a transaction.
 * Precedence: user rule (substring match on description) → Income default for
 * credits → null (uncategorized, treated as an expense in the UI).
 */
export function assignCategory(
  description: string,
  type: 'debit' | 'credit',
  rules: CategoryRuleLike[],
  incomeCategoryId: string | null,
): string | null {
  const desc = description.toLowerCase()
  const match = rules.find((r) => desc.includes(r.pattern.toLowerCase()))
  if (match) return match.category_id
  return type === 'credit' ? incomeCategoryId : null
}
