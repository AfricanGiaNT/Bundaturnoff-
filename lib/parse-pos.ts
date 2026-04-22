import * as XLSX from 'xlsx'

interface RawPOSTransaction {
  card_number: string
  card_last4: string
  amount: number
  datetime_local: Date
  datetime_gmt: Date
  terminal_id: string
  switch_key: string
  account_no: string | null
  sheet_month: string
}

const CARD_PATTERN = /^\d{6}\*{6}\d{4}$/

function normalizeHeader(h: unknown): string {
  if (typeof h !== 'string') return ''
  return h.toLowerCase().replace(/[\s\n\r:]+/g, '')
}

function parseExcelDate(v: unknown): Date | null {
  if (!v) return null
  if (v instanceof Date) return v
  if (typeof v === 'number') {
    const parsed = XLSX.SSF.parse_date_code(v)
    if (!parsed) return null
    return new Date(
      Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, parsed.S)
    )
  }
  if (typeof v === 'string') {
    const d = new Date(v)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

function normalizeMonthName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 2) {
    const month = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase()
    return `${month} ${parts[1]}`
  }
  return name.trim()
}

function parseSheetWithHeaders(
  rows: unknown[][],
  headerRow: unknown[],
  sheetMonth: string
): RawPOSTransaction[] {
  const headers = headerRow.map(normalizeHeader)

  const idx = {
    card: headers.findIndex((h) => h === 'messagetype' || h === 'message\ntype' || h.startsWith('message')),
    datetimeLocal: headers.findIndex((h) => h === 'datetime_tran_local'),
    datetimeGmt: headers.findIndex((h) => h === 'datetime_tran_gmt'),
    amount: headers.findIndex((h) => h === 'amount'),
    switchKey: headers.findIndex((h) => h === 'switch_key'),
    terminal: headers.findIndex((h) => h === 'terminal_id'),
    accountNo: headers.findIndex((h) => h === 'accountno' || h === 'account_no'),
  }

  const results: RawPOSTransaction[] = []

  for (const row of rows) {
    const cardRaw = String(row[idx.card] ?? '').trim()
    if (!CARD_PATTERN.test(cardRaw)) continue

    const switchKey = String(row[idx.switchKey] ?? '').trim()
    if (!switchKey) continue

    const dtLocal = parseExcelDate(row[idx.datetimeLocal])
    const dtGmt = parseExcelDate(row[idx.datetimeGmt])
    if (!dtLocal || !dtGmt) continue

    const amountRaw = row[idx.amount]
    const amount = typeof amountRaw === 'number' ? Math.round(amountRaw) : parseInt(String(amountRaw), 10)
    if (isNaN(amount)) continue

    const terminal = String(row[idx.terminal] ?? '').trim()
    const accountNo = idx.accountNo >= 0 ? String(row[idx.accountNo] ?? '').trim() || null : null

    results.push({
      card_number: cardRaw,
      card_last4: cardRaw.slice(-4),
      amount,
      datetime_local: dtLocal,
      datetime_gmt: dtGmt,
      terminal_id: terminal,
      switch_key: switchKey,
      account_no: accountNo,
      sheet_month: sheetMonth,
    })
  }

  return results
}

// Jan 2026 positional fallback (no headers, 10 columns):
// 0: card_number, 1: msg_type(0200), 2: rsp_code, 3: merchant,
// 4: datetime_local, 5: amount, 6: switch_key, 7: datetime_gmt, 8: terminal_id, 9: account_no
function parseSheetPositional(rows: unknown[][], sheetMonth: string): RawPOSTransaction[] {
  const results: RawPOSTransaction[] = []

  for (const row of rows) {
    const cardRaw = String(row[0] ?? '').trim()
    if (!CARD_PATTERN.test(cardRaw)) continue

    const switchKey = String(row[6] ?? '').trim()
    if (!switchKey) continue

    const dtLocal = parseExcelDate(row[4])
    const dtGmt = parseExcelDate(row[7])
    if (!dtLocal || !dtGmt) continue

    const amountRaw = row[5]
    const amount = typeof amountRaw === 'number' ? Math.round(amountRaw) : parseInt(String(amountRaw), 10)
    if (isNaN(amount)) continue

    const terminal = String(row[8] ?? '').trim()
    const accountNo = String(row[9] ?? '').trim() || null

    results.push({
      card_number: cardRaw,
      card_last4: cardRaw.slice(-4),
      amount,
      datetime_local: dtLocal,
      datetime_gmt: dtGmt,
      terminal_id: terminal,
      switch_key: switchKey,
      account_no: accountNo,
      sheet_month: sheetMonth,
    })
  }

  return results
}

export function parsePOSExcel(buffer: Buffer): RawPOSTransaction[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const allTransactions: RawPOSTransaction[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

    if (rawRows.length < 2) continue

    const sheetMonth = normalizeMonthName(sheetName)
    const firstCell = String(rawRows[0][0] ?? '').trim()
    const hasHeaders = !CARD_PATTERN.test(firstCell)

    if (hasHeaders) {
      const transactions = parseSheetWithHeaders(rawRows.slice(1), rawRows[0], sheetMonth)
      allTransactions.push(...transactions)
    } else {
      const transactions = parseSheetPositional(rawRows, sheetMonth)
      allTransactions.push(...transactions)
    }
  }

  return allTransactions
}
