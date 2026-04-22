'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { KPICard } from '@/components/dashboard/KPICard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Fuel, Droplets, User, Activity, Users } from 'lucide-react'
import { OverviewKPIs } from '@/lib/types'
import { format } from 'date-fns'

function fmt(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 1 })
}

export default function OverviewPage() {
  const [data, setData] = useState<OverviewKPIs | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/excel/overview')
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <Header title="Overview" />
      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))
          ) : data ? (
            <>
              <KPICard
                title="All-Time Fuel Sales"
                value={`${fmt(data.total_fuel_sales)} L`}
                icon={Fuel}
              />
              <KPICard
                title="All-Time Lub Qty"
                value={fmt(data.total_lub_qty)}
                subtitle="units"
                icon={Droplets}
              />
              <KPICard
                title="Best Attendant"
                value={data.best_attendant.name}
                subtitle={`${fmt(data.best_attendant.total)} L total`}
                icon={User}
              />
              <KPICard
                title="Best Shift"
                value={`Shift ${data.best_shift.shift}`}
                subtitle={`${fmt(data.best_shift.total)} L total`}
                icon={Activity}
              />
              <KPICard
                title="Active Staff"
                value={String(data.active_staff)}
                subtitle="attendants"
                icon={Users}
              />
            </>
          ) : null}
        </div>

        {/* Recent Weeks Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Weeks</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Week</TableHead>
                    <TableHead className="text-right">Shift A (L)</TableHead>
                    <TableHead className="text-right">Shift B (L)</TableHead>
                    <TableHead className="text-right">Shift C (L)</TableHead>
                    <TableHead className="text-right font-semibold">Total (L)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.recent_weeks.map((w) => (
                    <TableRow key={w.week_start}>
                      <TableCell className="text-sm">
                        <span className="font-medium">
                          {w.week_start ? format(new Date(w.week_start + 'T00:00:00'), 'MMM d') : ''}
                          {' – '}
                          {w.week_end ? format(new Date(w.week_end + 'T00:00:00'), 'MMM d, yyyy') : ''}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{fmt(w.shift_a)}</TableCell>
                      <TableCell className="text-right">{fmt(w.shift_b)}</TableCell>
                      <TableCell className="text-right">{fmt(w.shift_c)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(w.total)}</TableCell>
                    </TableRow>
                  ))}
                  {!data?.recent_weeks.length && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No data yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
