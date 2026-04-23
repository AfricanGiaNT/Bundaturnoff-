'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Fuel, LayoutDashboard, CalendarDays, Users, TrendingUp, FileText, LogOut, Menu, X, CreditCard, ClipboardList, BarChart2, UserCog, MonitorCheck } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

const salesLinks = [
  { href: '/',        label: 'Overview',         icon: LayoutDashboard },
  { href: '/weekly',  label: 'Weekly Entry',     icon: CalendarDays },
  { href: '/staff',   label: 'Staff',            icon: Users },
  { href: '/trends',  label: 'Trends',           icon: TrendingUp },
  { href: '/reports', label: 'Reports',          icon: FileText },
  { href: '/pos',     label: 'POS Transactions', icon: CreditCard },
]

const worksLinks = [
  { href: '/work',         label: 'Command Centre', icon: MonitorCheck },
  { href: '/work/kanban',  label: 'Kanban Board',   icon: ClipboardList },
  { href: '/work/kpi',     label: 'KPI Scorecards', icon: BarChart2 },
  { href: '/work/team',    label: 'Team',           icon: UserCog },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isWorks = pathname.startsWith('/work')
  const activeLinks = isWorks ? worksLinks : salesLinks

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/login')
    router.refresh()
  }

  const switcher = (
    <div className="mx-3 mt-3 mb-1 flex rounded-lg border bg-muted/40 p-1 gap-1">
      <Link
        href="/"
        onClick={() => setMobileOpen(false)}
        className={cn(
          'flex-1 text-center text-xs py-1.5 rounded-md font-medium transition-colors',
          !isWorks
            ? 'bg-card shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Sales
      </Link>
      <Link
        href="/work"
        onClick={() => setMobileOpen(false)}
        className={cn(
          'flex-1 text-center text-xs py-1.5 rounded-md font-medium transition-colors',
          isWorks
            ? 'bg-card shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Works
      </Link>
    </div>
  )

  const navContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-4 py-5 border-b">
        <div className="bg-primary rounded-lg p-1.5">
          <Fuel className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="font-semibold text-sm leading-tight">
          Bunda Turnoff<br />{isWorks ? 'Works' : 'Sales'}
        </span>
      </div>
      {switcher}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {activeLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              pathname === href
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="px-3 pb-4">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-muted-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 border-r bg-card h-screen sticky top-0">
        {navContent}
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-card sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="bg-primary rounded-lg p-1">
            <Fuel className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm">
            Bunda Turnoff {isWorks ? 'Works' : 'Sales'}
          </span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)}>
          <aside className="absolute left-0 top-0 h-full w-56 bg-card border-r shadow-lg" onClick={(e) => e.stopPropagation()}>
            {navContent}
          </aside>
        </div>
      )}
    </>
  )
}
