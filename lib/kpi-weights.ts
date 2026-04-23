export interface KPIMetricDef {
  valueField: string
  targetField: string
  label: string
  weight: number
  lowerIsBetter?: boolean
  unit?: string
}

const MANAGER_METRICS: KPIMetricDef[] = [
  { valueField: 'team_task_completion_rate', targetField: 'target_task_completion_rate', label: 'Task Completion Rate', weight: 0.35, unit: '%' },
  { valueField: 'staff_performance_score',   targetField: 'target_staff_performance',    label: 'Staff Performance Score', weight: 0.35 },
  { valueField: 'revenue_vs_target',         targetField: 'target_revenue_vs_target',    label: 'Revenue vs Target', weight: 0.30, unit: '%' },
]

const WAREHOUSE_METRICS: KPIMetricDef[] = [
  { valueField: 'stock_accuracy_pct',    targetField: 'target_stock_accuracy_pct',    label: 'Stock Accuracy', weight: 0.40, unit: '%' },
  { valueField: 'shrinkage_losses',      targetField: 'target_shrinkage_losses',      label: 'Shrinkage Losses', weight: 0.30, lowerIsBetter: true },
  { valueField: 'stock_takes_completed', targetField: 'target_stock_takes_completed', label: 'Stock Takes Completed', weight: 0.30 },
]

export const KPI_WEIGHTS: Record<string, KPIMetricDef[]> = {
  OPERATIONS_DIRECTOR: MANAGER_METRICS,
  FUEL_MANAGER: MANAGER_METRICS,
  CONSTRUCTION_COORDINATOR: MANAGER_METRICS,
  Manager: MANAGER_METRICS, // legacy compat
  HR: [
    { valueField: 'attendance_rate',    targetField: 'target_attendance_rate',    label: 'Attendance Rate', weight: 0.40, unit: '%' },
    { valueField: 'leave_days_taken',   targetField: 'target_leave_days_taken',   label: 'Leave Days', weight: 0.20, lowerIsBetter: true },
    { valueField: 'disciplinary_count', targetField: 'target_disciplinary_count', label: 'Disciplinary Count', weight: 0.40, lowerIsBetter: true },
  ],
  ACCOUNTANT: [
    { valueField: 'reports_submitted_on_time',  targetField: 'target_reports_submitted',        label: 'Reports On Time', weight: 0.40 },
    { valueField: 'reconciliation_accuracy',    targetField: 'target_reconciliation_accuracy',  label: 'Reconciliation Accuracy', weight: 0.40, unit: '%' },
    { valueField: 'invoices_processed',         targetField: 'target_invoices_processed',       label: 'Invoices Processed', weight: 0.20 },
  ],
  Accountant: [ // legacy compat
    { valueField: 'reports_submitted_on_time',  targetField: 'target_reports_submitted',        label: 'Reports On Time', weight: 0.40 },
    { valueField: 'reconciliation_accuracy',    targetField: 'target_reconciliation_accuracy',  label: 'Reconciliation Accuracy', weight: 0.40, unit: '%' },
    { valueField: 'invoices_processed',         targetField: 'target_invoices_processed',       label: 'Invoices Processed', weight: 0.20 },
  ],
  WAREHOUSE: WAREHOUSE_METRICS,
  StorageClerk: WAREHOUSE_METRICS, // legacy compat
  QA: WAREHOUSE_METRICS, // TODO: Add QA-specific columns (sop_audit_score etc.) in future migration
  PUMP_ATTENDANT: WAREHOUSE_METRICS, // TODO: Add attendant-specific columns in future migration
  SITE_WORKER: WAREHOUSE_METRICS,   // TODO: Add worker-specific columns in future migration
}

export function calculateOverallScore(record: Record<string, unknown>, role: string): number {
  const metrics = KPI_WEIGHTS[role] ?? []
  if (metrics.length === 0) return 0

  let totalWeight = 0
  let weightedScore = 0

  for (const m of metrics) {
    const actual = record[m.valueField] as number | null | undefined
    const target = record[m.targetField] as number | null | undefined
    if (actual == null || target == null || target === 0) continue

    const ratio = m.lowerIsBetter
      ? Math.min(target / actual, 1)
      : Math.min(actual / target, 1)

    weightedScore += m.weight * ratio * 100
    totalWeight += m.weight
  }

  if (totalWeight === 0) return 0
  // Normalize in case not all metrics had data
  return Math.round((weightedScore / totalWeight) * 10) / 10
}

export function getRatingBand(score: number): 'EXCEPTIONAL' | 'ON_TARGET' | 'BELOW_TARGET' | 'UNSATISFACTORY' {
  if (score >= 95) return 'EXCEPTIONAL'
  if (score >= 80) return 'ON_TARGET'
  if (score >= 60) return 'BELOW_TARGET'
  return 'UNSATISFACTORY'
}

export function getQuarterMonths(quarter: number): number[] {
  return [1, 2, 3].map((i) => (quarter - 1) * 3 + i)
}

export function getQuarterFromMonth(month: number): number {
  return Math.ceil(month / 3)
}
