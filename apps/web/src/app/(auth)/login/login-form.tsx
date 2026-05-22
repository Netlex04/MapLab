'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { login, type AuthState } from '@/app/actions/auth'

export function LoginForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, null)

  return (
    <div className="rounded-xl border border-border bg-card p-8 shadow-lg">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wider">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">Continue with your account</p>
      </div>

      <form action={action} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Password
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
        </div>

        {state && 'error' in state && (
          <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        No account yet?{' '}
        <Link href="/register" className="text-foreground underline underline-offset-2 hover:text-primary transition-colors">
          Create one
        </Link>
      </p>
    </div>
  )
}
