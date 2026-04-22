'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Fuel, LayoutDashboard, CalendarDays, Users, TrendingUp, FileText, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

const navLinks = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/weekly', label: 'Weekly Entry', icon: CalendarDays },
  { href: '/staff', label: 'Staff', icon: Users },
  { href: '/trends', label: 'Trends', icon: TrendingUp },
  { href: '/reports', label: 'Reports', icon: FileText },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/login')
    router.refresh()
  }

  const navContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-4 py-5 border-b">
        <div className="bg-primary rounded-lg p-1.5">
          <Fuel className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="font-semibold text-sm leading-tight">Bunda Turnoff<br />Sales</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navLinks.map(({ href, label, icon: Icon }) => (
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
          <span className="font-semibold text-sm">Bunda Turnoff Sales</span>
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
