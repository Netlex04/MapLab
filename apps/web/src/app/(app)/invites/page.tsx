import Link from 'next/link'
import { getPendingInvites } from '@/app/actions/collaborators'
import { InviteList } from './invite-list'

export default async function InvitesPage() {
  const invites = await getPendingInvites()

  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 font-mono text-label uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Dashboard
      </Link>

      <div className="mb-8">
        <p className="font-mono text-label uppercase tracking-widest text-muted-foreground">
          Pending
        </p>
        <h1 className="font-display text-3xl font-bold uppercase tracking-wider">
          Invitations
        </h1>
        {invites.length > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            {invites.length} pending {invites.length === 1 ? 'invitation' : 'invitations'}
          </p>
        )}
      </div>

      <InviteList initialInvites={invites} />
    </div>
  )
}
