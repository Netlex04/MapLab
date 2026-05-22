import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center p-6">
      {/* Ambient glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/5 blur-3xl" />
      </div>

      {/* Wordmark */}
      <Link
        href="/"
        className="relative mb-8 font-display text-xl font-bold uppercase tracking-widest"
      >
        Map<span className="text-primary">Lab</span>
      </Link>

      <div className="relative w-full max-w-sm">
        {children}
      </div>
    </div>
  )
}
