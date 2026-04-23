import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Minus, Users, CheckCircle2, AlertTriangle, XCircle, DollarSign } from 'lucide-react'
import { AlertStrip, Alert } from './AlertStrip'
import type { DashboardSummary } from '@/lib/types'

interface Props {
  summary: DashboardSummary | null
  loading: boolean
}

function TrendArrow({ delta }: { delta: number }) {
  if (delta > 0)  return <TrendingUp  className="h-4 w-4 text-green-500" />
  if (delta < 0)  return <TrendingDown className="h-4 w-4 text-destructive" />
  return <Minus className="h-4 w-4 text-muted-foreground" />
}

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: number | null
  total: number
  delta?: number
  color: string
}

function StatCard({ icon, label, value, total, delta, color }: StatCardProps) {
  const pct = total > 0 && value != null ? Math.round((value / total) * 100) : null
  return (
    <Card>
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between">
          <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
          {delta !== undefined && <TrendArrow delta={delta} />}
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold">{value ?? '—'}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          {pct != null && (
            <p className="text-xs text-muted-foreground">{pct}% of team</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function CommandCentre({ summary, loading }: Props) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-5 pb-4 px-5">
                <div className="h-16 animate-pulse bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">No summary data available.</p>
      </div>
    )
  }

  const { headcount, trend, bonus_liability, alerts } = summary

  const statCards = [
    {
      icon:  <Users className="h-5 w-5 text-blue-600" />,
      label: 'Total Active Staff',
      value: headcount.total,
      total: headcount.total,
      color: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      icon:  <CheckCircle2 className="h-5 w-5 text-green-600" />,
      label: 'On Target (≥80%)',
      value: headcount.on_target,
      total: headcount.total,
      delta: trend.on_target_delta,
      color: 'bg-green-50 dark:bg-green-900/20',
    },
    {
      icon:  <AlertTriangle className="h-5 w-5 text-amber-600" />,
      label: 'Below Target (60–79%)',
      value: headcount.below_target,
      total: headcount.total,
      delta: trend.below_target_delta,
      color: 'bg-amber-50 dark:bg-amber-900/20',
    },
    {
      icon:  <XCircle className="h-5 w-5 text-destructive" />,
      label: 'Unsatisfactory (<60%)',
      value: headcount.unsatisfactory,
      total: headcount.total,
      color: 'bg-destructive/10',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((c) => <StatCard key={c.label} {...c} />)}
      </div>

      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Quarter Bonus Liability</p>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <p className="text-2xl font-bold">
            ${bonus_liability.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </p>
          {headcount.no_data > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {headcount.no_data} employee{headcount.no_data !== 1 ? 's' : ''} have no KPI data this quarter
            </p>
          )}
        </CardContent>
      </Card>

      <AlertStrip alerts={alerts as Alert[]} />
    </div>
  )
}
