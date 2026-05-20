interface EditorPageProps {
  params: Promise<{ id: string }>
}

export default async function EditorPage({ params }: EditorPageProps) {
  const { id } = await params
  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 items-center border-b border-border px-4 text-sm text-muted-foreground">
        Editor – Projekt {id}
      </header>
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: Map-Tree, AI-Copilot */}
        <aside className="w-64 border-r border-border" />
        {/* Canvas: Hex/2D/3D/Diff */}
        <main className="flex-1" />
      </div>
    </div>
  )
}
