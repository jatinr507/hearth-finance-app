// Maps Plaid's personal_finance_category.primary values to this app's system
// category names (see supabase/schema.sql seed). Dependency-free so the Deno
// Edge Functions can import it directly.
import type { CategoryRuleLike } from './categorize'

// Plaid PFC *detailed* -> our system category name. Checked before the primary
// map so finer-grained signals win (e.g. a payroll deposit is INCOME / INCOME_WAGES
// and should land in 'Paycheck', not the generic 'Income' bucket).
const PFC_DETAILED_TO_CATEGORY: Record<string, string> = {
  INCOME_WAGES: 'Paycheck',
}

// Plaid PFC primary -> our system category name. Unmapped primaries fall through
// to the income/null default in resolvePlaidCategory.
const PFC_TO_CATEGORY: Record<string, string> = {
  INCOME: 'Income',
  TRANSFER_IN: 'Transfer',
  TRANSFER_OUT: 'Transfer',
  LOAN_PAYMENTS: 'Credit Card Payment',
  BANK_FEES: 'Other',
  ENTERTAINMENT: 'Entertainment',
  FOOD_AND_DRINK: 'Food & Dining',
  GENERAL_MERCHANDISE: 'Shopping',
  HOME_IMPROVEMENT: 'Shopping',
  MEDICAL: 'Healthcare',
  PERSONAL_CARE: 'Healthcare',
  GENERAL_SERVICES: 'Other',
  GOVERNMENT_AND_NON_PROFIT: 'Other',
  TRANSPORTATION: 'Gas & Fuel',
  TRAVEL: 'Travel',
  RENT_AND_UTILITIES: 'Utilities',
}

/**
 * Map Plaid PFC values to a system category name, or null if unmapped.
 * The detailed value (when mapped) wins over the primary.
 */
export function mapPlaidCategory(
  pfcPrimary: string | null | undefined,
  pfcDetailed?: string | null | undefined,
): string | null {
  if (pfcDetailed && PFC_DETAILED_TO_CATEGORY[pfcDetailed]) {
    return PFC_DETAILED_TO_CATEGORY[pfcDetailed]
  }
  if (!pfcPrimary) return null
  return PFC_TO_CATEGORY[pfcPrimary] ?? null
}

/**
 * Resolve a category id for a Plaid transaction.
 * Precedence: user rule → Plaid PFC map → Income default for credits → null.
 */
export function resolvePlaidCategory(
  description: string,
  type: 'debit' | 'credit',
  pfcPrimary: string | null | undefined,
  rules: CategoryRuleLike[],
  categoryIdByName: Map<string, string>,
  incomeCategoryId: string | null,
  pfcDetailed?: string | null | undefined,
): string | null {
  const desc = description.toLowerCase()

  // 1. User-defined rule (substring match) — highest priority.
  const rule = rules.find((r) => desc.includes(r.pattern.toLowerCase()))
  if (rule) return rule.category_id

  // 2. Plaid's personal finance category (detailed wins over primary).
  const name = mapPlaidCategory(pfcPrimary, pfcDetailed)
  if (name) {
    const id = categoryIdByName.get(name)
    if (id) return id
  }

  // 3. Default: credits are income, debits stay uncategorized.
  return type === 'credit' ? incomeCategoryId : null
}
