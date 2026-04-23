import { Badge } from '@/components/ui/badge'

export interface KPIBreakdownRow {
  label: string
  weight: number
  actual: number | null
  target: number | null
  lowerIsBetter?: boolean
  unit?: string
  evidence_note?: string | null
}

interface Props {
  rows: KPIBreakdownRow[]
}

function rowColor(actual: number, target: number, lowerIsBetter = false): string {
  if (target === 0) return 'text-muted-foreground'
  const pct = lowerIsBetter ? (target / actual) * 100 : (actual / target) * 100
  if (pct >= 100) return 'text-green-600 dark:text-green-400'
  if (pct >= 80)  return 'text-amber-600 dark:text-amber-400'
  return 'text-destructive'
}

function rowScore(actual: number, target: number, weight: number, lowerIsBetter = false): number {
  if (target === 0) return 0
  const ratio = lowerIsBetter
    ? Math.min(target / actual, 1)
    : Math.min(actual / target, 1)
  return Math.round(ratio * weight * 100 * 10) / 10
}

export function KPIBreakdown({ rows }: Props) {
  return (
    <div className="mt-3 border-t pt-3 space-y-2">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">KPI Breakdown</p>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="text-xs space-y-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground flex-1 truncate">{row.label}</span>
              <span className="text-muted-foreground shrink-0 text-[10px]">{Math.round(row.weight * 100)}%</span>
              {row.actual != null && row.target != null ? (
                <span className={`font-medium shrink-0 ${rowColor(row.actual, row.target, row.lowerIsBetter)}`}>
                  {row.actual}{row.unit ?? ''} / {row.target}{row.unit ?? ''}
                  {' '}
                  <span className="text-[10px] text-muted-foreground">
                    ({rowScore(row.actual, row.target, row.weight, row.lowerIsBetter).toFixed(1)} pts)
                  </span>
                </span>
              ) : (
                <Badge variant="outline" className="text-[10px] h-4">No data</Badge>
              )}
            </div>
            {row.evidence_note && (
              <p className="text-[10px] text-muted-foreground pl-1 italic">{row.evidence_note}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
