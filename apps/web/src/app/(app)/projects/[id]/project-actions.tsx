'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart, GitFork } from 'lucide-react'
import { toggleLike, forkProject } from '@/app/actions/community'

// ─── Like Button ──────────────────────────────────────────────────────────────

interface LikeButtonProps {
  projectId: string
  initialLiked: boolean
  initialCount: number
}

export function LikeButton({ projectId, initialLiked, initialCount }: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (loading) return
    setLoading(true)
    // Optimistic update
    setLiked((l) => !l)
    setCount((c) => (liked ? c - 1 : c + 1))
    try {
      const result = await toggleLike(projectId)
      setLiked(result.liked)
      setCount(result.likeCount)
    } catch {
      // Revert
      setLiked(liked)
      setCount(count)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={[
        'inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-mono font-medium transition-all',
        liked
          ? 'bg-pink-400/10 text-pink-400 hover:bg-pink-400/20'
          : 'bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground',
      ].join(' ')}
    >
      <Heart className={['size-3.5 transition-all', liked ? 'fill-pink-400' : ''].join(' ')} />
      {count}
    </button>
  )
}

// ─── Fork Button ──────────────────────────────────────────────────────────────

interface ForkButtonProps {
  projectId: string
  forkCount: number
}

export function ForkButton({ projectId, forkCount }: ForkButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleClick() {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const result = await forkProject(projectId)
      router.push(`/projects/${result.projectId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fork fehlgeschlagen')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded bg-secondary px-3 py-1.5 text-xs font-mono font-medium text-muted-foreground transition-all hover:bg-secondary/80 hover:text-foreground disabled:opacity-50"
      >
        <GitFork className="size-3.5" />
        {loading ? 'Forking…' : `Fork · ${forkCount}`}
      </button>
      {error && <span className="text-[10px] text-destructive font-mono">{error}</span>}
    </div>
  )
}
