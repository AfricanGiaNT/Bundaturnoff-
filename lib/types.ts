export interface WeeklyRow {
  week_start: string // ISO date string YYYY-MM-DD
  week_end: string
  shift: string
  attendant_id: string
  attendant_name: string
  role: string
  fuel_sales_litres: number
  lub_qty: number
  notes: string
}

export interface StaffMember {
  attendant_id: string
  attendant_name: string
  shift: string
  role: string
  start_date: string
  status: string
}

export interface OverviewKPIs {
  total_fuel_sales: number
  total_lub_qty: number
  best_attendant: { name: string; total: number }
  best_shift: { shift: string; total: number }
  active_staff: number
  recent_weeks: RecentWeekRow[]
}

export interface RecentWeekRow {
  week_start: string
  week_end: string
  shift_a: number
  shift_b: number
  shift_c: number
  total: number
}

export interface IndividualSummary {
  attendant_id: string
  attendant_name: string
  shift: string
  role: string
  weeks_worked: number
  total_fuel: number
  total_lub: number
  avg_weekly_fuel: number
  best_week_fuel: number
  worst_week_fuel: number
}

export interface ShiftSummary {
  shift: string
  total_fuel: number
  total_lub: number
  avg_weekly: number
  num_attendants: number
  best_week: number
  worst_week: number
}

export interface WeeklySummaryRow {
  week_start: string
  week_end: string
  shift_a: number
  shift_b: number
  shift_c: number
  total: number
  total_lub: number
  wow_change: number
  wow_pct: number
}

export interface POSStats {
  total_count: number
  total_amount: number
  unique_cards: number
  date_from: string | null
  date_to: string | null
  months: string[]
  month_counts: Record<string, number>
}

export interface POSTransaction {
  id: number
  card_number: string
  card_last4: string
  amount: number
  datetime_local: string
  datetime_gmt: string
  terminal_id: string
  switch_key: string
  account_no: string | null
  sheet_month: string
}

export interface POSCustomerSummary {
  card_number: string
  card_last4: string
  transaction_count: number
  total_amount: number
  first_seen: string
  last_seen: string
}

export interface MonthlySummaryRow {
  month: string
  year: number
  shift_a: number
  shift_b: number
  shift_c: number
  total: number
  total_lub: number
  mom_change: number
  mom_pct: number
}
