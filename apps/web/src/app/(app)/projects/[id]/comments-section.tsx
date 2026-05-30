'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'
import {
  addComment,
  getReplies,
  type CommentRow,
} from '@/app/actions/community'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'gerade eben'
  if (m < 60) return `vor ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `vor ${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `vor ${d}d`
  return new Date(date).toLocaleDateString('de', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function Avatar({ username, avatarUrl }: { username: string | null; avatarUrl: string | null }) {
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={username ?? ''}
        width={28}
        height={28}
        className="size-7 rounded-full object-cover shrink-0"
      />
    )
  }
  return (
    <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center font-mono text-[10px] font-bold text-primary shrink-0">
      {(username ?? '?')[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

// ─── Compose Box ──────────────────────────────────────────────────────────────

function ComposeBox({
  projectId,
  parentId,
  placeholder,
  onCancel,
  onPosted,
}: {
  projectId: string
  parentId?: string
  placeholder?: string
  onCancel?: () => void
  onPosted: (comment: CommentRow) => void
}) {
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!content.trim()) return
    setError(null)
    startTransition(async () => {
      const result = await addComment(projectId, content, parentId)
      if (!result) { setError('Unbekannter Fehler'); return }
      if ('error' in result) { setError(result.error); return }
      onPosted({
        id: result.id,
        content: content.trim(),
        parentId: parentId ?? null,
        mapId: null,
        author: { username: null, avatarUrl: null },
        createdAt: new Date(),
        replyCount: 0,
      })
      setContent('')
      onCancel?.()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder ?? 'Kommentar schreiben…'}
        rows={3}
        maxLength={2000}
        className="w-full resize-none rounded border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
      />
      {error && <p className="text-xs text-destructive font-mono">{error}</p>}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-muted-foreground/50">
          {content.length}/2000
        </span>
        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Abbrechen
            </button>
          )}
          <button
            type="submit"
            disabled={isPending || !content.trim()}
            className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {isPending ? 'Wird gesendet…' : 'Senden'}
          </button>
        </div>
      </div>
    </form>
  )
}

// ─── Comment Item ─────────────────────────────────────────────────────────────

function CommentItem({
  comment,
  projectId,
  currentUserId,
  onDeleted: _onDeleted,
}: {
  comment: CommentRow
  projectId: string
  currentUserId: string | null
  onDeleted: (id: string) => void
}) {
  const [showReplyBox, setShowReplyBox] = useState(false)
  const [repliesOpen, setRepliesOpen] = useState(false)
  const [replies, setReplies] = useState<CommentRow[]>([])
  const [loadingReplies, setLoadingReplies] = useState(false)

  async function loadReplies() {
    if (loadingReplies) return
    setLoadingReplies(true)
    const data = await getReplies(comment.id)
    setReplies(data)
    setLoadingReplies(false)
    setRepliesOpen(true)
  }

  function handleToggleReplies() {
    if (!repliesOpen) {
      loadReplies()
    } else {
      setRepliesOpen(false)
    }
  }

  function handleReplyPosted(reply: CommentRow) {
    setReplies((r) => [...r, reply])
    setRepliesOpen(true)
    setShowReplyBox(false)
  }

  const authorName = comment.author.username ?? 'anonymous'

  return (
    <div className="flex gap-3">
      <Avatar username={comment.author.username} avatarUrl={comment.author.avatarUrl} />

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-xs font-semibold text-foreground">{authorName}</span>
          <span className="font-mono text-[10px] text-muted-foreground/50">
            {formatRelative(comment.createdAt)}
          </span>
        </div>

        {/* Content */}
        <p className="text-sm text-foreground/90 whitespace-pre-wrap wrap-break-word">{comment.content}</p>

        {/* Actions */}
        <div className="mt-2 flex items-center gap-3">
          {currentUserId && (
            <button
              onClick={() => setShowReplyBox((v) => !v)}
              className="font-mono text-label text-muted-foreground hover:text-foreground transition-colors"
            >
              Antworten
            </button>
          )}
          {comment.replyCount > 0 && (
            <button
              onClick={handleToggleReplies}
              className="flex items-center gap-1 font-mono text-label text-muted-foreground hover:text-foreground transition-colors"
            >
              {repliesOpen ? (
                <ChevronUp className="size-3" />
              ) : (
                <ChevronDown className="size-3" />
              )}
              {loadingReplies
                ? 'Lade…'
                : `${comment.replyCount} Antwort${comment.replyCount !== 1 ? 'en' : ''}`}
            </button>
          )}
        </div>

        {/* Reply compose */}
        {showReplyBox && (
          <div className="mt-3">
            <ComposeBox
              projectId={projectId}
              parentId={comment.id}
              placeholder={`${authorName} antworten…`}
              onCancel={() => setShowReplyBox(false)}
              onPosted={handleReplyPosted}
            />
          </div>
        )}

        {/* Replies */}
        {repliesOpen && replies.length > 0 && (
          <div className="mt-4 space-y-4 pl-4 border-l border-border/50">
            {replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                projectId={projectId}
                currentUserId={currentUserId}
                onDeleted={(id) => setReplies((r) => r.filter((c) => c.id !== id))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Comments Section ─────────────────────────────────────────────────────────

interface CommentsSectionProps {
  projectId: string
  initialComments: CommentRow[]
  currentUserId: string | null
}

export function CommentsSection({
  projectId,
  initialComments,
  currentUserId,
}: CommentsSectionProps) {
  const [comments, setComments] = useState<CommentRow[]>(initialComments)

  function handlePosted(comment: CommentRow) {
    setComments((prev) => [comment, ...prev])
  }

  function handleDeleted(id: string) {
    setComments((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <MessageSquare className="size-4 text-muted-foreground/50" />
        <p className="font-mono text-label uppercase tracking-widest text-muted-foreground">
          Kommentare
        </p>
        <span className="font-mono text-label text-muted-foreground ml-auto">
          {comments.length} total
        </span>
      </div>

      {/* Compose (only for logged-in users) */}
      {currentUserId && (
        <div className="border-b border-border px-5 py-4">
          <ComposeBox
            projectId={projectId}
            placeholder="Kommentar schreiben…"
            onPosted={handlePosted}
          />
        </div>
      )}

      {/* Comment list */}
      {comments.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">Noch keine Kommentare.</p>
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          {comments.map((c) => (
            <div key={c.id} className="px-5 py-5">
              <CommentItem
                comment={c}
                projectId={projectId}
                currentUserId={currentUserId}
                onDeleted={handleDeleted}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
