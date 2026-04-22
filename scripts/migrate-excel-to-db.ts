/**
 * One-time migration: reads FuelStation_SalesTracker.xlsx and inserts all
 * staff + weekly sales data into the Supabase Postgres database.
 *
 * Run with: npx tsx scripts/migrate-excel-to-db.ts
 */
import 'dotenv/config'
import path from 'path'
import * as XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

function toDateStr(val: unknown): string {
  if (!val) return new Date().toISOString().split('T')[0]
  if (val instanceof Date) return val.toISOString().split('T')[0]
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val)
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  if (typeof val === 'string') {
    const parsed = new Date(val)
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0]
    return val
  }
  return String(val)
}

async function main() {
  const filePath = path.join(process.cwd(), 'data', 'FuelStation_SalesTracker.xlsx')
  console.log(`Reading Excel file: ${filePath}`)

  const wb = XLSX.readFile(filePath, { cellDates: true })

  // --- Staff Registry ---
  const staffSheet = wb.Sheets['StaffRegistry']
  const staffRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(staffSheet, { defval: '' })
  const staff = staffRaw.filter((r) => r['Attendant_ID']).map((r) => ({
    attendant_id: String(r['Attendant_ID']),
    attendant_name: String(r['Attendant_Name'] || ''),
    shift: String(r['Shift'] || ''),
    role: String(r['Role'] || ''),
    start_date: new Date(toDateStr(r['Start_Date'])),
    status: String(r['Status'] || 'Active'),
  }))

  console.log(`Importing ${staff.length} staff members...`)
  for (const s of staff) {
    await prisma.staffRegistry.upsert({
      where: { attendant_id: s.attendant_id },
      create: s,
      update: { attendant_name: s.attendant_name, shift: s.shift, role: s.role, start_date: s.start_date, status: s.status },
    })
  }
  console.log(`✓ Staff imported`)

  // --- Weekly Input ---
  const weeklySheet = wb.Sheets['WeeklyInput']
  // The sheet has: row1=title, row2=column headers (as values), row3+=data
  // Use header:1 to get raw arrays, then build objects from row2 headers
  // Sheet layout: row0=title, row1=empty, row2=column headers, row3+=data
  const rawArrays = XLSX.utils.sheet_to_json<unknown[]>(weeklySheet, { header: 1, defval: '' })
  // Find the header row (first row where column A looks like a date field name)
  const headerIdx = rawArrays.findIndex((r) => Array.isArray(r) && r[0] === 'Week_Start')
  const headers = (rawArrays[headerIdx] as string[])
  const weeklyRaw: Record<string, unknown>[] = (rawArrays.slice(headerIdx + 1) as unknown[][]).map((row) => {
    const obj: Record<string, unknown> = {}
    headers.forEach((h, i) => { if (h) obj[h] = row[i] })
    return obj
  })
  const rows = weeklyRaw
    .filter((r) => r['Attendant_ID'] && r['Week_Start'])
    .map((r) => ({
      week_start: new Date(toDateStr(r['Week_Start'])),
      week_end: new Date(toDateStr(r['Week_End'])),
      shift: String(r['Shift'] || ''),
      attendant_id: String(r['Attendant_ID'] || ''),
      fuel_sales_litres: Number(r['Fuel_Sales_Litres']) || 0,
      lub_qty: Number(r['Lub_Qty']) || 0,
      notes: String(r['Notes'] || ''),
    }))

  console.log(`Importing ${rows.length} weekly sales rows...`)
  let imported = 0
  let skipped = 0
  for (const row of rows) {
    try {
      await prisma.weeklySales.upsert({
        where: {
          week_start_attendant_id: {
            week_start: row.week_start,
            attendant_id: row.attendant_id,
          },
        },
        create: row,
        update: { week_end: row.week_end, shift: row.shift, fuel_sales_litres: row.fuel_sales_litres, lub_qty: row.lub_qty, notes: row.notes },
      })
      imported++
    } catch (err) {
      console.warn(`  Skipped row (${row.week_start.toISOString().split('T')[0]}, ${row.attendant_id}):`, err instanceof Error ? err.message : err)
      skipped++
    }
  }

  console.log(`✓ Weekly sales imported: ${imported} rows (${skipped} skipped)`)
  console.log('\nMigration complete!')
}

main()
  .catch((err) => { console.error('Migration failed:', err); process.exit(1) })
  .finally(() => prisma.$disconnect())
