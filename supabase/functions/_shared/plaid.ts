// All Plaid SDK usage is isolated to this module. Swapping providers later
// (SimpleFIN/Teller) means rewriting this file, not the rest of the app.
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  type AccountBase,
} from 'npm:plaid@27'
import type { AccountType } from '../../../src/types/database.ts'

const PLAID_ENV = Deno.env.get('PLAID_ENV') ?? 'sandbox'

export function plaidClient(): PlaidApi {
  const config = new Configuration({
    basePath: PlaidEnvironments[PLAID_ENV],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': Deno.env.get('PLAID_CLIENT_ID')!,
        'PLAID-SECRET': Deno.env.get('PLAID_SECRET')!,
      },
    },
  })
  return new PlaidApi(config)
}

// Map Plaid account type/subtype to our AccountType enum.
export function mapAccountType(acct: AccountBase): AccountType {
  const subtype = (acct.subtype ?? '').toLowerCase()
  switch (acct.type) {
    case 'depository':
      return subtype === 'savings' ? 'savings' : 'checking'
    case 'credit':
      return 'credit'
    case 'loan':
      return 'loan'
    case 'investment':
      return 'investment'
    default:
      return 'checking'
  }
}

// Plaid investment/loan accounts are balance-only in this phase.
export function isTransactionAccount(acct: AccountBase): boolean {
  return acct.type === 'depository' || acct.type === 'credit'
}

// Extract a log-safe summary of a Plaid/axios error. NEVER log the raw error:
// the thrown AxiosError carries `.config.headers` containing PLAID-SECRET and
// PLAID-CLIENT-ID, which would leak into the function logs in plaintext.
export function plaidErrorInfo(e: unknown): string {
  // deno-lint-ignore no-explicit-any
  const data = (e as any)?.response?.data
  if (data?.error_code) {
    return `${data.error_code}${data.error_message ? `: ${data.error_message}` : ''}`
  }
  return e instanceof Error ? e.message : 'unknown error'
}

/** Plaid error code if present (e.g. ITEM_LOGIN_REQUIRED), else null. */
export function plaidErrorCode(e: unknown): string | null {
  // deno-lint-ignore no-explicit-any
  return (e as any)?.response?.data?.error_code ?? null
}

// Item/credential errors that genuinely require the user to re-authenticate.
// Everything else (INSTITUTION_DOWN, RATE_LIMIT_EXCEEDED, PLANNED_MAINTENANCE,
// INSTITUTION_NOT_RESPONDING, …) is transient and must NOT flip the item to a
// sticky error status that nags the user to reconnect.
export const RECONNECT_ERROR_CODES = new Set<string>([
  'ITEM_LOGIN_REQUIRED',
  'PENDING_EXPIRATION',
  'INVALID_CREDENTIALS',
  'INVALID_UPDATED_USERNAME',
  'INVALID_MFA',
])

// Plaid `current` balance for credit/loan is what you owe (positive). Our app
// treats those as positive balances and subtracts them in net-worth math, so
// pass the absolute current balance through.
export function accountBalance(acct: AccountBase): number {
  const bal = acct.balances.current ?? acct.balances.available ?? 0
  return Math.abs(bal)
}
