'use client'

import { usePathname } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { AppSidebar } from './app-sidebar'

const EDITOR_PATTERN = /\/projects\/[^/]+\/editor/

export function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  const pathname = usePathname()
  const isEditor = EDITOR_PATTERN.test(pathname)

  if (isEditor) return <>{children}</>

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar user={user} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
