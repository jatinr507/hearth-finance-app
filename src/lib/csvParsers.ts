import Papa from 'papaparse'

export interface ColumnMapping {
  date: string
  description: string
  amountMode: 'single' | 'split'
  amount?: string
  debit?: string
  credit?: string
  typeColumn?: string  // optional column with "Debit"/"Credit" string values
}

export interface ParsedTransaction {
  date: string
  description: string
  amount: number
  type: 'debit' | 'credit'
  raw: Record<string, string>
}

export interface SkippedRow {
  row: number
  reason: string
}

export interface ParseResult {
  transactions: ParsedTransaction[]
  skippedCount: number
  skippedReasons: SkippedRow[]
}

function normalizeDate(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null

  const slashParts = s.split('/')
  if (slashParts.length === 3) {
    const [a, b, c] = slashParts
    if (c.length === 4) {
      // MM/DD/YYYY
      return `${c}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`
    }
    if (a.length === 4) {
      // YYYY/MM/DD
      return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`
    }
    if (c.length === 2) {
      // MM/DD/YY — treat YY < 50 as 20xx, >= 50 as 19xx
      const year = parseInt(c, 10) < 50 ? `20${c}` : `19${c}`
      return `${year}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`
    }
  }

  const dashParts = s.split('-')
  if (dashParts.length === 3) {
    const [a, b, c] = dashParts
    if (a.length === 4) {
      // YYYY-MM-DD (already ISO)
      return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`
    }
    if (c.length === 4) {
      // MM-DD-YYYY
      return `${c}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`
    }
    if (c.length === 2) {
      // MM-DD-YY
      const year = parseInt(c, 10) < 50 ? `20${c}` : `19${c}`
      return `${year}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`
    }
  }

  // Last resort: native Date parse — use local date parts to avoid UTC-offset day shift
  const d = new Date(s)
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  return null
}

function parseAmount(raw: string): number {
  if (!raw) return NaN
  return parseFloat(raw.replace(/[$,\s]/g, ''))
}

function parseRows(csv: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })
  return result.data
}

export function getHeaders(csv: string): string[] {
  const result = Papa.parse<string[]>(csv, {
    header: false,
    preview: 1,
  })
  return (result.data[0] as string[] | undefined)?.map((h) => h.trim()) ?? []
}

export function autoDetectMapping(headers: string[]): ColumnMapping {
  const lower = headers.map((h) => h.toLowerCase())

  const find = (pattern: RegExp): string => {
    const idx = lower.findIndex((h) => pattern.test(h))
    return idx >= 0 ? headers[idx] : ''
  }

  const dateCol = find(/^(transaction\s*)?date$|posted\s*date/)
  const descCol = find(/description|memo|payee|name|narrative|details/)

  // Amount column — match "Amount", "Transaction Amount", "Net Amount", etc.
  const amountCol = find(/^(transaction\s*)?(net\s*)?amount$/)
  // Separate debit/credit columns
  const debitCol = find(/^debit$|^withdrawals?$|^charges?$/)
  const creditCol = find(/^credit$|^deposits?$|^payments?$/)
  // Type column (e.g. "Transaction Type" with "Debit"/"Credit" string values)
  const typeCol = find(/^(transaction\s*)?type$|^dr\.?\/?cr\.?$/)

  const hasSplit = !!(debitCol && creditCol)
  const hasSingle = !!amountCol

  if (hasSingle && !hasSplit) {
    return {
      date: dateCol,
      description: descCol,
      amountMode: 'single',
      amount: amountCol,
      typeColumn: typeCol || undefined,
    }
  }
  if (hasSplit) {
    return {
      date: dateCol,
      description: descCol,
      amountMode: 'split',
      debit: debitCol,
      credit: creditCol,
    }
  }

  // Fallback: find any column with "amount" in the name
  const fallbackAmount = find(/amount|total|sum|value|price/)
  return {
    date: dateCol,
    description: descCol,
    amountMode: 'single',
    amount: fallbackAmount,
    typeColumn: typeCol || undefined,
  }
}

// Returns true if the type column value indicates a debit/withdrawal
function isDebitType(value: string): boolean {
  const v = value.trim().toLowerCase()
  return /^debit$|^dr$|^withdrawal|^charge|^out$/.test(v)
}

export function parseWithMapping(csv: string, mapping: ColumnMapping): ParseResult {
  const rows = parseRows(csv)
  const transactions: ParsedTransaction[] = []
  const skippedReasons: SkippedRow[] = []

  rows.forEach((row, idx) => {
    const rowNum = idx + 2

    // Date
    const rawDate = row[mapping.date]?.trim() ?? ''
    const date = normalizeDate(rawDate)
    if (!date) {
      skippedReasons.push({ row: rowNum, reason: `Missing or unrecognized date: "${rawDate}"` })
      return
    }

    // Description
    const description = row[mapping.description]?.trim() ?? ''

    // Amount
    let amount: number
    let type: 'debit' | 'credit'

    if (mapping.amountMode === 'single') {
      const raw = row[mapping.amount ?? '']?.trim() ?? ''
      const val = parseAmount(raw)
      if (isNaN(val) || val === 0) {
        skippedReasons.push({ row: rowNum, reason: `Invalid or zero amount: "${raw}"` })
        return
      }
      amount = Math.abs(val)

      // Determine type: prefer explicit type column, fall back to sign
      if (mapping.typeColumn) {
        const typeVal = row[mapping.typeColumn] ?? ''
        type = isDebitType(typeVal) ? 'debit' : 'credit'
      } else {
        type = val < 0 ? 'debit' : 'credit'
      }
    } else {
      const rawDebit = row[mapping.debit ?? '']?.trim() ?? ''
      const rawCredit = row[mapping.credit ?? '']?.trim() ?? ''
      const debit = parseAmount(rawDebit) || 0
      const credit = parseAmount(rawCredit) || 0
      if (debit === 0 && credit === 0) {
        skippedReasons.push({ row: rowNum, reason: 'Both debit and credit are empty or zero' })
        return
      }
      if (credit > 0) {
        amount = credit
        type = 'credit'
      } else {
        amount = debit
        type = 'debit'
      }
    }

    transactions.push({ date, description, amount, type, raw: row })
  })

  return { transactions, skippedCount: skippedReasons.length, skippedReasons }
}
