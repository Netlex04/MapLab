'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { GitFork, Heart, MessageSquare, Search, GitCommitHorizontal } from 'lucide-react'
import {
  getPublicProjects,
  toggleLike,
  type ExploreProject,
  type ExploreSortOrder,
} from '@/app/actions/community'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'gerade eben'
  if (m < 60) return `vor ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `vor ${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `vor ${d}d`
  return date.toLocaleDateString('de', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Avatar({ username, avatarUrl }: { username: string | null; avatarUrl: string | null }) {
  const initials = (username ?? '?')[0]?.toUpperCase() ?? '?'
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={username ?? ''}
        width={24}
        height={24}
        className="size-6 rounded-full object-cover"
      />
    )
  }
  return (
    <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center font-mono text-[10px] font-bold text-primary shrink-0">
      {initials}
    </div>
  )
}

// ─── Project Card ─────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  onLike,
  liking,
}: {
  project: ExploreProject
  onLike: (id: string) => void
  liking: boolean
}) {
  return (
    <div className="group flex flex-col rounded-xl border border-border bg-card transition-all hover:border-border/60 hover:shadow-md overflow-hidden">

      {/* Card body — clickable */}
      <Link href={`/projects/${project.id}`} className="flex-1 flex flex-col p-5">

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {project.ecuType && (
            <span className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {project.ecuType}
            </span>
          )}
          {project.stage && (
            <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
              {project.stage}
            </span>
          )}
          {project.fuelType && (
            <span className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {project.fuelType}
            </span>
          )}
          {project.forkOfId && (
            <span className="rounded-sm bg-cyan-400/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-cyan-400">
              fork
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors leading-snug mb-1">
          {project.name}
        </h3>

        {/* Owner */}
        <div className="flex items-center gap-1.5 mb-3">
          <Avatar username={project.owner.username} avatarUrl={project.owner.avatarUrl} />
          <span className="font-mono text-[11px] text-muted-foreground">
            {project.owner.username ?? 'anonymous'}
          </span>
        </div>

        {/* Description */}
        {project.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {project.description}
          </p>
        )}

        {/* Stats */}
        <div className="mt-auto flex items-center gap-4 text-xs text-muted-foreground font-mono">
          <span className="flex items-center gap-1">
            <GitCommitHorizontal className="size-3" />
            {project.commitCount}
          </span>
          <span className="flex items-center gap-1">
            <GitFork className="size-3" />
            {project.forkCount}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="size-3" />
            {project.commentCount}
          </span>
          <span className="ml-auto">{formatRelative(project.updatedAt)}</span>
        </div>
      </Link>

      {/* Like footer — separate from link */}
      <div className="flex items-center justify-between border-t border-border px-5 py-2.5 bg-secondary/20">
        <button
          onClick={() => onLike(project.id)}
          disabled={liking}
          className={[
            'flex items-center gap-1.5 font-mono text-xs transition-colors',
            project.viewerHasLiked
              ? 'text-pink-400 hover:text-pink-300'
              : 'text-muted-foreground hover:text-foreground',
          ].join(' ')}
        >
          <Heart
            className={['size-3.5 transition-all', project.viewerHasLiked ? 'fill-pink-400' : ''].join(' ')}
          />
          {project.likeCount}
        </button>
      </div>
    </div>
  )
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

function SelectFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded border border-border bg-card px-2.5 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )
}

const SORT_OPTIONS: { value: ExploreSortOrder; label: string }[] = [
  { value: 'newest', label: 'Neueste' },
  { value: 'most_liked', label: 'Meiste Likes' },
  { value: 'most_forked', label: 'Meiste Forks' },
]

// ─── Main Component ───────────────────────────────────────────────────────────

interface ExploreClientProps {
  initialProjects: ExploreProject[]
  ecuTypes: string[]
  stages: string[]
  fuelTypes: string[]
}

export function ExploreClient({
  initialProjects,
  ecuTypes,
  stages,
  fuelTypes,
}: ExploreClientProps) {
  const [projects, setProjects] = useState<ExploreProject[]>(initialProjects)
  const [search, setSearch] = useState('')
  const [ecuType, setEcuType] = useState('')
  const [stage, setStage] = useState('')
  const [fuelType, setFuelType] = useState('')
  const [sort, setSort] = useState<ExploreSortOrder>('newest')
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  // Re-fetch whenever filters change
  function applyFilters(overrides: {
    search?: string
    ecuType?: string
    stage?: string
    fuelType?: string
    sort?: ExploreSortOrder
  }) {
    const next = {
      search: overrides.search ?? search,
      ecuType: overrides.ecuType ?? ecuType,
      stage: overrides.stage ?? stage,
      fuelType: overrides.fuelType ?? fuelType,
      sort: overrides.sort ?? sort,
    }
    startTransition(async () => {
      const filters: Parameters<typeof getPublicProjects>[0] = { sort: next.sort }
      if (next.search)   filters.search   = next.search
      if (next.ecuType)  filters.ecuType  = next.ecuType
      if (next.stage)    filters.stage    = next.stage
      if (next.fuelType) filters.fuelType = next.fuelType
      const result = await getPublicProjects(filters)
      setProjects(result)
    })
  }

  function handleSearch(v: string) {
    setSearch(v)
    applyFilters({ search: v })
  }

  function handleEcuType(v: string) {
    setEcuType(v)
    applyFilters({ ecuType: v })
  }

  function handleStage(v: string) {
    setStage(v)
    applyFilters({ stage: v })
  }

  function handleFuelType(v: string) {
    setFuelType(v)
    applyFilters({ fuelType: v })
  }

  function handleSort(v: ExploreSortOrder) {
    setSort(v)
    applyFilters({ sort: v })
  }

  function handleLike(projectId: string) {
    if (likingIds.has(projectId)) return
    setLikingIds((s) => new Set(s).add(projectId))

    // Optimistic toggle
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? {
              ...p,
              viewerHasLiked: !p.viewerHasLiked,
              likeCount: p.viewerHasLiked ? p.likeCount - 1 : p.likeCount + 1,
            }
          : p,
      ),
    )

    toggleLike(projectId)
      .then((result) => {
        setProjects((prev) =>
          prev.map((p) =>
            p.id === projectId
              ? { ...p, viewerHasLiked: result.liked, likeCount: result.likeCount }
              : p,
          ),
        )
      })
      .catch(() => {
        // Revert optimistic update on failure
        setProjects((prev) =>
          prev.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  viewerHasLiked: !p.viewerHasLiked,
                  likeCount: p.viewerHasLiked ? p.likeCount + 1 : p.likeCount - 1,
                }
              : p,
          ),
        )
      })
      .finally(() => {
        setLikingIds((s) => {
          const next = new Set(s)
          next.delete(projectId)
          return next
        })
      })
  }

  const activeFilterCount = [ecuType, stage, fuelType].filter(Boolean).length

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">

      {/* Header */}
      <div className="mb-8">
        <p className="font-mono text-label uppercase tracking-widest text-muted-foreground">
          Community
        </p>
        <h1 className="font-display text-3xl font-bold uppercase tracking-wider">
          Explore
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Öffentliche ECU-Tunes der Community.
        </p>
      </div>

      {/* Filter bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Projekte suchen…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="h-8 w-full rounded border border-border bg-card pl-8 pr-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {ecuTypes.length > 0 && (
          <SelectFilter
            label="ECU-Typ"
            value={ecuType}
            options={ecuTypes}
            onChange={handleEcuType}
          />
        )}

        {stages.length > 0 && (
          <SelectFilter
            label="Stage"
            value={stage}
            options={stages}
            onChange={handleStage}
          />
        )}

        {fuelTypes.length > 0 && (
          <SelectFilter
            label="Kraftstoff"
            value={fuelType}
            options={fuelTypes}
            onChange={handleFuelType}
          />
        )}

        {/* Sort */}
        <div className="ml-auto flex items-center gap-1">
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => handleSort(o.value)}
              className={[
                'h-8 rounded px-3 font-mono text-xs transition-colors',
                sort === o.value
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              ].join(' ')}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Active filter indicator */}
        {activeFilterCount > 0 && (
          <button
            onClick={() => {
              setEcuType('')
              setStage('')
              setFuelType('')
              applyFilters({ ecuType: '', stage: '', fuelType: '' })
            }}
            className="h-8 flex items-center gap-1.5 rounded px-2.5 font-mono text-xs text-amber-400 hover:bg-amber-400/10 transition-colors"
          >
            ✕ {activeFilterCount} Filter
          </button>
        )}
      </div>

      {/* Results */}
      {isPending ? (
        <div className="flex justify-center py-20">
          <div className="flex gap-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="size-2 rounded-full bg-amber-400 animate-bounce"
                style={{ animationDelay: `${i * 120}ms` }}
              />
            ))}
          </div>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="mb-4 font-mono text-4xl text-muted-foreground/20">⬡</div>
          <h3 className="mb-1 font-semibold text-foreground">Keine Projekte gefunden</h3>
          <p className="text-sm text-muted-foreground">
            Versuche andere Suchbegriffe oder Filter.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-4 font-mono text-label text-muted-foreground">
            {projects.length} {projects.length === 1 ? 'Projekt' : 'Projekte'}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onLike={handleLike}
                liking={likingIds.has(p.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
