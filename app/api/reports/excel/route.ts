import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { prisma, type DbStaffRow, type DbSalesRow } from '@/lib/db'
import {
  computeOverview,
  computeIndividual,
  computeMonthlySummary,
  computeShiftSummary,
} from '@/lib/compute'
import { WeeklyRow, StaffMember, OverviewKPIs, IndividualSummary, MonthlySummaryRow, ShiftSummary } from '@/lib/types'

type ShiftKey = 'A' | 'B' | 'C'

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  headerBg:     'FF1e293b',
  headerFg:     'FFFFFFFF',
  altRow:       'FFf8fafc',
  white:        'FFFFFFFF',
  shiftA:       'FFdbeafe',
  shiftB:       'FFd1fae5',
  shiftC:       'FFede9fe',
  accentA:      'FF3b82f6',
  accentB:      'FF10b981',
  accentC:      'FF8b5cf6',
  positive:     'FF16a34a',
  negative:     'FFdc2626',
  summaryTitle: 'FF1e40af',
  kpiLabel:     'FF64748b',
  kpiValue:     'FF0f172a',
  border:       'FFcbd5e1',
  sectionLabel: 'FF334155',
} as const

const SHIFT_FILL: Record<ShiftKey, string>   = { A: C.shiftA,  B: C.shiftB,  C: C.shiftC  }
const SHIFT_ACCENT: Record<ShiftKey, string> = { A: C.accentA, B: C.accentB, C: C.accentC }
const TAB_COLORS = {
  summary:    { argb: 'FF1e40af' },
  weekly:     { argb: 'FF334155' },
  individual: { argb: 'FF0369a1' },
  shift:      { argb: 'FF059669' },
  monthly:    { argb: 'FF7c3aed' },
}

// ── Style helpers ─────────────────────────────────────────────────────────────

function thinBorder(color = C.border): Partial<ExcelJS.Border> {
  return { style: 'thin', color: { argb: color } }
}

function applyHeaderRow(row: ExcelJS.Row, numCols: number): void {
  row.height = 22
  for (let c = 1; c <= numCols; c++) {
    const cell = row.getCell(c)
    cell.font      = { bold: true, color: { argb: C.headerFg }, size: 11 }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.headerBg } }
    cell.border    = { bottom: thinBorder() }
    cell.alignment = { vertical: 'middle', horizontal: (cell.alignment?.horizontal) ?? 'left' }
  }
}

function applyDataRow(
  row: ExcelJS.Row,
  numCols: number,
  rowIndex: number,
  shiftKey?: ShiftKey,
): void {
  const bgArgb = shiftKey
    ? SHIFT_FILL[shiftKey]
    : rowIndex % 2 === 0 ? C.altRow : C.white

  for (let c = 1; c <= numCols; c++) {
    const cell = row.getCell(c)
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } }
    cell.border = {
      top:    thinBorder(),
      bottom: thinBorder(),
      left:   c === 1 && shiftKey
        ? { style: 'medium', color: { argb: SHIFT_ACCENT[shiftKey] } }
        : thinBorder(),
      right: thinBorder(),
    }
  }
}

function freezeTopRow(sheet: ExcelJS.Worksheet): void {
  sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, topLeftCell: 'A2' }]
}

function setColumnWidths(sheet: ExcelJS.Worksheet, widths: number[]): void {
  widths.forEach((w, i) => { sheet.getColumn(i + 1).width = w })
}

function rightAlignCols(sheet: ExcelJS.Worksheet, cols: number[]): void {
  cols.forEach((c) => { sheet.getColumn(c).alignment = { horizontal: 'right', vertical: 'middle' } })
}

function centerAlignCols(sheet: ExcelJS.Worksheet, cols: number[]): void {
  cols.forEach((c) => { sheet.getColumn(c).alignment = { horizontal: 'center', vertical: 'middle' } })
}

// ── Sheet builders ────────────────────────────────────────────────────────────

function buildSummarySheet(
  wb: ExcelJS.Workbook,
  overview: OverviewKPIs,
  label: string,
  totalRows: number,
  totalStaff: number,
): void {
  const sheet = wb.addWorksheet('Summary')
  sheet.properties.tabColor = TAB_COLORS.summary
  setColumnWidths(sheet, [28, 28])

  // Title row
  sheet.mergeCells('A1:B1')
  const title = sheet.getCell('A1')
  title.value     = 'Bunda Turnoff — Fuel Station Sales Report'
  title.font      = { bold: true, size: 18, color: { argb: C.summaryTitle } }
  title.alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getRow(1).height = 44

  // Meta
  const metaFont: Partial<ExcelJS.Font> = { italic: true, size: 11, color: { argb: C.kpiLabel } }
  sheet.getCell('A2').value = `Period: ${label}`
  sheet.getCell('A2').font  = metaFont
  sheet.getRow(2).height    = 20

  const today  = new Date()
  const dateStr = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  sheet.getCell('A3').value = `Generated: ${dateStr}`
  sheet.getCell('A3').font  = metaFont
  sheet.getRow(3).height    = 20

  sheet.getRow(4).height = 10  // spacer

  // Section label
  sheet.getCell('A5').value = 'KEY PERFORMANCE INDICATORS'
  sheet.getCell('A5').font  = { bold: true, size: 10, color: { argb: C.sectionLabel } }
  sheet.getRow(5).height    = 20

  // KPI block
  const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 1 })
  const kpis: [string, string][] = [
    ['Total Fuel Sales',    `${fmt(overview.total_fuel_sales)} L`],
    ['Total Lubricant Qty', `${fmt(overview.total_lub_qty)}`],
    ['Best Attendant',      `${overview.best_attendant.name} (${fmt(overview.best_attendant.total)} L)`],
    ['Best Shift',          `Shift ${overview.best_shift.shift} (${fmt(overview.best_shift.total)} L)`],
    ['Active Staff',        `${overview.active_staff}`],
  ]

  kpis.forEach(([kpiLabel, value], i) => {
    const rowNum   = 6 + i
    const labelCell = sheet.getCell(`A${rowNum}`)
    const valueCell = sheet.getCell(`B${rowNum}`)
    labelCell.value     = kpiLabel
    labelCell.font      = { size: 11, color: { argb: C.kpiLabel } }
    valueCell.value     = value
    valueCell.font      = { bold: true, size: 12, color: { argb: C.kpiValue } }
    valueCell.alignment = { horizontal: 'right' }
    sheet.getRow(rowNum).height = 22
  })

  sheet.getRow(12).height = 10  // spacer
  sheet.getCell('A13').value = `Report covers ${totalRows} weekly records across ${totalStaff} staff members.`
  sheet.getCell('A13').font  = { italic: true, size: 10, color: { argb: C.kpiLabel } }
}

function buildWeeklySheet(wb: ExcelJS.Workbook, rows: WeeklyRow[]): void {
  const sheet = wb.addWorksheet('Weekly Data')
  sheet.properties.tabColor = TAB_COLORS.weekly
  setColumnWidths(sheet, [12, 12, 8, 14, 22, 14, 14, 10, 30])
  freezeTopRow(sheet)
  rightAlignCols(sheet, [7, 8])
  centerAlignCols(sheet, [3])
  sheet.getColumn(7).numFmt = '#,##0.0'
  sheet.getColumn(8).numFmt = '#,##0.0'

  const headers = ['Week Start', 'Week End', 'Shift', 'Attendant ID', 'Attendant Name', 'Role', 'Fuel Sales (L)', 'Lub Qty', 'Notes']
  applyHeaderRow(sheet.addRow(headers), headers.length)

  rows.forEach((r, i) => {
    const row = sheet.addRow([
      r.week_start, r.week_end, r.shift, r.attendant_id,
      r.attendant_name, r.role, r.fuel_sales_litres, r.lub_qty, r.notes,
    ])
    row.height = 20
    applyDataRow(row, headers.length, i, r.shift as ShiftKey)
  })
}

function buildIndividualSheet(wb: ExcelJS.Workbook, individual: IndividualSummary[]): void {
  const sheet = wb.addWorksheet('Individual Performance')
  sheet.properties.tabColor = TAB_COLORS.individual
  setColumnWidths(sheet, [14, 22, 8, 14, 13, 14, 10, 18, 14, 14])
  freezeTopRow(sheet)
  rightAlignCols(sheet, [5, 6, 7, 8, 9, 10])
  centerAlignCols(sheet, [3])
  sheet.getColumn(5).numFmt  = '0'
  sheet.getColumn(6).numFmt  = '#,##0.0'
  sheet.getColumn(7).numFmt  = '#,##0.0'
  sheet.getColumn(8).numFmt  = '#,##0.0'
  sheet.getColumn(9).numFmt  = '#,##0.0'
  sheet.getColumn(10).numFmt = '#,##0.0'

  const headers = ['Attendant ID', 'Name', 'Shift', 'Role', 'Weeks Worked', 'Total Fuel (L)', 'Total Lub', 'Avg Weekly Fuel (L)', 'Best Week (L)', 'Worst Week (L)']
  applyHeaderRow(sheet.addRow(headers), headers.length)

  const sorted = [...individual].sort((a, b) => b.total_fuel - a.total_fuel)
  sorted.forEach((ind, i) => {
    const row = sheet.addRow([
      ind.attendant_id, ind.attendant_name, ind.shift, ind.role,
      ind.weeks_worked, ind.total_fuel, ind.total_lub,
      ind.avg_weekly_fuel, ind.best_week_fuel, ind.worst_week_fuel,
    ])
    row.height = 20
    applyDataRow(row, headers.length, i, ind.shift as ShiftKey)
    if (i === 0) row.getCell(2).font = { bold: true, size: 11 }  // top performer
  })
}

function buildShiftSheet(wb: ExcelJS.Workbook, shifts: ShiftSummary[]): void {
  const sheet = wb.addWorksheet('Shift Summary')
  sheet.properties.tabColor = TAB_COLORS.shift
  setColumnWidths(sheet, [10, 14, 10, 14, 18, 14, 14])
  freezeTopRow(sheet)
  rightAlignCols(sheet, [2, 3, 4, 5, 6, 7])
  centerAlignCols(sheet, [1])
  sheet.getColumn(2).numFmt = '#,##0.0'
  sheet.getColumn(3).numFmt = '#,##0.0'
  sheet.getColumn(4).numFmt = '#,##0.0'
  sheet.getColumn(5).numFmt = '0'
  sheet.getColumn(6).numFmt = '#,##0.0'
  sheet.getColumn(7).numFmt = '#,##0.0'

  const headers = ['Shift', 'Total Fuel (L)', 'Total Lub', 'Avg Weekly (L)', 'Active Attendants', 'Best Week (L)', 'Worst Week (L)']
  applyHeaderRow(sheet.addRow(headers), headers.length)

  const order: ShiftKey[] = ['A', 'B', 'C']
  order.forEach((shiftKey, i) => {
    const s = shifts.find((x) => x.shift === shiftKey)
    if (!s) return
    const row = sheet.addRow([
      s.shift, s.total_fuel, s.total_lub, s.avg_weekly,
      s.num_attendants, s.best_week, s.worst_week,
    ])
    row.height = 22
    applyDataRow(row, headers.length, i, shiftKey)
    row.getCell(1).font = { bold: true, size: 13 }
  })
}

function buildMonthlySheet(wb: ExcelJS.Workbook, monthly: MonthlySummaryRow[]): void {
  const sheet = wb.addWorksheet('Monthly Summary')
  sheet.properties.tabColor = TAB_COLORS.monthly
  setColumnWidths(sheet, [13, 8, 14, 14, 14, 14, 10, 14, 10])
  freezeTopRow(sheet)
  rightAlignCols(sheet, [2, 3, 4, 5, 6, 7, 8, 9])
  sheet.getColumn(2).numFmt = '0'
  sheet.getColumn(3).numFmt = '#,##0.0'
  sheet.getColumn(4).numFmt = '#,##0.0'
  sheet.getColumn(5).numFmt = '#,##0.0'
  sheet.getColumn(6).numFmt = '#,##0.0'
  sheet.getColumn(7).numFmt = '#,##0.0'
  sheet.getColumn(8).numFmt = '#,##0.0'
  sheet.getColumn(9).numFmt = '0.0"%"'

  const headers = ['Month', 'Year', 'Shift A (L)', 'Shift B (L)', 'Shift C (L)', 'Total Fuel (L)', 'Total Lub', 'MoM Change (L)', 'MoM %']
  applyHeaderRow(sheet.addRow(headers), headers.length)

  monthly.forEach((m, i) => {
    const row = sheet.addRow([
      m.month, m.year, m.shift_a, m.shift_b, m.shift_c,
      m.total, m.total_lub, m.mom_change, m.mom_pct,
    ])
    row.height = 20
    applyDataRow(row, headers.length, i)

    const changeCell = row.getCell(8)
    const pctCell    = row.getCell(9)
    if (m.mom_change > 0) {
      changeCell.font = { color: { argb: C.positive }, bold: true }
      pctCell.font    = { color: { argb: C.positive }, bold: true }
    } else if (m.mom_change < 0) {
      changeCell.font = { color: { argb: C.negative }, bold: true }
      pctCell.font    = { color: { argb: C.negative }, bold: true }
    }
  })
}

// ── Handler ───────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string { return d.toISOString().split('T')[0] }

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')
  const year  = searchParams.get('year')

  try {
    const [staffRows, salesRows] = await Promise.all([
      prisma.staffRegistry.findMany({ orderBy: { attendant_id: 'asc' } }),
      prisma.weeklySales.findMany({ orderBy: { week_start: 'asc' } }),
    ])

    const staff: StaffMember[] = staffRows.map((s: DbStaffRow) => ({
      attendant_id:   s.attendant_id,
      attendant_name: s.attendant_name,
      shift:          s.shift,
      role:           s.role,
      start_date:     toDateStr(s.start_date),
      status:         s.status,
    }))

    const allRows: WeeklyRow[] = salesRows.map((r: DbSalesRow) => ({
      week_start:        toDateStr(r.week_start),
      week_end:          toDateStr(r.week_end),
      shift:             r.shift,
      attendant_id:      r.attendant_id,
      attendant_name:    staffRows.find((s: DbStaffRow) => s.attendant_id === r.attendant_id)?.attendant_name ?? '',
      role:              staffRows.find((s: DbStaffRow) => s.attendant_id === r.attendant_id)?.role ?? '',
      fuel_sales_litres: r.fuel_sales_litres,
      lub_qty:           r.lub_qty,
      notes:             r.notes,
    }))

    const filteredRows = (month && year)
      ? allRows.filter((r) => {
          const d = new Date(r.week_start)
          return MONTHS[d.getMonth()] === month && d.getFullYear() === Number(year)
        })
      : allRows

    const label = month && year ? `${month} ${year}` : 'All Time'

    const overview   = computeOverview(filteredRows, staff)
    const individual = computeIndividual(filteredRows, staff)
    const monthly    = computeMonthlySummary(filteredRows)
    const shifts     = computeShiftSummary(filteredRows, staff)

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Bunda Turnoff Sales Dashboard'
    workbook.created = new Date()

    buildSummarySheet(workbook, overview, label, filteredRows.length, staff.length)
    buildWeeklySheet(workbook, filteredRows)
    buildIndividualSheet(workbook, individual)
    buildShiftSheet(workbook, shifts)
    buildMonthlySheet(workbook, monthly)

    const buffer   = await workbook.xlsx.writeBuffer()
    const filename = `BundaTurnoff_Report_${label.replace(' ', '_')}.xlsx`

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to generate Excel report' }, { status: 500 })
  }
}
