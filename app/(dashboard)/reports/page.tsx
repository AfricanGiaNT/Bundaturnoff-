'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Download, FileSpreadsheet, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { MonthlySummaryRow, IndividualSummary } from '@/lib/types'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function fmt(n: number) { return n.toLocaleString('en-US', { maximumFractionDigits: 1 }) }
function pct(n: number) { return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%` }

interface ReportData {
  monthly: MonthlySummaryRow[]
  individual: IndividualSummary[]
  allMonths: MonthlySummaryRow[]
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [selectedYear, setSelectedYear] = useState('')
  const [availableMonths, setAvailableMonths] = useState<MonthlySummaryRow[]>([])
  const [downloading, setDownloading] = useState<'excel' | null>(null)

  // Load all available months on mount
  useEffect(() => {
    fetch('/api/reports/monthly')
      .then((r) => r.json())
      .then((d: ReportData) => {
        setAvailableMonths(d.allMonths)
        // Default to the most recent month
        if (d.allMonths.length > 0) {
          const last = d.allMonths[d.allMonths.length - 1]
          setSelectedMonth(last.month)
          setSelectedYear(String(last.year))
        }
      })
  }, [])

  // Load report when month/year changes
  useEffect(() => {
    if (!selectedMonth || !selectedYear) return
    setLoading(true)
    fetch(`/api/reports/monthly?month=${selectedMonth}&year=${selectedYear}`)
      .then((r) => r.json())
      .then((d: ReportData) => { setData(d); setLoading(false) })
  }, [selectedMonth, selectedYear])

  async function downloadExcel() {
    setDownloading('excel')
    const params = selectedMonth && selectedYear
      ? `?month=${selectedMonth}&year=${selectedYear}`
      : ''
    const res = await fetch(`/api/reports/excel${params}`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `BundaTurnoff_Report_${selectedMonth || 'AllTime'}_${selectedYear || ''}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    setDownloading(null)
  }

  const uniqueYears = [...new Set(availableMonths.map((m) => m.year))].sort((a, b) => b - a)
  const monthReport = data?.monthly[0]
  const shiftColors: Record<string, string> = { A: 'bg-blue-500', B: 'bg-green-500', C: 'bg-amber-500' }

  return (
    <div>
      <Header title="Reports" />
      <div className="p-6 space-y-6">
        {/* Month selector + download buttons */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Month</label>
                <Select value={selectedMonth} onValueChange={(v) => setSelectedMonth(v ?? '')}>
                  <SelectTrigger className="w-36"><SelectValue placeholder="Month" /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Year</label>
                <Select value={selectedYear} onValueChange={(v) => setSelectedYear(v ?? '')}>
                  <SelectTrigger className="w-28"><SelectValue placeholder="Year" /></SelectTrigger>
                  <SelectContent>
                    {uniqueYears.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pb-0.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadExcel}
                  disabled={downloading === 'excel'}
                  className="gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                  {downloading === 'excel' ? 'Downloading...' : 'Download Excel'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const params = ''
                    const url = `/api/reports/excel${params}`
                    window.open(url, '_blank')
                  }}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  All-Time Export
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly KPI summary cards */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16" /></CardContent></Card>
            ))}
          </div>
        ) : monthReport ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground">Total Fuel Sales</p>
                  <p className="text-2xl font-bold mt-1">{fmt(monthReport.total)} L</p>
                  <div className="flex items-center gap-1 mt-1">
                    {monthReport.mom_change >= 0
                      ? <TrendingUp className="h-3 w-3 text-green-500" />
                      : <TrendingDown className="h-3 w-3 text-red-500" />}
                    <span className={`text-xs ${monthReport.mom_change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {pct(monthReport.mom_pct)} vs last month
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground">Total Lub Qty</p>
                  <p className="text-2xl font-bold mt-1">{fmt(monthReport.total_lub)}</p>
                  <p className="text-xs text-muted-foreground mt-1">units</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground">MoM Change</p>
                  <p className={`text-2xl font-bold mt-1 ${monthReport.mom_change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {monthReport.mom_change >= 0 ? '+' : ''}{fmt(monthReport.mom_change)} L
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground">Shift Breakdown</p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {(['A','B','C'] as const).map((s) => (
                      <div key={s} className="text-center">
                        <div className={`w-2 h-2 rounded-full mx-auto mb-0.5 ${shiftColors[s]}`} />
                        <p className="text-xs font-medium">{s}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmt(monthReport[`shift_${s.toLowerCase() as 'a'|'b'|'c'}`])}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Individual performance table */}
            <Card>
              <CardHeader><CardTitle className="text-base">Attendant Performance — {selectedMonth} {selectedYear}</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Shift</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right">Weeks</TableHead>
                        <TableHead className="text-right">Total Fuel (L)</TableHead>
                        <TableHead className="text-right">Avg/Week (L)</TableHead>
                        <TableHead className="text-right">Best Week (L)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.individual
                        .sort((a, b) => b.total_fuel - a.total_fuel)
                        .map((row) => (
                          <TableRow key={row.attendant_id}>
                            <TableCell className="font-medium">{row.attendant_name}</TableCell>
                            <TableCell>
                              <Badge variant={row.shift === 'A' ? 'default' : row.shift === 'B' ? 'secondary' : 'outline'}>
                                {row.shift}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{row.role}</TableCell>
                            <TableCell className="text-right">{row.weeks_worked}</TableCell>
                            <TableCell className="text-right font-medium">{fmt(row.total_fuel)}</TableCell>
                            <TableCell className="text-right">{fmt(row.avg_weekly_fuel)}</TableCell>
                            <TableCell className="text-right">{fmt(row.best_week_fuel)}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Historical monthly table */}
            <Card>
              <CardHeader><CardTitle className="text-base">Monthly History</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Shift A (L)</TableHead>
                        <TableHead className="text-right">Shift B (L)</TableHead>
                        <TableHead className="text-right">Shift C (L)</TableHead>
                        <TableHead className="text-right font-semibold">Total (L)</TableHead>
                        <TableHead className="text-right">Lub</TableHead>
                        <TableHead className="text-right">MoM %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {availableMonths.slice().reverse().map((m) => (
                        <TableRow
                          key={`${m.month}-${m.year}`}
                          className={m.month === selectedMonth && m.year === Number(selectedYear) ? 'bg-muted/50' : ''}
                        >
                          <TableCell className="font-medium">{m.month} {m.year}</TableCell>
                          <TableCell className="text-right">{fmt(m.shift_a)}</TableCell>
                          <TableCell className="text-right">{fmt(m.shift_b)}</TableCell>
                          <TableCell className="text-right">{fmt(m.shift_c)}</TableCell>
                          <TableCell className="text-right font-semibold">{fmt(m.total)}</TableCell>
                          <TableCell className="text-right">{fmt(m.total_lub)}</TableCell>
                          <TableCell className="text-right">
                            <span className={m.mom_pct >= 0 ? 'text-green-600' : 'text-red-500'}>
                              {m.mom_pct !== 0 ? pct(m.mom_pct) : <Minus className="h-3 w-3 inline" />}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <p>Select a month to view the report</p>
          </div>
        )}
      </div>
    </div>
  )
}
