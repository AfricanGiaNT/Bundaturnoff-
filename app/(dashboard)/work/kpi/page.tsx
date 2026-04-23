'use client'

import { useEffect, useState, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { NotificationPanel } from '@/components/layout/NotificationPanel'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus } from 'lucide-react'
import { KPIScorecardGrid } from '@/components/kpi/KPIScorecardGrid'
import { KPIEntryDialog } from '@/components/kpi/KPIEntryDialog'
import type { KPIRecord } from '@/components/kpi/KPIScorecard'
import { isManagerLevel } from '@/lib/roles'
import { getQuarterFromMonth } from '@/lib/kpi-weights'

interface CurrentUser {
  id: number
  role: string
  display_name: string
  username: string
  entity?: string | null
}

interface User {
  id: number
  display_name: string
  role: string
  is_active: boolean
  username: string
}

interface PIPRecord {
  id: number
  user_id: number
  status: string
}

type ViewMode = 'monthly' | 'quarterly'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function KPIPage() {
  const now = new Date()
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [users, setUsers]             = useState<User[]>([])
  const [kpiRecords, setKpiRecords]   = useState<KPIRecord[]>([])
  const [pips, setPips]               = useState<PIPRecord[]>([])
  const [viewMode, setViewMode]       = useState<ViewMode>('monthly')
  const [selectedMonth, setSelectedMonth]     = useState(now.getMonth() + 1)
  const [selectedQuarter, setSelectedQuarter] = useState(getQuarterFromMonth(now.getMonth() + 1))
  const [selectedYear, setSelectedYear]       = useState(now.getFullYear())
  const [filterUserId, setFilterUserId]       = useState<string>('all')
  const [kpiDialogOpen, setKpiDialogOpen]     = useState(false)
  const [editingKPI, setEditingKPI]           = useState<KPIRecord | null>(null)
  const [preselectedUserId, setPreselectedUserId] = useState<number | undefined>(undefined)

  const isManager = currentUser ? isManagerLevel(currentUser.role) : false

  const loadKPIs = useCallback(async (mode: ViewMode, month: number, quarter: number, year: number) => {
    const params = mode === 'quarterly'
      ? `quarter=${quarter}&year=${year}`
      : `month=${month}&year=${year}`
    const res = await fetch(`/api/kpi?${params}`)
    if (res.ok) {
      const json = await res.json()
      setKpiRecords(json.data)
    }
  }, [])

  useEffect(() => {
    async function init() {
      const [meRes, usersRes, pipsRes] = await Promise.all([
        fetch('/api/auth'),
        fetch('/api/users'),
        fetch('/api/pip?status=ACTIVE'),
      ])
      if (meRes.ok) setCurrentUser((await meRes.json()).data)
      if (usersRes.ok) setUsers((await usersRes.json()).data ?? [])
      if (pipsRes.ok) setPips((await pipsRes.json()).data ?? [])
    }
    init()
  }, [])

  useEffect(() => {
    loadKPIs(viewMode, selectedMonth, selectedQuarter, selectedYear)
  }, [viewMode, selectedMonth, selectedQuarter, selectedYear, loadKPIs])

  function openKpiDialog(record?: KPIRecord) {
    setEditingKPI(record ?? null)
    setPreselectedUserId(undefined)
    setKpiDialogOpen(true)
  }

  function openKpiDialogForUser(userId: number) {
    setEditingKPI(null)
    setPreselectedUserId(userId)
    setKpiDialogOpen(true)
  }

  const currentYear = now.getFullYear()
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  const activeUsers = users.filter((u) => u.is_active)

  // Client-side filter
  const filteredRecords = filterUserId === 'all'
    ? kpiRecords
    : kpiRecords.filter((r) => r.user_id.toString() === filterUserId)

  const filteredUsers = filterUserId === 'all'
    ? activeUsers
    : activeUsers.filter((u) => u.id.toString() === filterUserId)

  const recordedCount  = new Set(filteredRecords.map((r) => r.user_id)).size
  const missingCount   = filteredUsers.filter((u) => !new Set(filteredRecords.map((r) => r.user_id)).has(u.id)).length

  return (
    <div>
      <Header title="KPI Scorecards">
        <NotificationPanel />
      </Header>
      <div className="p-6 space-y-4">
        {/* Controls row */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex rounded-md border overflow-hidden">
            <button
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'monthly' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              onClick={() => setViewMode('monthly')}
            >
              Monthly
            </button>
            <button
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'quarterly' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              onClick={() => setViewMode('quarterly')}
            >
              Quarterly
            </button>
          </div>

          {viewMode === 'monthly' ? (
            <Select
              value={selectedMonth.toString()}
              onValueChange={(v) => { if (v) setSelectedMonth(parseInt(v)) }}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((name, i) => (
                  <SelectItem key={i + 1} value={(i + 1).toString()}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select
              value={selectedQuarter.toString()}
              onValueChange={(v) => { if (v) setSelectedQuarter(parseInt(v)) }}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Q1</SelectItem>
                <SelectItem value="2">Q2</SelectItem>
                <SelectItem value="3">Q3</SelectItem>
                <SelectItem value="4">Q4</SelectItem>
              </SelectContent>
            </Select>
          )}

          <Select
            value={selectedYear.toString()}
            onValueChange={(v) => { if (v) setSelectedYear(parseInt(v)) }}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Employee filter — managers only */}
          {isManager && (
            <Select value={filterUserId} onValueChange={(v) => v && setFilterUserId(v)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                {activeUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id.toString()}>{u.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {isManager && (
            <Button size="sm" variant="outline" onClick={() => openKpiDialog()}>
              <Plus className="h-4 w-4 mr-1" /> Add KPI Entry
            </Button>
          )}
        </div>

        {/* Summary bar */}
        {isManager && activeUsers.length > 0 && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
            <span>
              <span className="font-semibold text-foreground">{recordedCount}</span> of{' '}
              <span className="font-semibold text-foreground">{filteredUsers.length}</span> employees have KPI data
            </span>
            {missingCount > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                {missingCount} missing
              </span>
            )}
          </div>
        )}

        <KPIScorecardGrid
          records={filteredRecords}
          users={filteredUsers}
          isManager={isManager}
          pips={pips}
          onEdit={openKpiDialog}
          onAddForUser={isManager ? openKpiDialogForUser : undefined}
        />
      </div>

      <KPIEntryDialog
        open={kpiDialogOpen}
        record={editingKPI}
        users={users}
        defaultMonth={selectedMonth}
        defaultYear={selectedYear}
        preselectedUserId={preselectedUserId}
        onClose={() => setKpiDialogOpen(false)}
        onSave={() => loadKPIs(viewMode, selectedMonth, selectedQuarter, selectedYear)}
      />
    </div>
  )
}
