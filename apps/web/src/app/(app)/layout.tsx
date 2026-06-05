import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPendingInvites } from '@/app/actions/collaborators'
import { AppSidebar } from './components/app-sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const pendingInvites = await getPendingInvites()

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar user={user} pendingInviteCount={pendingInvites.length} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
