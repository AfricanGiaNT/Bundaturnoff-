import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react'

export interface Alert {
  type: string
  severity: 'red' | 'amber'
  count: number
  label: string
  action_href?: string
}

interface Props {
  alerts: Alert[]
}

const SEVERITY_STYLES = {
  red:   'bg-destructive/10 text-destructive border border-destructive/20',
  amber: 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700/40',
}

export function AlertStrip({ alerts }: Props) {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-700/40 w-fit">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span className="text-sm font-medium">All clear — no active alerts</span>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Action Items</p>
      <div className="flex flex-wrap gap-2">
        {alerts.map((alert) => {
          const chip = (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${SEVERITY_STYLES[alert.severity]}`}>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{alert.label}</span>
              {alert.action_href && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />}
            </div>
          )
          return alert.action_href ? (
            <Link key={alert.type} href={alert.action_href}>{chip}</Link>
          ) : (
            <div key={alert.type}>{chip}</div>
          )
        })}
      </div>
    </div>
  )
}
