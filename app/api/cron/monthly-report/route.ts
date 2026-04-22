import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { prisma, type DbStaffRow, type DbSalesRow } from '@/lib/db'
import { computeMonthlySummary, computeIndividual, computeShiftSummary } from '@/lib/compute'
import { WeeklyRow, StaffMember } from '@/lib/types'
import * as XLSX from 'xlsx'

function toDateStr(d: Date): string { return d.toISOString().split('T')[0] }
function fmt(n: number) { return n.toLocaleString('en-US', { maximumFractionDigits: 1 }) }

export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)

    // Determine the previous month
    const now = new Date()
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
    const monthName = MONTHS[prevMonth.getMonth()]
    const year = prevMonth.getFullYear()

    const [staffRows, salesRows] = await Promise.all([
      prisma.staffRegistry.findMany({ orderBy: { attendant_id: 'asc' } }),
      prisma.weeklySales.findMany({ orderBy: { week_start: 'asc' } }),
    ])

    const staff: StaffMember[] = staffRows.map((s: DbStaffRow) => ({
      attendant_id: s.attendant_id, attendant_name: s.attendant_name,
      shift: s.shift, role: s.role, start_date: toDateStr(s.start_date), status: s.status,
    }))

    const allRows: WeeklyRow[] = salesRows.map((r: DbSalesRow) => ({
      week_start: toDateStr(r.week_start), week_end: toDateStr(r.week_end),
      shift: r.shift, attendant_id: r.attendant_id,
      attendant_name: staffRows.find((s: DbStaffRow) => s.attendant_id === r.attendant_id)?.attendant_name ?? '',
      role: staffRows.find((s: DbStaffRow) => s.attendant_id === r.attendant_id)?.role ?? '',
      fuel_sales_litres: r.fuel_sales_litres, lub_qty: r.lub_qty, notes: r.notes,
    }))

    const monthRows = allRows.filter((r) => {
      const d = new Date(r.week_start)
      return MONTHS[d.getMonth()] === monthName && d.getFullYear() === year
    })

    const monthly = computeMonthlySummary(allRows).find((m) => m.month === monthName && m.year === year)
    const individual = computeIndividual(monthRows, staff)
    const shifts = computeShiftSummary(monthRows, staff)

    // Build Excel attachment
    const wb = XLSX.utils.book_new()
    const weeklyData = monthRows.map((r) => ({
      'Week Start': r.week_start, 'Week End': r.week_end, 'Shift': r.shift,
      'Attendant Name': r.attendant_name, 'Role': r.role,
      'Fuel Sales (L)': r.fuel_sales_litres, 'Lub Qty': r.lub_qty, 'Notes': r.notes,
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(weeklyData), 'Weekly Data')
    const indivData = individual.map((i) => ({
      'Name': i.attendant_name, 'Shift': i.shift, 'Role': i.role,
      'Weeks Worked': i.weeks_worked, 'Total Fuel (L)': +i.total_fuel.toFixed(1),
      'Avg/Week (L)': +i.avg_weekly_fuel.toFixed(1), 'Best Week (L)': +i.best_week_fuel.toFixed(1),
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(indivData), 'Individual Performance')
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    // Build HTML email body
    const topPerformer = [...individual].sort((a, b) => b.total_fuel - a.total_fuel)[0]
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1e40af">Bunda Turnoff Sales — ${monthName} ${year} Report</h2>
        <table width="100%" cellpadding="12" style="background:#f1f5f9;border-radius:8px;margin-bottom:24px">
          <tr>
            <td align="center">
              <div style="font-size:12px;color:#64748b">Total Fuel Sales</div>
              <div style="font-size:24px;font-weight:bold">${fmt(monthly?.total ?? 0)} L</div>
              ${monthly && monthly.mom_pct !== 0 ? `<div style="font-size:12px;color:${monthly.mom_pct >= 0 ? '#16a34a' : '#dc2626'}">${monthly.mom_pct >= 0 ? '▲' : '▼'} ${Math.abs(monthly.mom_pct).toFixed(1)}% vs last month</div>` : ''}
            </td>
            <td align="center">
              <div style="font-size:12px;color:#64748b">Total Lub Qty</div>
              <div style="font-size:24px;font-weight:bold">${fmt(monthly?.total_lub ?? 0)}</div>
            </td>
            <td align="center">
              <div style="font-size:12px;color:#64748b">Top Performer</div>
              <div style="font-size:16px;font-weight:bold">${topPerformer?.attendant_name ?? '—'}</div>
              <div style="font-size:12px;color:#64748b">${fmt(topPerformer?.total_fuel ?? 0)} L</div>
            </td>
          </tr>
        </table>
        <h3 style="color:#1e40af;margin-bottom:8px">Shift Summary</h3>
        <table width="100%" cellpadding="8" border="1" style="border-collapse:collapse;margin-bottom:24px;font-size:13px">
          <tr style="background:#e2e8f0"><th>Shift</th><th>Total Fuel (L)</th><th>Total Lub</th><th>Avg/Week (L)</th></tr>
          ${shifts.map((s) => `<tr><td align="center"><b>Shift ${s.shift}</b></td><td align="right">${fmt(s.total_fuel)}</td><td align="right">${fmt(s.total_lub)}</td><td align="right">${fmt(s.avg_weekly)}</td></tr>`).join('')}
        </table>
        <h3 style="color:#1e40af;margin-bottom:8px">Individual Performance</h3>
        <table width="100%" cellpadding="8" border="1" style="border-collapse:collapse;font-size:12px">
          <tr style="background:#e2e8f0"><th>Name</th><th>Shift</th><th>Weeks</th><th>Total (L)</th><th>Avg/Week (L)</th><th>Best Week (L)</th></tr>
          ${[...individual].sort((a, b) => b.total_fuel - a.total_fuel).map((i) => `<tr><td>${i.attendant_name}</td><td align="center">${i.shift}</td><td align="center">${i.weeks_worked}</td><td align="right">${fmt(i.total_fuel)}</td><td align="right">${fmt(i.avg_weekly_fuel)}</td><td align="right">${fmt(i.best_week_fuel)}</td></tr>`).join('')}
        </table>
        <p style="color:#64748b;font-size:12px;margin-top:24px">Full report attached as Excel file.</p>
      </div>
    `

    await resend.emails.send({
      from: 'Bunda Turnoff Sales <reports@resend.dev>',
      to: process.env.REPORT_EMAIL_TO!,
      subject: `Monthly Sales Report — ${monthName} ${year}`,
      html,
      attachments: [{
        filename: `BundaTurnoff_${monthName}_${year}.xlsx`,
        content: Buffer.from(excelBuffer).toString('base64'),
      }],
    })

    return NextResponse.json({ ok: true, month: monthName, year })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to send report' }, { status: 500 })
  }
}
