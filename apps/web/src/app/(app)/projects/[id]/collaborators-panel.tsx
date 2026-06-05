'use client'

import { useState, useEffect, useRef, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Users, UserPlus, X, ChevronDown, LogOut } from 'lucide-react'
import {
  inviteCollaborator,
  removeCollaborator,
  updateCollaboratorRole,
  leaveProject,
  type CollaboratorRow,
  type CollaboratorRole,
} from '@/app/actions/collaborators'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CollaboratorsPanelProps {
  projectId: string
  initialCollaborators: CollaboratorRow[]
  isOwner: boolean
  currentUserId: string
}

interface UserSearchResult {
  id: string
  username: string | null
  avatarUrl: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function UserAvatar({
  username,
  avatarUrl,
  size = 'sm',
}: {
  username: string | null
  avatarUrl: string | null
  size?: 'sm' | 'md'
}) {
  const dim = size === 'sm' ? 'size-6' : 'size-8'
  const text = size === 'sm' ? 'text-[9px]' : 'text-[11px]'
  const initial = (username ?? '?')[0]?.toUpperCase() ?? '?'

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={username ?? ''}
        className={`${dim} rounded-full object-cover shrink-0`}
      />
    )
  }
  return (
    <div
      className={`${dim} rounded-full bg-primary/10 flex items-center justify-center font-mono ${text} font-bold text-primary shrink-0`}
    >
      {initial}
    </div>
  )
}

function RoleBadge({ role }: { role: CollaboratorRole }) {
  const cls =
    role === 'EDITOR'
      ? 'text-cyan-400 bg-cyan-400/10'
      : 'text-muted-foreground bg-secondary'
  return (
    <span
      className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${cls}`}
    >
      {role === 'EDITOR' ? 'Editor' : 'Viewer'}
    </span>
  )
}

// ─── Role Select (inline dropdown) ───────────────────────────────────────────

function RoleSelect({
  value,
  onChange,
  disabled,
}: {
  value: CollaboratorRole
  onChange: (role: CollaboratorRole) => void
  disabled?: boolean
}) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as CollaboratorRole)}
        disabled={disabled}
        className="appearance-none rounded-sm bg-secondary/60 pl-2 pr-6 py-0.5 font-mono text-[10px] uppercase tracking-wider text-foreground focus:outline-none focus:ring-1 focus:ring-border disabled:opacity-40 cursor-pointer"
      >
        <option value="EDITOR">Editor</option>
        <option value="VIEWER">Viewer</option>
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 size-3 text-muted-foreground" />
    </div>
  )
}

// ─── Invite Form ──────────────────────────────────────────────────────────────

function InviteForm({
  projectId,
  existingUserIds,
  onClose,
  onInvited,
}: {
  projectId: string
  existingUserIds: Set<string>
  onClose: () => void
  onInvited: (collab: CollaboratorRow) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [selected, setSelected] = useState<UserSearchResult | null>(null)
  const [role, setRole] = useState<CollaboratorRole>('EDITOR')
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const search = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (!q.trim() || q.length < 2) {
        setResults([])
        setOpen(false)
        return
      }
      debounceRef.current = setTimeout(async () => {
        setSearching(true)
        try {
          const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`)
          const data: UserSearchResult[] = await res.json()
          setResults(data.filter((u) => !existingUserIds.has(u.id)))
          setOpen(true)
        } catch {
          setResults([])
        } finally {
          setSearching(false)
        }
      }, 300)
    },
    [existingUserIds],
  )

  useEffect(() => {
    if (!selected) search(query)
  }, [query, selected, search])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(user: UserSearchResult) {
    setSelected(user)
    setQuery(user.username ?? user.id)
    setOpen(false)
    setResults([])
  }

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSelected(null)
    setQuery(e.target.value)
    setError(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected && !query.trim()) return
    setError(null)
    startTransition(async () => {
      const usernameOrEmail = selected?.username ?? query.trim()
      const result = await inviteCollaborator(projectId, usernameOrEmail, role)
      if (result && 'error' in result) {
        setError(result.error)
        return
      }
      if (result && 'id' in result) {
        setSuccess(true)
        onInvited({
          id: result.id,
          userId: selected?.id ?? '',
          username: selected?.username ?? usernameOrEmail,
          avatarUrl: selected?.avatarUrl ?? null,
          role,
          status: 'PENDING',
          invitedAt: new Date(),
        })
        setTimeout(onClose, 800)
      }
    })
  }

  return (
    <div className="border-b border-border bg-secondary/20 px-5 py-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex items-center gap-2" ref={containerRef}>
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={handleQueryChange}
              onFocus={() => results.length > 0 && setOpen(true)}
              placeholder="Username or email…"
              autoComplete="off"
              spellCheck={false}
              className={[
                'w-full rounded border bg-secondary/60 px-3 py-1.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary transition-colors',
                selected ? 'border-primary/60' : 'border-border',
              ].join(' ')}
            />
            {selected && (
              <button
                type="button"
                onClick={() => { setSelected(null); setQuery('') }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="size-3" />
              </button>
            )}

            {open && results.length > 0 && (
              <ul className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-xl overflow-hidden">
                {results.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(u)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-secondary/60 transition-colors"
                    >
                      <UserAvatar username={u.username} avatarUrl={u.avatarUrl} size="sm" />
                      <span className="font-mono text-xs text-foreground truncate">
                        {u.username ?? u.id}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {open && !searching && results.length === 0 && query.length >= 2 && !selected && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 shadow-xl">
                <span className="font-mono text-[11px] text-muted-foreground">No users found</span>
              </div>
            )}
          </div>

          <div className="relative inline-flex items-center shrink-0">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as CollaboratorRole)}
              className="appearance-none rounded border border-border bg-secondary/60 pl-2 pr-6 py-1.5 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="EDITOR">Editor</option>
              <option value="VIEWER">Viewer</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 size-3 text-muted-foreground" />
          </div>

          <button
            type="submit"
            disabled={isPending || (!selected && !query.trim())}
            className="shrink-0 rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {isPending ? 'Inviting…' : success ? 'Sent!' : 'Invite'}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {error && (
          <p className="font-mono text-[11px] text-red-400">{error}</p>
        )}
      </form>
    </div>
  )
}

// ─── Collaborator Row ─────────────────────────────────────────────────────────

function CollaboratorItem({
  collab,
  projectId,
  isOwner,
  isSelf,
  onRemoved,
  onRoleChanged,
  onLeft,
}: {
  collab: CollaboratorRow
  projectId: string
  isOwner: boolean
  isSelf: boolean
  onRemoved: (id: string) => void
  onRoleChanged: (id: string, role: CollaboratorRole) => void
  onLeft: () => void
}) {
  const [roleChanging, setRoleChanging] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleRoleChange(role: CollaboratorRole) {
    if (roleChanging) return
    setRoleChanging(true)
    setError(null)
    const result = await updateCollaboratorRole(projectId, collab.userId, role)
    if (result && 'error' in result) {
      setError(result.error)
    } else {
      onRoleChanged(collab.id, role)
    }
    setRoleChanging(false)
  }

  async function handleRemove() {
    if (removing) return
    setRemoving(true)
    setError(null)
    const result = await removeCollaborator(projectId, collab.userId)
    if (result && 'error' in result) {
      setError(result.error)
      setRemoving(false)
    } else {
      onRemoved(collab.id)
    }
  }

  async function handleLeave() {
    if (leaving) return
    setLeaving(true)
    setError(null)
    const result = await leaveProject(projectId)
    if (result && 'error' in result) {
      setError(result.error)
      setLeaving(false)
    } else {
      router.refresh()
      onLeft()
    }
  }

  const isPending = collab.status === 'PENDING'
  const isRejected = collab.status === 'REJECTED'
  const displayName = collab.username ?? 'Unknown'

  const statusBadge =
    collab.status === 'PENDING' ? (
      <span className="rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-yellow-400 bg-yellow-400/10">
        Pending
      </span>
    ) : collab.status === 'REJECTED' ? (
      <span className="rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-red-400/60 bg-red-400/5">
        Declined
      </span>
    ) : null

  return (
    <div
      className={[
        'flex items-center gap-3 px-5 py-3 transition-opacity',
        isPending || isRejected ? 'opacity-50' : '',
      ].join(' ')}
    >
      <UserAvatar username={collab.username} avatarUrl={collab.avatarUrl} size="md" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs font-semibold text-foreground truncate">
            {displayName}
          </span>
          {statusBadge}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isOwner && collab.status === 'ACCEPTED' ? (
          <RoleSelect
            value={collab.role}
            onChange={handleRoleChange}
            disabled={roleChanging}
          />
        ) : (
          <RoleBadge role={collab.role} />
        )}

        {isOwner && (
          <button
            onClick={handleRemove}
            disabled={removing}
            className="rounded px-2 py-1 font-mono text-[10px] text-red-400/70 bg-red-400/0 hover:bg-red-400/10 hover:text-red-400 transition-colors disabled:opacity-40"
          >
            {removing ? '…' : 'Remove'}
          </button>
        )}

        {isSelf && !isOwner && (
          <button
            onClick={handleLeave}
            disabled={leaving}
            className="inline-flex items-center gap-1 rounded px-2 py-1 font-mono text-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
          >
            <LogOut className="size-3" />
            {leaving ? '…' : 'Leave'}
          </button>
        )}
      </div>

      {error && (
        <p className="w-full font-mono text-[11px] text-red-400 col-span-full">{error}</p>
      )}
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function CollaboratorsPanel({
  projectId,
  initialCollaborators,
  isOwner,
  currentUserId,
}: CollaboratorsPanelProps) {
  const [collaborators, setCollaborators] = useState<CollaboratorRow[]>(initialCollaborators)
  const [inviteOpen, setInviteOpen] = useState(false)

  const acceptedCount = collaborators.filter((c) => c.status === 'ACCEPTED').length
  const existingUserIds = new Set(collaborators.map((c) => c.userId))

  function handleInvited(collab: CollaboratorRow) {
    setCollaborators((prev) => [...prev, collab])
  }

  function handleRemoved(id: string) {
    setCollaborators((prev) => prev.filter((c) => c.id !== id))
  }

  function handleRoleChanged(id: string, role: CollaboratorRole) {
    setCollaborators((prev) =>
      prev.map((c) => (c.id === id ? { ...c, role } : c)),
    )
  }

  function handleLeft() {
    setCollaborators((prev) => prev.filter((c) => c.userId !== currentUserId))
  }

  const isEmpty = collaborators.length === 0

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <Users className="size-4 text-muted-foreground/50 shrink-0" />
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          Collaborators
        </p>
        <span className="font-mono text-[11px] text-muted-foreground/60 ml-1">
          · {acceptedCount}
        </span>
        {isOwner && (
          <button
            onClick={() => setInviteOpen((v) => !v)}
            className={[
              'ml-auto inline-flex items-center gap-1.5 rounded px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider font-semibold transition-colors',
              inviteOpen
                ? 'bg-primary/10 text-primary'
                : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80',
            ].join(' ')}
          >
            <UserPlus className="size-3" />
            Invite
          </button>
        )}
      </div>

      {/* Invite form */}
      {isOwner && inviteOpen && (
        <InviteForm
          projectId={projectId}
          existingUserIds={existingUserIds}
          onClose={() => setInviteOpen(false)}
          onInvited={handleInvited}
        />
      )}

      {/* List */}
      {isEmpty ? (
        isOwner ? (
          <div className="px-5 py-10 text-center">
            <p className="font-mono text-xs text-muted-foreground/50">No collaborators yet.</p>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground/30">
              Invite someone to get started.
            </p>
          </div>
        ) : null
      ) : (
        <div className="divide-y divide-border/40">
          {collaborators.map((c) => (
            <CollaboratorItem
              key={c.id}
              collab={c}
              projectId={projectId}
              isOwner={isOwner}
              isSelf={c.userId === currentUserId}
              onRemoved={handleRemoved}
              onRoleChanged={handleRoleChanged}
              onLeft={handleLeft}
            />
          ))}
        </div>
      )}
    </div>
  )
}
