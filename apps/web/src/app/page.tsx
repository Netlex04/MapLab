export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight text-white">
          Map<span className="text-primary">Lab</span>
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          GitHub für ECU-Tuning. Version control, Community und AI Copilot – im Browser.
        </p>
      </div>
      <div className="mt-6 flex gap-3">
        <a
          href="/dashboard"
          className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Loslegen
        </a>
        <a
          href="/explore"
          className="rounded-md border border-border px-5 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
        >
          Explore
        </a>
      </div>
    </main>
  )
}
