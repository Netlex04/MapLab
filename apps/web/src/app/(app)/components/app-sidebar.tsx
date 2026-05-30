'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Compass, LogOut } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { cn } from '@/lib/utils'
import { logout } from '@/app/actions/auth'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/explore',   label: 'Explore',   Icon: Compass },
]

export function AppSidebar({ user }: { user: User }) {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-border bg-card">
      {/* Wordmark */}
      <div className="flex h-14 items-center border-b border-border px-5">
        <Link
          href="/dashboard"
          className="font-display text-lg font-bold uppercase tracking-widest"
        >
          Map<span className="text-primary">Lab</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 p-3">
        {navItems.map(({ href, label, Icon }) => {
          const active =
            pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 rounded px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-border p-3">
        <div className="mb-1 flex items-center gap-2.5 rounded px-3 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary">
            {user.email?.[0]?.toUpperCase() ?? '?'}
          </div>
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {user.email}
          </span>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="size-3.5 shrink-0" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  )
}
