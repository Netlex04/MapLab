import Link from 'next/link'
import { getMyProjects, type ProjectRow } from '@/app/actions/projects'
import { NewProjectDialog } from './new-project-dialog'

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function stageBadge(stage: string | null) {
  if (!stage) return null
  return (
    <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
      {stage}
    </span>
  )
}

function visibilityBadge(v: string) {
  const isPublic = v === 'PUBLIC'
  return (
    <span
      className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
        isPublic
          ? 'bg-green-400/10 text-green-400'
          : 'bg-secondary text-muted-foreground'
      }`}
    >
      {isPublic ? 'Public' : 'Private'}
    </span>
  )
}

function ProjectCard({ project }: { project: ProjectRow }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-all hover:border-border/80 hover:shadow-md"
    >
      <div className="mb-3 flex items-center gap-2">
        {stageBadge(project.stage)}
        {visibilityBadge(project.visibility)}
      </div>

      <h3 className="mb-1 font-semibold text-foreground group-hover:text-primary transition-colors">
        {project.name}
      </h3>

      {project.ecuType && (
        <p className="font-mono text-label text-muted-foreground">
          {project.ecuType}
        </p>
      )}

      {project.description && (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
          {project.description}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between pt-4 text-xs text-muted-foreground">
        <span>Updated {formatRelative(project.updatedAt)}</span>
        <span className="text-primary opacity-0 transition-opacity group-hover:opacity-100">
          Open →
        </span>
      </div>
    </Link>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center">
      <div className="mb-4 text-4xl text-muted-foreground/30">◫</div>
      <h3 className="mb-1 font-semibold text-foreground">No projects yet</h3>
      <p className="mb-6 max-w-xs text-sm text-muted-foreground">
        Create your first project to start organising and versioning your ECU tunes.
      </p>
      <NewProjectDialog>
        <button className="rounded bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity">
          Create a project
        </button>
      </NewProjectDialog>
    </div>
  )
}

export default async function DashboardPage() {
  const projects = await getMyProjects()

  const publicCount = projects.filter((p) => p.visibility === 'PUBLIC').length
  const privateCount = projects.filter((p) => p.visibility === 'PRIVATE').length

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="font-mono text-label uppercase tracking-widest text-muted-foreground">
            Welcome back
          </p>
          <h1 className="font-display text-3xl font-bold uppercase tracking-wider">
            Dashboard
          </h1>
        </div>
        <NewProjectDialog>
          <button className="rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity">
            + New project
          </button>
        </NewProjectDialog>
      </div>

      {/* Stats strip */}
      {projects.length > 0 && (
        <div className="mb-8 grid grid-cols-3 gap-4">
          {[
            { label: 'Projects', value: projects.length },
            { label: 'Public', value: publicCount },
            { label: 'Private', value: privateCount },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-lg border border-border bg-card px-5 py-4"
            >
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {label}
              </p>
              <p className="mt-1 font-display text-2xl font-bold">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Projects */}
      <div className="mb-4 flex items-center justify-between">
        <p className="font-mono text-label uppercase tracking-widest text-muted-foreground">
          Your projects
        </p>
        {projects.length > 0 && (
          <span className="font-mono text-label text-muted-foreground">
            {projects.length} total
          </span>
        )}
      </div>

      {projects.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  )
}
