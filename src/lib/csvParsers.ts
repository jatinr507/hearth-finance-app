import Papa from 'papaparse'

export interface ParsedTransaction {
  date: string
  description: string
  amount: number
  type: 'debit' | 'credit'
}

export type SupportedBank = 'chase' | 'capital_one' | 'pnc'

function normalizeDate(raw: string): string {
  // Normalize MM/DD/YYYY or YYYY-MM-DD to YYYY-MM-DD
  const parts = raw.trim().split('/')
  if (parts.length === 3) {
    const [m, d, y] = parts
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return raw.trim()
}

function parseRows(csv: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })
  return result.data
}

function parseChase(csv: string): ParsedTransaction[] {
  // Columns: Transaction Date, Post Date, Description, Category, Type, Amount, Memo
  return parseRows(csv)
    .filter((r) => r['Transaction Date'] && r['Amount'])
    .map((r) => {
      const amount = parseFloat(r['Amount'].replace(/[$,]/g, ''))
      return {
        date: normalizeDate(r['Transaction Date']),
        description: r['Description']?.trim() ?? '',
        // Chase uses negative for debits, positive for credits/payments
        amount: Math.abs(amount),
        type: amount < 0 ? 'debit' : 'credit',
      }
    })
}

function parseCapitalOne(csv: string): ParsedTransaction[] {
  // Columns: Transaction Date, Posted Date, Card No., Description, Category, Debit, Credit
  return parseRows(csv)
    .filter((r) => r['Transaction Date'])
    .map((r) => {
      const debit = parseFloat(r['Debit']?.replace(/[$,]/g, '') || '0') || 0
      const credit = parseFloat(r['Credit']?.replace(/[$,]/g, '') || '0') || 0
      const isCredit = credit > 0
      return {
        date: normalizeDate(r['Transaction Date']),
        description: r['Description']?.trim() ?? '',
        amount: isCredit ? credit : debit,
        type: isCredit ? 'credit' : 'debit',
      }
    })
    .filter((t) => t.amount > 0)
}

function parsePNC(csv: string): ParsedTransaction[] {
  // PNC CSV: Date, Description, Withdrawals, Deposits, Balance
  // Some PNC exports use: Date,Description,Amount (negative = debit)
  const rows = parseRows(csv)
  if (rows.length === 0) return []

  const headers = Object.keys(rows[0]).map((h) => h.toLowerCase())
  const hasWithdrawals = headers.some((h) => h.includes('withdrawal'))

  return rows
    .filter((r) => r['Date'])
    .map((r) => {
      if (hasWithdrawals) {
        const withdrawal = parseFloat(r['Withdrawals']?.replace(/[$,]/g, '') || '0') || 0
        const deposit = parseFloat(r['Deposits']?.replace(/[$,]/g, '') || '0') || 0
        const isDeposit = deposit > 0
        return {
          date: normalizeDate(r['Date']),
          description: r['Description']?.trim() ?? '',
          amount: isDeposit ? deposit : withdrawal,
          type: isDeposit ? ('credit' as const) : ('debit' as const),
        }
      } else {
        const amount = parseFloat(r['Amount']?.replace(/[$,]/g, '') || '0')
        return {
          date: normalizeDate(r['Date']),
          description: r['Description']?.trim() ?? '',
          amount: Math.abs(amount),
          type: amount < 0 ? ('debit' as const) : ('credit' as const),
        }
      }
    })
    .filter((t) => t.amount > 0)
}

export function detectBank(csv: string): SupportedBank | null {
  const header = csv.split('\n')[0].toLowerCase()
  if (header.includes('transaction date') && header.includes('post date') && header.includes('type')) {
    return 'chase'
  }
  if (header.includes('card no') || (header.includes('debit') && header.includes('credit'))) {
    return 'capital_one'
  }
  if (header.includes('withdrawal') || header.includes('deposits')) {
    return 'pnc'
  }
  return null
}

export function parseCSV(csv: string, bank?: SupportedBank): ParsedTransaction[] {
  const detected = bank ?? detectBank(csv)
  switch (detected) {
    case 'chase':
      return parseChase(csv)
    case 'capital_one':
      return parseCapitalOne(csv)
    case 'pnc':
      return parsePNC(csv)
    default:
      throw new Error('Unrecognized CSV format. Please select your bank manually.')
  }
}
