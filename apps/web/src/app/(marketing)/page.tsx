import Link from 'next/link'

// --- HERO MOCKUP ---

const mapValues = [
  [8,  14, 22, 31, 41, 52, 63, 71],
  [12, 19, 28, 38, 50, 62, 74, 83],
  [16, 24, 34, 46, 59, 73, 86, 96],
  [21, 30, 42, 56, 70, 85, 99, 110],
  [27, 38, 52, 67, 83, 99, 114, 126],
  [34, 47, 63, 80, 98, 115, 131, 143],
]

function heatClass(v: number): string {
  if (v >= 120) return 'bg-[rgba(245,158,11,0.55)] text-[#0B0D11] font-semibold'
  if (v >= 90)  return 'bg-[rgba(245,158,11,0.38)] text-amber-300'
  if (v >= 60)  return 'bg-[rgba(245,158,11,0.26)]'
  if (v >= 30)  return 'bg-[rgba(245,158,11,0.16)]'
  return 'bg-[rgba(245,158,11,0.08)] text-muted-foreground'
}

function EditorMockup() {
  return (
    <div className="relative w-full max-w-[500px] select-none">
      {/* Ghost card behind */}
      <div className="absolute -bottom-4 -right-4 w-[85%] h-full rounded-xl border border-border bg-card opacity-60" />

      {/* Main card */}
      <div className="relative rounded-xl border border-border bg-card shadow-lg overflow-hidden">
        {/* Window chrome */}
        <div className="flex items-center gap-1.5 border-b border-border bg-secondary/40 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/50" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/50" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-500/50" />
          <span className="ml-3 font-mono text-[11px] text-muted-foreground">
            Stage2_GTI_2.0T.bin — Torque Limiter Map
          </span>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-border text-xs font-medium">
          <span className="border-b-2 border-primary bg-accent/30 px-4 py-2 text-primary">
            Map View
          </span>
          <span className="px-4 py-2 text-muted-foreground">Hex</span>
          <span className="px-4 py-2 text-muted-foreground">Compare</span>
          <span className="ml-auto px-4 py-2 text-cyan-400">AI Copilot</span>
        </div>

        {/* Map grid */}
        <div className="p-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Torque_Lim_Map · 6×8 · Nm
          </p>
          <div
            className="grid gap-0.5"
            style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}
          >
            {mapValues.flat().map((v, i) => (
              <div
                key={i}
                className={`flex items-center justify-center rounded-sm py-1.5 font-mono text-[11px] ${heatClass(v)}`}
              >
                {v}
              </div>
            ))}
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between border-t border-border bg-secondary/40 px-4 py-2 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            <span className="text-amber-400">3 cells modified</span>
          </span>
          <span>
            saved · <span className="text-cyan-400">version 3</span> · Stage 2
          </span>
        </div>
      </div>

      {/* Floating AI tooltip */}
      <div className="absolute -top-3 -right-6 rounded-lg border border-cyan-400/20 bg-card px-3 py-2 shadow-md max-w-[180px]">
        <p className="font-mono text-[10px] text-cyan-400 mb-0.5 uppercase tracking-widest">AI Copilot</p>
        <p className="text-[11px] text-foreground/80 leading-snug">
          High-load torque limit looks aggressive. Check knock sensor margin.
        </p>
      </div>
    </div>
  )
}

// --- FEATURES ---

const features = [
  {
    label: '◫',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    title: 'Community Tune Library',
    body: 'Browse tunes from other tuners — filtered by car, ECU type, and stage. Find one close to your setup and use it as your starting point.',
  },
  {
    label: '⬡',
    color: 'text-green-400',
    bg: 'bg-green-400/10',
    title: 'Browser Editor',
    body: 'Open any tune file directly in your browser. Edit maps, inspect values, and compare changes — no software to install, no license required.',
  },
  {
    label: '◈',
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10',
    title: 'AI Copilot',
    body: 'Ask what any map value does. Get plain-language explanations, spot anything that looks off, and understand your tune — not just the numbers.',
  },
  {
    label: '⊞',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
    title: 'Full Tune History',
    body: 'Save a snapshot whenever you want. Go back to any previous version. See exactly what changed between two saves — without losing anything.',
  },
]

// --- HOW IT WORKS ---

const steps = [
  {
    n: '01',
    title: 'Find a tune for your setup',
    body: 'Browse the community library. Filter by car, ECU, and stage. Use a proven tune as your starting point instead of starting from scratch.',
  },
  {
    n: '02',
    title: 'Open it in the browser',
    body: 'Edit maps, adjust values, and preview your changes live. No software to install. Works on any device with a browser.',
  },
  {
    n: '03',
    title: 'Save your progress. Share what works.',
    body: 'Save a snapshot whenever you want. Publish your tune to the community so others can build on it — or keep it private.',
  },
]

// --- PAGE ---

export default function LandingPage() {
  return (
    <main className="pt-14">

      {/* ── HERO ──────────────────────────────────────────── */}
      <section className="relative min-h-[calc(100vh-56px)] flex items-center overflow-hidden">
        {/* Ambient glow */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/4 top-1/3 h-125 w-125 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/5 blur-3xl" />
          <div className="absolute right-1/4 top-2/3 h-80 w-80 rounded-full bg-cyan-400/4 blur-3xl" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-6 py-24 lg:grid-cols-2">
          {/* Copy */}
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/5 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span className="font-mono text-label font-bold uppercase tracking-widest text-amber-400">
                Open Beta
              </span>
            </div>

            <h1 className="font-display text-[52px] font-bold uppercase leading-[1.04] tracking-wider lg:text-[60px]">
              The ECU library<br />
              <span className="text-primary">your Discord can&apos;t replace.</span>
            </h1>

            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
              Browse tunes from the community, edit them in the browser, and keep
              a full history of every change — without installing anything.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/explore"
                className="rounded bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Browse Community Tunes
              </Link>
              <Link
                href="/register"
                className="rounded border border-border px-6 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
              >
                Upload Your First Tune
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              {['Free to start', 'No local install', 'Your data stays yours'].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-green-400" />
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Mockup */}
          <div className="flex justify-center lg:justify-end">
            <EditorMockup />
          </div>
        </div>
      </section>

      {/* ── PROBLEM STRIP ──────────────────────────────────── */}
      <section className="border-y border-border bg-secondary/20">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="mb-10 text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            The old way
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                label: 'File management',
                quote: '"final_tune_v3_REAL_FINAL.bin"',
                desc: 'No history, no context, no going back.',
              },
              {
                label: 'Collaboration',
                quote: 'Sending zip files over Discord',
                desc: 'No comments, no comparison, no accountability.',
              },
              {
                label: 'Finding tunes',
                quote: 'Searching forums for something that fits your setup',
                desc: 'No structure, no trust, no way to know if it works.',
              },
            ].map(({ label, quote, desc }) => (
              <div key={label} className="rounded-lg border border-border bg-card p-5">
                <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {label}
                </p>
                <p className="font-mono text-sm text-foreground/80">{quote}</p>
                <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-14 text-center">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            What MapLab gives you
          </p>
          <h2 className="font-display text-4xl font-bold uppercase tracking-wider">
            Everything tuners<br />
            were missing.
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {features.map(({ label, color, bg, title, body }) => (
            <div
              key={title}
              className="rounded-xl border border-border bg-card p-6 transition-all hover:shadow-md"
            >
              <div
                className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg text-xl ${bg} ${color}`}
              >
                {label}
              </div>
              <h3 className="mb-2 font-semibold text-foreground">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────── */}
      <section id="how-it-works" className="border-t border-border bg-secondary/10">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="mb-14 text-center">
            <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Get started
            </p>
            <h2 className="font-display text-4xl font-bold uppercase tracking-wider">
              From zero to your first tune<br />
              in three steps.
            </h2>
          </div>

          <div className="grid gap-10 md:grid-cols-3">
            {steps.map(({ n, title, body }) => (
              <div key={n}>
                <div className="mb-4 font-display text-5xl font-bold leading-none tracking-widest text-primary/20">
                  {n}
                </div>
                <h3 className="mb-2 text-base font-semibold text-foreground">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────── */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-2xl px-6 py-32 text-center">
          <h2 className="font-display text-4xl font-bold uppercase tracking-wider leading-tight">
            The best tunes come from<br />
            <span className="text-primary">people who share.</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            Join the community building the ECU library that actually helps. Free, no credit card needed.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-block rounded bg-primary px-8 py-3 text-sm font-bold tracking-wide text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Join for Free
          </Link>
          <p className="mt-4 text-xs text-muted-foreground">
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-foreground underline underline-offset-2 hover:text-primary transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-muted-foreground md:flex-row">
          <span className="font-display text-sm font-bold uppercase tracking-widest text-foreground/50">
            Map<span className="text-primary/50">Lab</span>
          </span>
          <span>ECU tuning platform — currently in open beta</span>
          <div className="flex gap-4">
            <Link href="#" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="#" className="hover:text-foreground transition-colors">Contact</Link>
          </div>
        </div>
      </footer>

    </main>
  )
}
