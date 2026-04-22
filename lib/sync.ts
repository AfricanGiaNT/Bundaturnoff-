/**
 * After any DB write, sync the full dataset back to the Excel file.
 * This keeps the .xlsx up-to-date as a backup / export.
 */
import { prisma, type DbStaffRow, type DbSalesRow } from './db'
import { getWorkbook, saveWorkbook } from './blob'
import { writeWeeklyInput, writeStaffRegistry } from './excel'
import { StaffMember, WeeklyRow } from './types'

function toDateStr(d: Date | null | undefined): string {
  if (!d) return ''
  return d.toISOString().split('T')[0]
}

export async function syncToExcel(): Promise<void> {
  try {
    const [staffRows, salesRows] = await Promise.all([
      prisma.staffRegistry.findMany({ orderBy: { attendant_id: 'asc' } }),
      prisma.weeklySales.findMany({ orderBy: [{ week_start: 'asc' }, { attendant_id: 'asc' }] }),
    ])

    const staff: StaffMember[] = staffRows.map((s: DbStaffRow) => ({
      attendant_id: s.attendant_id,
      attendant_name: s.attendant_name,
      shift: s.shift,
      role: s.role,
      start_date: toDateStr(s.start_date),
      status: s.status,
    }))

    const rows: WeeklyRow[] = salesRows.map((r: DbSalesRow) => ({
      week_start: toDateStr(r.week_start),
      week_end: toDateStr(r.week_end),
      shift: r.shift,
      attendant_id: r.attendant_id,
      attendant_name: staffRows.find((s: DbStaffRow) => s.attendant_id === r.attendant_id)?.attendant_name ?? '',
      role: staffRows.find((s: DbStaffRow) => s.attendant_id === r.attendant_id)?.role ?? '',
      fuel_sales_litres: r.fuel_sales_litres,
      lub_qty: r.lub_qty,
      notes: r.notes,
    }))

    const wb = await getWorkbook()
    writeWeeklyInput(wb, rows)
    writeStaffRegistry(wb, staff)
    await saveWorkbook(wb)
  } catch (err) {
    // Non-fatal: log but don't crash the API response
    console.error('[syncToExcel] failed:', err)
  }
}
