// Der Editor übernimmt den gesamten verfügbaren Raum innerhalb der App-Shell.
// overflow-hidden verhindert doppelte Scrollbalken neben dem App-Sidebar.
export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-full overflow-hidden">{children}</div>
}
