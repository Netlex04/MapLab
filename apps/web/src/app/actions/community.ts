'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@maplab/db'
import { createClient } from '@/lib/supabase/server'
import type { Visibility } from '@maplab/types'

// ─── Auth Helper ──────────────────────────────────────────────────────────────

async function getAuthUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

// ─── Explore Feed ─────────────────────────────────────────────────────────────

export interface ExploreProject {
  id: string
  name: string
  description: string | null
  ecuType: string | null
  fuelType: string | null
  stage: string | null
  forkOfId: string | null
  likeCount: number
  forkCount: number
  commentCount: number
  commitCount: number
  owner: { username: string | null; avatarUrl: string | null }
  viewerHasLiked: boolean
  updatedAt: Date
  createdAt: Date
}

export type ExploreSortOrder = 'newest' | 'most_liked' | 'most_forked'

export interface ExploreFilters {
  search?: string
  ecuType?: string
  stage?: string
  fuelType?: string
  sort?: ExploreSortOrder
}

export async function getPublicProjects(
  filters: ExploreFilters = {},
): Promise<ExploreProject[]> {
  const user = await getAuthUser()

  const { search, ecuType, stage, fuelType, sort = 'newest' } = filters

  const projects = await prisma.project.findMany({
    where: {
      visibility: 'PUBLIC',
      ...(ecuType ? { ecuType } : {}),
      ...(stage ? { stage } : {}),
      ...(fuelType ? { fuelType } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      description: true,
      ecuType: true,
      fuelType: true,
      stage: true,
      forkOfId: true,
      updatedAt: true,
      createdAt: true,
      owner: { select: { username: true, avatarUrl: true } },
      _count: {
        select: { likes: true, forks: true, comments: true },
      },
      branches: {
        select: { _count: { select: { commits: true } } },
      },
      likes: user
        ? { where: { userId: user.id }, select: { userId: true } }
        : false,
    },
    orderBy:
      sort === 'most_liked'
        ? { likes: { _count: 'desc' } }
        : sort === 'most_forked'
          ? { forks: { _count: 'desc' } }
          : { updatedAt: 'desc' },
    take: 60,
  })

  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    ecuType: p.ecuType,
    fuelType: p.fuelType,
    stage: p.stage,
    forkOfId: p.forkOfId,
    likeCount: p._count.likes,
    forkCount: p._count.forks,
    commentCount: p._count.comments,
    commitCount: p.branches.reduce((s, b) => s + b._count.commits, 0),
    owner: p.owner,
    viewerHasLiked: user ? (p.likes as { userId: string }[]).length > 0 : false,
    updatedAt: p.updatedAt,
    createdAt: p.createdAt,
  }))
}

export async function getExploreFilterOptions(): Promise<{
  ecuTypes: string[]
  stages: string[]
  fuelTypes: string[]
}> {
  const [ecuTypes, stages, fuelTypes] = await Promise.all([
    prisma.project.findMany({
      where: { visibility: 'PUBLIC', ecuType: { not: null } },
      select: { ecuType: true },
      distinct: ['ecuType'],
      orderBy: { ecuType: 'asc' },
    }),
    prisma.project.findMany({
      where: { visibility: 'PUBLIC', stage: { not: null } },
      select: { stage: true },
      distinct: ['stage'],
      orderBy: { stage: 'asc' },
    }),
    prisma.project.findMany({
      where: { visibility: 'PUBLIC', fuelType: { not: null } },
      select: { fuelType: true },
      distinct: ['fuelType'],
      orderBy: { fuelType: 'asc' },
    }),
  ])

  return {
    ecuTypes: ecuTypes.map((r) => r.ecuType!),
    stages: stages.map((r) => r.stage!),
    fuelTypes: fuelTypes.map((r) => r.fuelType!),
  }
}

// ─── Like ─────────────────────────────────────────────────────────────────────

export interface LikeResult {
  liked: boolean
  likeCount: number
}

export async function toggleLike(projectId: string): Promise<LikeResult> {
  const user = await getAuthUser()
  if (!user) throw new Error('Not authenticated')

  const existing = await prisma.like.findUnique({
    where: { userId_projectId: { userId: user.id, projectId } },
  })

  if (existing) {
    await prisma.like.delete({
      where: { userId_projectId: { userId: user.id, projectId } },
    })
  } else {
    await prisma.like.create({ data: { userId: user.id, projectId } })
  }

  const likeCount = await prisma.like.count({ where: { projectId } })

  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/explore')

  return { liked: !existing, likeCount }
}

// ─── Fork ─────────────────────────────────────────────────────────────────────

export interface ForkResult {
  projectId: string
}

export async function forkProject(sourceProjectId: string): Promise<ForkResult> {
  const user = await getAuthUser()
  if (!user) throw new Error('Not authenticated')

  const source = await prisma.project.findUnique({
    where: { id: sourceProjectId },
    select: {
      name: true,
      description: true,
      visibility: true,
      ecuType: true,
      fuelType: true,
      stage: true,
      branches: {
        where: { name: 'main' },
        select: {
          headId: true,
          commits: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { fileVersionId: true },
          },
        },
        take: 1,
      },
    },
  })

  if (!source) throw new Error('Source project not found')
  if (source.visibility === 'PRIVATE') throw new Error('Cannot fork a private project')

  const forked = await prisma.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: {
        name: source.name,
        description: source.description,
        visibility: 'PRIVATE' as Visibility,
        ecuType: source.ecuType,
        fuelType: source.fuelType,
        stage: source.stage,
        ownerId: user.id,
        forkOfId: sourceProjectId,
      },
      select: { id: true },
    })

    const mainBranch = await tx.branch.create({
      data: { name: 'main', projectId: p.id },
      select: { id: true },
    })

    // Copy the head commit of the source's main branch into the fork
    const sourceMain = source.branches[0]
    const latestCommit = sourceMain?.commits[0]
    if (latestCommit) {
      const commit = await tx.commit.create({
        data: {
          message: 'Initial fork',
          branchId: mainBranch.id,
          parentId: null,
          authorId: user.id,
          fileVersionId: latestCommit.fileVersionId,
        },
        select: { id: true },
      })
      await tx.branch.update({
        where: { id: mainBranch.id },
        data: { headId: commit.id },
      })
    }

    return p
  })

  revalidatePath(`/projects/${sourceProjectId}`)
  revalidatePath('/dashboard')

  return { projectId: forked.id }
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export interface CommentRow {
  id: string
  content: string
  parentId: string | null
  mapId: string | null
  author: { username: string | null; avatarUrl: string | null }
  createdAt: Date
  replyCount: number
}

export async function getComments(projectId: string): Promise<CommentRow[]> {
  const comments = await prisma.comment.findMany({
    where: { projectId, parentId: null },
    select: {
      id: true,
      content: true,
      parentId: true,
      mapId: true,
      author: { select: { username: true, avatarUrl: true } },
      createdAt: true,
      _count: { select: { replies: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return comments.map((c) => ({
    id: c.id,
    content: c.content,
    parentId: c.parentId,
    mapId: c.mapId,
    author: c.author,
    createdAt: c.createdAt,
    replyCount: c._count.replies,
  }))
}

export async function getReplies(commentId: string): Promise<CommentRow[]> {
  const replies = await prisma.comment.findMany({
    where: { parentId: commentId },
    select: {
      id: true,
      content: true,
      parentId: true,
      mapId: true,
      author: { select: { username: true, avatarUrl: true } },
      createdAt: true,
      _count: { select: { replies: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return replies.map((c) => ({
    id: c.id,
    content: c.content,
    parentId: c.parentId,
    mapId: c.mapId,
    author: c.author,
    createdAt: c.createdAt,
    replyCount: c._count.replies,
  }))
}

export type AddCommentState = { error: string } | { id: string } | null

export async function addComment(
  projectId: string,
  content: string,
  parentId?: string,
): Promise<AddCommentState> {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const trimmed = content.trim()
  if (!trimmed || trimmed.length > 2000) return { error: 'Invalid comment' }

  // Verify project exists and is accessible
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { visibility: true, ownerId: true },
  })
  if (!project) return { error: 'Project not found' }
  if (project.visibility === 'PRIVATE' && project.ownerId !== user.id) {
    return { error: 'Access denied' }
  }

  const comment = await prisma.comment.create({
    data: {
      content: trimmed,
      authorId: user.id,
      projectId,
      parentId: parentId ?? null,
    },
    select: { id: true },
  })

  revalidatePath(`/projects/${projectId}`)

  return { id: comment.id }
}

export async function deleteComment(commentId: string, projectId: string): Promise<void> {
  const user = await getAuthUser()
  if (!user) throw new Error('Not authenticated')

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { authorId: true },
  })

  if (!comment) return
  if (comment.authorId !== user.id) throw new Error('Not authorized')

  await prisma.comment.delete({ where: { id: commentId } })

  revalidatePath(`/projects/${projectId}`)
}
