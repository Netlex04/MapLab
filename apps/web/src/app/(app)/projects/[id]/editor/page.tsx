import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProject, canEditProject, canViewProject } from '@/app/actions/projects'
import { EditorShell } from '@/components/editor/EditorShell'

interface EditorPageProps {
  params: Promise<{ id: string }>
}

export default async function EditorPage({ params }: EditorPageProps) {
  const { id } = await params

  const [project, supabase] = await Promise.all([getProject(id), createClient()])
  if (!project) notFound()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (project.visibility === 'PRIVATE') {
    if (!user) notFound()
    const canView = await canViewProject(id, user.id)
    if (!canView) notFound()
  }

  const canCommit = user ? await canEditProject(id, user.id) : false
  const branchId = project.branches[0]?.id ?? ''

  return (
    <EditorShell
      projectId={id}
      projectName={project.name}
      branchId={branchId}
      canCommit={canCommit}
    />
  )
}
