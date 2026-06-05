import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  getProject,
  getBranchCommits,
  canViewProject,
  canEditProject,
  type BranchWithCount,
  type CommitRow,
  type ProjectDetail,
} from '@/app/actions/projects'
import { getComments } from '@/app/actions/community'
import { getCollaborators } from '@/app/actions/collaborators'
import { createClient } from '@/lib/supabase/server'
import { UploadDialog } from './upload-dialog'
import { LikeButton, ForkButton } from './project-actions'
import { CommentsSection } from './comments-section'
import { CollaboratorsPanel } from './collaborators-panel'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function shortHash(id: string): string {
  return id.replace(/-/g, '').slice(0, 7)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function VisibilityBadge({ v }: { v: string }) {
  const isPublic = v === 'PUBLIC'
  const isUnlisted = v === 'UNLISTED'
  return (
    <span
      className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
        isPublic
          ? 'bg-green-400/10 text-green-400'
          : isUnlisted
            ? 'bg-cyan-400/10 text-cyan-400'
            : 'bg-secondary text-muted-foreground'
      }`}
    >
      {isPublic ? 'Public' : isUnlisted ? 'Unlisted' : 'Private'}
    </span>
  )
}

function StageBadge({ stage }: { stage: string }) {
  return (
    <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
      {stage}
    </span>
  )
}

function ProjectHeader({
  project,
  isOwner,
  isEditor,
  selectedBranch,
  hasCommits,
  viewerHasLiked,
  currentUserId,
}: {
  project: ProjectDetail
  isOwner: boolean
  isEditor: boolean
  selectedBranch: BranchWithCount | undefined
  hasCommits: boolean
  viewerHasLiked: boolean
  currentUserId: string | null
}) {
  const ownerSlug = project.owner.username ?? project.ownerId.slice(0, 8)
  const canFork =
    !isOwner &&
    project.visibility !== 'PRIVATE' &&
    currentUserId !== null &&
    hasCommits

  return (
    <div className="mb-8">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 font-mono text-label uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Dashboard
      </Link>

      {/* Badges row */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <VisibilityBadge v={project.visibility} />
        {project.stage && <StageBadge stage={project.stage} />}
        {project.ecuType && (
          <span className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {project.ecuType}
          </span>
        )}
        {project.fuelType && (
          <span className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {project.fuelType}
          </span>
        )}
      </div>

      {/* Title + Actions */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-display-lg font-bold uppercase tracking-wider text-foreground">
            {project.name}
          </h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            <span className="text-foreground/60">{ownerSlug}</span>
            <span className="mx-1 text-border">/</span>
            <span>{project.name}</span>
          </p>
          {project.forkOf && (
            <p className="mt-1 font-mono text-label text-muted-foreground">
              Forked from{' '}
              <Link
                href={`/projects/${project.forkOf.id}`}
                className="text-cyan-400 hover:underline"
              >
                {project.forkOf.owner.username ?? '?'}/{project.forkOf.name}
              </Link>
            </p>
          )}
          {project.description && (
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              {project.description}
            </p>
          )}
        </div>

        {/* CTA */}
        <div className="flex items-center gap-2 shrink-0">
          {currentUserId && (
            <LikeButton
              projectId={project.id}
              initialLiked={viewerHasLiked}
              initialCount={project.likeCount}
            />
          )}
          {canFork && (
            <ForkButton projectId={project.id} forkCount={project.forkCount} />
          )}
          {hasCommits && (
            <Link
              href={`/projects/${project.id}/editor`}
              className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Open Editor
            </Link>
          )}
          {isEditor && selectedBranch && (
            <UploadDialog projectId={project.id} branchId={selectedBranch.id} />
          )}
        </div>
      </div>

      {/* Stats strip */}
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-5 font-mono text-label text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">{project.branches.length}</span>{' '}
          {project.branches.length === 1 ? 'branch' : 'branches'}
        </span>
        <span className="text-border">·</span>
        <span>
          <span className="font-semibold text-foreground">
            {project.branches.reduce((s, b) => s + b.commitCount, 0)}
          </span>{' '}
          commits
        </span>
        <span className="text-border">·</span>
        <span>
          <span className="font-semibold text-foreground">{project.forkCount}</span>{' '}
          {project.forkCount === 1 ? 'fork' : 'forks'}
        </span>
        <span className="text-border">·</span>
        <span>
          <span className="font-semibold text-foreground">{project.likeCount}</span> ★
        </span>
      </div>
    </div>
  )
}

function BranchTabs({
  branches,
  selected,
  projectId,
}: {
  branches: BranchWithCount[]
  selected: BranchWithCount | undefined
  projectId: string
}) {
  if (branches.length === 0) return null
  return (
    <div className="mb-6 flex items-center gap-1 overflow-x-auto">
      {branches.map((b) => {
        const active = b.id === selected?.id
        return (
          <Link
            key={b.id}
            href={`/projects/${projectId}?branch=${b.id}`}
            className={`flex shrink-0 items-center gap-2 rounded px-3 py-1.5 font-mono text-xs transition-colors ${
              active
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            <span className="text-[10px] opacity-60">⎇</span>
            {b.name}
            <span
              className={`rounded-sm px-1 py-0.5 text-[10px] ${
                active ? 'bg-primary/20' : 'bg-secondary'
              }`}
            >
              {b.commitCount}
            </span>
          </Link>
        )
      })}
    </div>
  )
}

function CommitItem({ commit }: { commit: CommitRow }) {
  const hash = shortHash(commit.id)
  const author = commit.author.username ?? 'unknown'

  return (
    <div className="flex items-start gap-4 border-b border-border px-1 py-4 last:border-0">
      {/* Timeline dot */}
      <div className="mt-1.5 flex shrink-0 flex-col items-center">
        <div className="h-2.5 w-2.5 rounded-full border-2 border-primary bg-background" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{commit.message}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-label text-muted-foreground">
          <span className="text-cyan-400">{hash}</span>
          <span>{author}</span>
          <span>{formatBytes(commit.fileVersion.size)}</span>
          <span className="uppercase">{commit.fileVersion.format}</span>
          <span>{formatRelative(commit.createdAt)}</span>
        </div>
      </div>

      {/* Checksum */}
      <span
        className="hidden shrink-0 font-mono text-[10px] text-muted-foreground/50 sm:block"
        title={`SHA-256: ${commit.fileVersion.checksum}`}
      >
        {commit.fileVersion.checksum.slice(0, 8)}
      </span>
    </div>
  )
}

function CommitList({ commits }: { commits: CommitRow[] }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <p className="font-mono text-label uppercase tracking-widest text-muted-foreground">
          Commits
        </p>
        <span className="font-mono text-label text-muted-foreground">{commits.length} total</span>
      </div>
      <div className="px-4">
        {commits.map((c) => (
          <CommitItem key={c.id} commit={c} />
        ))}
      </div>
    </div>
  )
}

function EmptyState({
  projectId,
  branchId,
  isEditor,
}: {
  projectId: string
  branchId: string
  isEditor: boolean
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center">
      <div className="mb-4 font-mono text-4xl text-muted-foreground/20">⬡</div>
      <h3 className="mb-1 font-semibold text-foreground">No commits yet</h3>
      <p className="mb-6 max-w-xs text-sm text-muted-foreground">
        Upload your first ECU file to start versioning your tune.
      </p>
      {isEditor && (
        <UploadDialog projectId={projectId} branchId={branchId}>
          <button className="rounded bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
            Upload first file
          </button>
        </UploadDialog>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface ProjectPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ branch?: string }>
}

export default async function ProjectPage({ params, searchParams }: ProjectPageProps) {
  const { id } = await params
  const { branch: branchParam } = await searchParams

  const [project, supabase] = await Promise.all([
    getProject(id),
    createClient(),
  ])

  if (!project) notFound()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const userId = user?.id ?? null

  // Access control: private/unlisted projects need owner or accepted collaborator
  if (project.visibility === 'PRIVATE') {
    if (!userId) notFound()
    const canView = await canViewProject(id, userId)
    if (!canView) notFound()
  }

  const isOwner = userId === project.ownerId
  const isEditor = isOwner || (userId ? await canEditProject(id, userId) : false)

  // Resolve selected branch: URL param → main → first
  const selectedBranch =
    project.branches.find((b) => b.id === branchParam) ??
    project.branches.find((b) => b.name === 'main') ??
    project.branches[0]

  const { prisma } = await import('@maplab/db')
  const [commits, comments, collaborators, viewerHasLiked] = await Promise.all([
    selectedBranch ? getBranchCommits(selectedBranch.id) : Promise.resolve([]),
    getComments(id),
    userId ? getCollaborators(id) : Promise.resolve([]),
    userId
      ? prisma.like
          .findUnique({
            where: { userId_projectId: { userId, projectId: id } },
            select: { userId: true },
          })
          .then(Boolean)
      : Promise.resolve(false),
  ])

  const showCollaboratorsPanel = isOwner || (userId && collaborators.length > 0)

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <ProjectHeader
        project={project}
        isOwner={isOwner}
        isEditor={isEditor}
        selectedBranch={selectedBranch}
        hasCommits={commits.length > 0}
        viewerHasLiked={viewerHasLiked}
        currentUserId={userId}
      />

      {project.branches.length > 1 && (
        <BranchTabs
          branches={project.branches}
          selected={selectedBranch}
          projectId={project.id}
        />
      )}

      {commits.length === 0 ? (
        <EmptyState
          projectId={project.id}
          branchId={selectedBranch?.id ?? ''}
          isEditor={isEditor}
        />
      ) : (
        <CommitList commits={commits} />
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <CommentsSection
          projectId={id}
          initialComments={comments}
          currentUserId={userId}
        />
        {showCollaboratorsPanel && (
          <CollaboratorsPanel
            projectId={id}
            initialCollaborators={collaborators}
            isOwner={isOwner}
            currentUserId={userId ?? ''}
          />
        )}
      </div>
    </div>
  )
}
