interface ProjectPageProps {
  params: Promise<{ id: string }>
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Projekt {id}</h1>
    </main>
  )
}
