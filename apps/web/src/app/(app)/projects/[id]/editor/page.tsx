import { notFound, redirect } from 'next/navigation'
import { getProject, getBranchCommits } from '@/app/actions/projects'
import { createClient } from '@/lib/supabase/server'
import { EditorShell } from './components/editor-shell'

interface EditorPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ branch?: string }>
}

export default async function EditorPage({ params, searchParams }: EditorPageProps) {
  const { id } = await params
  const { branch: branchParam } = await searchParams

  const [project, supabase] = await Promise.all([getProject(id), createClient()])
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!project) notFound()
  if (project.visibility === 'PRIVATE' && project.ownerId !== user?.id) notFound()

  const selectedBranch =
    project.branches.find((b) => b.id === branchParam) ??
    project.branches.find((b) => b.name === 'main') ??
    project.branches[0]

  if (!selectedBranch) redirect(`/projects/${id}`)

  const commits = await getBranchCommits(selectedBranch.id)
  const headCommit = commits[0] ?? null

  if (!headCommit) redirect(`/projects/${id}`)

  const ownerSlug = project.owner.username ?? project.ownerId.slice(0, 8)

  return (
    <EditorShell
      projectId={project.id}
      projectName={project.name}
      ownerSlug={ownerSlug}
      branchId={selectedBranch.id}
      branchName={selectedBranch.name}
      commitHash={headCommit.id.replace(/-/g, '').slice(0, 7)}
      ecuType={project.ecuType}
      fileUrl={null}
    />
  )
}
