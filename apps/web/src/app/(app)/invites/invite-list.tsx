'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Bell, Check, X } from 'lucide-react'
import { respondToInvite, type PendingInviteRow, type CollaboratorRole } from '@/app/actions/collaborators'

function RoleBadge({ role }: { role: CollaboratorRole }) {
  const cls = role === 'EDITOR' ? 'text-cyan-400 bg-cyan-400/10' : 'text-muted-foreground bg-secondary'
  return (
    <span className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${cls}`}>
      {role === 'EDITOR' ? 'Editor' : 'Viewer'}
    </span>
  )
}

function InviteCard({
  invite,
  onResponded,
}: {
  invite: PendingInviteRow
  onResponded: (id: string) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function handleRespond(accept: boolean) {
    startTransition(async () => {
      const result = await respondToInvite(invite.id, accept)
      if (result && 'error' in result) {
        setError(result.error)
        return
      }
      onResponded(invite.id)
      if (accept) router.push(`/projects/${invite.projectId}`)
    })
  }

  const ownerSlug = invite.ownerUsername ?? 'unknown'

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-yellow-400/10">
        <Bell className="size-5 text-yellow-400" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground truncate">{invite.projectName}</p>
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">
          invited by <span className="text-foreground/70">{ownerSlug}</span>
        </p>
        {error && <p className="mt-1 font-mono text-[11px] text-red-400">{error}</p>}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <RoleBadge role={invite.role} />
        <button
          onClick={() => handleRespond(false)}
          disabled={isPending}
          title="Decline"
          className="flex h-7 w-7 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:border-red-400/50 hover:bg-red-400/10 hover:text-red-400 disabled:opacity-40"
        >
          <X className="size-3.5" />
        </button>
        <button
          onClick={() => handleRespond(true)}
          disabled={isPending}
          title="Accept"
          className="flex h-7 w-7 items-center justify-center rounded border border-green-400/30 bg-green-400/10 text-green-400 transition-colors hover:bg-green-400/20 disabled:opacity-40"
        >
          <Check className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

export function InviteList({ initialInvites }: { initialInvites: PendingInviteRow[] }) {
  const [invites, setInvites] = useState(initialInvites)

  function handleResponded(id: string) {
    setInvites((prev) => prev.filter((i) => i.id !== id))
  }

  if (invites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center">
        <div className="mb-4 font-mono text-4xl text-muted-foreground/20">✓</div>
        <h3 className="mb-1 font-semibold text-foreground">All caught up</h3>
        <p className="mb-6 max-w-xs text-sm text-muted-foreground">
          No pending invitations.
        </p>
        <Link
          href="/dashboard"
          className="rounded bg-secondary px-4 py-2 text-sm font-semibold text-foreground transition-opacity hover:opacity-80"
        >
          Back to Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {invites.map((invite) => (
        <InviteCard key={invite.id} invite={invite} onResponded={handleResponded} />
      ))}
    </div>
  )
}
