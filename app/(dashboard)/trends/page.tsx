'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { ShiftSummary, WeeklySummaryRow, MonthlySummaryRow } from '@/lib/types'
import { format } from 'date-fns'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

function fmt(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

const SHIFT_COLORS = { A: '#2563eb', B: '#16a34a', C: '#d97706' }

export default function TrendsPage() {
  const [shifts, setShifts] = useState<ShiftSummary[]>([])
  const [weekly, setWeekly] = useState<WeeklySummaryRow[]>([])
  const [monthly, setMonthly] = useState<MonthlySummaryRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/excel/shifts').then((r) => r.json()),
      fetch('/api/excel/weekly-summary').then((r) => r.json()),
      fetch('/api/excel/monthly').then((r) => r.json()),
    ]).then(([s, w, m]) => {
      setShifts(s)
      setWeekly(w)
      setMonthly(m)
      setLoading(false)
    })
  }, [])

  const lastWeek = weekly[weekly.length - 1]
  const lastMonth = monthly[monthly.length - 1]

  function TrendIcon({ val }: { val: number }) {
    if (val > 0) return <TrendingUp className="h-4 w-4 text-green-500" />
    if (val < 0) return <TrendingDown className="h-4 w-4 text-red-500" />
    return <Minus className="h-4 w-4 text-muted-foreground" />
  }

  const weeklyChartData = weekly.map((w) => ({
    week: w.week_start ? format(new Date(w.week_start + 'T00:00:00'), 'MMM d') : '',
    'Shift A': w.shift_a,
    'Shift B': w.shift_b,
    'Shift C': w.shift_c,
    Total: w.total,
  }))

  const monthlyChartData = monthly.map((m) => ({
    month: `${m.month.slice(0, 3)} ${m.year}`,
    'Shift A': m.shift_a,
    'Shift B': m.shift_b,
    'Shift C': m.shift_c,
    Total: m.total,
  }))

  const shiftChartData = shifts.map((s) => ({
    shift: `Shift ${s.shift}`,
    'Total Fuel (L)': s.total_fuel,
  }))

  return (
    <div>
      <Header title="Trends" />
      <div className="p-6 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16" /></CardContent></Card>
            ))
          ) : (
            <>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground mb-1">Last Week WoW Change</p>
                  <div className="flex items-center gap-2">
                    <TrendIcon val={lastWeek?.wow_change || 0} />
                    <span className="text-xl font-bold">
                      {lastWeek ? `${lastWeek.wow_change >= 0 ? '+' : ''}${fmt(lastWeek.wow_change)} L` : '—'}
                    </span>
                  </div>
                  {lastWeek && (
                    <p className={`text-xs mt-1 ${lastWeek.wow_pct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {lastWeek.wow_pct >= 0 ? '+' : ''}{lastWeek.wow_pct.toFixed(1)}% vs prior week
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground mb-1">Last Month MoM Change</p>
                  <div className="flex items-center gap-2">
                    <TrendIcon val={lastMonth?.mom_change || 0} />
                    <span className="text-xl font-bold">
                      {lastMonth ? `${lastMonth.mom_change >= 0 ? '+' : ''}${fmt(lastMonth.mom_change)} L` : '—'}
                    </span>
                  </div>
                  {lastMonth && (
                    <p className={`text-xs mt-1 ${lastMonth.mom_pct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {lastMonth.mom_pct >= 0 ? '+' : ''}{lastMonth.mom_pct.toFixed(1)}% vs prior month
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground mb-1">Best Shift (All-Time)</p>
                  {shifts.length > 0 && (() => {
                    const best = [...shifts].sort((a, b) => b.total_fuel - a.total_fuel)[0]
                    return (
                      <div>
                        <span className="text-xl font-bold">Shift {best.shift}</span>
                        <p className="text-xs text-muted-foreground mt-1">{fmt(best.total_fuel)} L total</p>
                      </div>
                    )
                  })()}
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Shift totals bar chart */}
        <Card>
          <CardHeader><CardTitle className="text-base">Shift Totals (All-Time)</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-48" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={shiftChartData} layout="vertical" margin={{ left: 16, right: 32 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="shift" tick={{ fontSize: 12 }} width={56} />
                  <Tooltip formatter={(v: unknown) => [`${fmt(Number(v))} L`, 'Total Fuel']} />
                  <Bar dataKey="Total Fuel (L)" fill={SHIFT_COLORS.A} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Weekly trend line chart */}
        <Card>
          <CardHeader><CardTitle className="text-base">Weekly Sales Trend</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-64" /> : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={weeklyChartData} margin={{ left: 0, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: unknown) => `${fmt(Number(v))} L`} />
                  <Legend />
                  <Line type="monotone" dataKey="Shift A" stroke={SHIFT_COLORS.A} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Shift B" stroke={SHIFT_COLORS.B} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Shift C" stroke={SHIFT_COLORS.C} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Total" stroke="#7c3aed" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Monthly breakdown bar chart */}
        <Card>
          <CardHeader><CardTitle className="text-base">Monthly Breakdown</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-64" /> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyChartData} margin={{ left: 0, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: unknown) => `${fmt(Number(v))} L`} />
                  <Legend />
                  <Bar dataKey="Shift A" fill={SHIFT_COLORS.A} stackId="a" />
                  <Bar dataKey="Shift B" fill={SHIFT_COLORS.B} stackId="a" />
                  <Bar dataKey="Shift C" fill={SHIFT_COLORS.C} stackId="a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
