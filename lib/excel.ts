import * as XLSX from 'xlsx'
import { WeeklyRow, StaffMember } from './types'

function toDateStr(val: unknown): string {
  if (!val) return ''
  if (val instanceof Date) return val.toISOString().split('T')[0]
  if (typeof val === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val)
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  if (typeof val === 'string') {
    // Handle "MM/DD/YYYY" or ISO formats
    const parsed = new Date(val)
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0]
    return val
  }
  return String(val)
}

export function readWeeklyInput(wb: XLSX.WorkBook): WeeklyRow[] {
  const sheet = wb.Sheets['WeeklyInput']
  if (!sheet) return []
  // Sheet layout: row0=title, row1=empty, row2=column headers, row3+=data
  // Dynamically find the header row (first row where col A = 'Week_Start')
  const rawArrays = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  const headerIdx = rawArrays.findIndex((r) => Array.isArray(r) && r[0] === 'Week_Start')
  const raw: Record<string, unknown>[] = headerIdx >= 0
    ? (() => {
        const headers = rawArrays[headerIdx] as string[]
        return (rawArrays.slice(headerIdx + 1) as unknown[][]).map((row) => {
          const obj: Record<string, unknown> = {}
          headers.forEach((h, i) => { if (h) obj[h] = row[i] })
          return obj
        })
      })()
    : XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  return raw
    .filter((r) => r['Attendant_ID'] && r['Week_Start'])
    .map((r) => ({
      week_start: toDateStr(r['Week_Start']),
      week_end: toDateStr(r['Week_End']),
      shift: String(r['Shift'] || ''),
      attendant_id: String(r['Attendant_ID'] || ''),
      attendant_name: String(r['Attendant_Name'] || ''),
      role: String(r['Role'] || ''),
      fuel_sales_litres: Number(r['Fuel_Sales_Litres']) || 0,
      lub_qty: Number(r['Lub_Qty']) || 0,
      notes: String(r['Notes'] || ''),
    }))
}

export function readStaffRegistry(wb: XLSX.WorkBook): StaffMember[] {
  const sheet = wb.Sheets['StaffRegistry']
  if (!sheet) return []
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  return raw
    .filter((r) => r['Attendant_ID'])
    .map((r) => ({
      attendant_id: String(r['Attendant_ID'] || ''),
      attendant_name: String(r['Attendant_Name'] || ''),
      shift: String(r['Shift'] || ''),
      role: String(r['Role'] || ''),
      start_date: toDateStr(r['Start_Date']),
      status: String(r['Status'] || 'Active'),
    }))
}

export function writeWeeklyInput(wb: XLSX.WorkBook, rows: WeeklyRow[]): void {
  const data = rows.map((r) => ({
    Week_Start: r.week_start,
    Week_End: r.week_end,
    Shift: r.shift,
    Attendant_ID: r.attendant_id,
    Attendant_Name: r.attendant_name,
    Role: r.role,
    Fuel_Sales_Litres: r.fuel_sales_litres,
    Lub_Qty: r.lub_qty,
    Notes: r.notes,
  }))
  const newSheet = XLSX.utils.json_to_sheet(data)
  wb.Sheets['WeeklyInput'] = newSheet
  if (!wb.SheetNames.includes('WeeklyInput')) {
    wb.SheetNames.push('WeeklyInput')
  }
}

export function writeStaffRegistry(wb: XLSX.WorkBook, staff: StaffMember[]): void {
  const data = staff.map((s) => ({
    Attendant_ID: s.attendant_id,
    Attendant_Name: s.attendant_name,
    Shift: s.shift,
    Role: s.role,
    Start_Date: s.start_date,
    Status: s.status,
  }))
  const newSheet = XLSX.utils.json_to_sheet(data)
  wb.Sheets['StaffRegistry'] = newSheet
  if (!wb.SheetNames.includes('StaffRegistry')) {
    wb.SheetNames.push('StaffRegistry')
  }
}
