'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { register, type AuthState } from '@/app/actions/auth'

export function RegisterForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(register, null)

  if (state && 'success' in state) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 shadow-lg text-center">
        <div className="mb-3 flex justify-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-400/10 text-green-400 text-xl">
            ✓
          </span>
        </div>
        <h2 className="font-display text-xl font-bold uppercase tracking-wider">Check your email</h2>
        <p className="mt-2 text-sm text-muted-foreground">{state.success}</p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm text-foreground underline underline-offset-2 hover:text-primary transition-colors"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-8 shadow-lg">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wider">Create account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Free to start. No credit card needed.</p>
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
            placeholder="Min. 8 characters"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        {state && 'error' in state && (
          <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Creating account…' : 'Create account'}
        </Button>

        <p className="text-center text-[11px] text-muted-foreground">
          By creating an account you agree to our{' '}
          <Link href="/terms" className="underline underline-offset-2 hover:text-foreground transition-colors">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
          .
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="text-foreground underline underline-offset-2 hover:text-primary transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  )
}
