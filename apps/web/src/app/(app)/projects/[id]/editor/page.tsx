import { notFound } from 'next/navigation'
import { getProject } from '@/app/actions/projects'
import { EditorShell } from '@/components/editor/EditorShell'

interface EditorPageProps {
  params: Promise<{ id: string }>
}

export default async function EditorPage({ params }: EditorPageProps) {
  const { id } = await params
  const project = await getProject(id)

  if (!project) notFound()

  return <EditorShell projectId={id} projectName={project.name} />
}
