'use client'

import { useEffect, useState, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { NotificationPanel } from '@/components/layout/NotificationPanel'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CommandCentre } from '@/components/work/CommandCentre'
import { isManagerLevel } from '@/lib/roles'
import { getQuarterFromMonth } from '@/lib/kpi-weights'
import type { DashboardSummary } from '@/lib/types'

interface CurrentUser {
  id: number
  role: string
  display_name: string
  username: string
}

export default function CommandCentrePage() {
  const now = new Date()
  const [currentUser, setCurrentUser]   = useState<CurrentUser | null>(null)
  const [summary, setSummary]           = useState<DashboardSummary | null>(null)
  const [loading, setLoading]           = useState(true)
  const [authDone, setAuthDone]         = useState(false)
  const [selectedQuarter, setSelectedQuarter] = useState(getQuarterFromMonth(now.getMonth() + 1))
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())

  const isManager = currentUser ? isManagerLevel(currentUser.role) : false

  const loadSummary = useCallback(async (quarter: number, year: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard/summary?quarter=${quarter}&year=${year}`)
      if (res.ok) {
        const json = await res.json()
        setSummary(json.data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    async function init() {
      try {
        const meRes = await fetch('/api/auth')
        if (meRes.ok) {
          const user = (await meRes.json()).data
          setCurrentUser(user)
          if (isManagerLevel(user.role)) {
            await loadSummary(selectedQuarter, selectedYear)
          } else {
            setLoading(false)
          }
        } else {
          setLoading(false)
        }
      } catch {
        setLoading(false)
      } finally {
        setAuthDone(true)
      }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (isManager) loadSummary(selectedQuarter, selectedYear)
  }, [selectedQuarter, selectedYear, isManager, loadSummary])

  const currentYear  = now.getFullYear()
  const yearOptions  = Array.from({ length: 4 }, (_, i) => currentYear - 1 + i)

  return (
    <div>
      <Header title="Command Centre">
        <div className="flex items-center gap-2">
          {isManager && (
            <>
              <Select value={selectedQuarter.toString()} onValueChange={(v) => v && setSelectedQuarter(parseInt(v))}>
                <SelectTrigger className="h-8 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Q1</SelectItem>
                  <SelectItem value="2">Q2</SelectItem>
                  <SelectItem value="3">Q3</SelectItem>
                  <SelectItem value="4">Q4</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedYear.toString()} onValueChange={(v) => v && setSelectedYear(parseInt(v))}>
                <SelectTrigger className="h-8 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          <NotificationPanel />
        </div>
      </Header>
      <div className="p-6">
        {!authDone || loading ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        ) : !currentUser ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">Session expired. Please sign in again.</p>
          </div>
        ) : !isManager ? (
          <div className="py-12 text-center space-y-2">
            <p className="text-sm font-medium">Welcome, {currentUser.display_name}</p>
            <p className="text-sm text-muted-foreground">
              View your KPI scorecards from the KPI Scorecards section, or check the Kanban board for your assigned tasks.
            </p>
          </div>
        ) : (
          <CommandCentre summary={summary} loading={loading} />
        )}
      </div>
    </div>
  )
}
