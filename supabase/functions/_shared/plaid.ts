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

// Plaid `current` balance for credit/loan is what you owe (positive). Our app
// treats those as positive balances and subtracts them in net-worth math, so
// pass the absolute current balance through.
export function accountBalance(acct: AccountBase): number {
  const bal = acct.balances.current ?? acct.balances.available ?? 0
  return Math.abs(bal)
}
