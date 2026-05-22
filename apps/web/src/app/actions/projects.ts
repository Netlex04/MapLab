'use server'

import { createHash } from 'crypto'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@maplab/db'
import { createClient } from '@/lib/supabase/server'
import type { FileFormat, Visibility } from '@maplab/types'

export type ProjectState = { error: string } | null

async function getAuthUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function createProject(
  _: ProjectState,
  formData: FormData,
): Promise<ProjectState> {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const name = (formData.get('name') as string).trim()
  if (!name) return { error: 'Project name is required' }

  const visibility = (formData.get('visibility') as Visibility) ?? 'PRIVATE'

  const project = await prisma.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: {
        name,
        description: (formData.get('description') as string) || null,
        visibility,
        ecuType: (formData.get('ecuType') as string) || null,
        stage: (formData.get('stage') as string) || null,
        ownerId: user.id,
      },
      select: { id: true },
    })
    await tx.branch.create({ data: { name: 'main', projectId: p.id } })
    return p
  })

  redirect(`/projects/${project.id}`)
}

export interface ProjectRow {
  id: string
  name: string
  description: string | null
  visibility: Visibility
  ecuType: string | null
  stage: string | null
  createdAt: Date
  updatedAt: Date
}

export async function getMyProjects(): Promise<ProjectRow[]> {
  const user = await getAuthUser()
  if (!user) return []

  return prisma.project.findMany({
    where: { ownerId: user.id },
    select: {
      id: true,
      name: true,
      description: true,
      visibility: true,
      ecuType: true,
      stage: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  }) as Promise<ProjectRow[]>
}

// ─── Project Detail ────────────────────────────────────────────────────────────

export interface BranchWithCount {
  id: string
  name: string
  headId: string | null
  commitCount: number
  createdAt: Date
}

export interface ProjectDetail {
  id: string
  ownerId: string
  name: string
  description: string | null
  visibility: Visibility
  ecuType: string | null
  fuelType: string | null
  stage: string | null
  forkOfId: string | null
  forkOf: { id: string; name: string; owner: { username: string | null } } | null
  owner: { id: string; username: string | null; avatarUrl: string | null }
  branches: BranchWithCount[]
  likeCount: number
  forkCount: number
  commentCount: number
  createdAt: Date
  updatedAt: Date
}

export async function getProject(id: string): Promise<ProjectDetail | null> {
  const raw = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      ownerId: true,
      name: true,
      description: true,
      visibility: true,
      ecuType: true,
      fuelType: true,
      stage: true,
      forkOfId: true,
      forkOf: {
        select: {
          id: true,
          name: true,
          owner: { select: { username: true } },
        },
      },
      owner: { select: { id: true, username: true, avatarUrl: true } },
      branches: {
        select: {
          id: true,
          name: true,
          headId: true,
          createdAt: true,
          _count: { select: { commits: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      _count: { select: { likes: true, forks: true, comments: true } },
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!raw) return null

  // Self-healing: projects created before auto-branch got no main branch.
  // Create it lazily here so upstream code always has at least one branch.
  if (raw.branches.length === 0) {
    const branch = await prisma.branch.create({
      data: { name: 'main', projectId: raw.id },
      select: {
        id: true,
        name: true,
        headId: true,
        createdAt: true,
        _count: { select: { commits: true } },
      },
    })
    raw.branches = [branch]
  }

  return {
    id: raw.id,
    ownerId: raw.ownerId,
    name: raw.name,
    description: raw.description,
    visibility: raw.visibility as Visibility,
    ecuType: raw.ecuType,
    fuelType: raw.fuelType,
    stage: raw.stage,
    forkOfId: raw.forkOfId,
    forkOf: raw.forkOf,
    owner: raw.owner,
    branches: raw.branches.map((b) => ({
      id: b.id,
      name: b.name,
      headId: b.headId,
      commitCount: b._count.commits,
      createdAt: b.createdAt,
    })),
    likeCount: raw._count.likes,
    forkCount: raw._count.forks,
    commentCount: raw._count.comments,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

// ─── Commits ───────────────────────────────────────────────────────────────────

export interface CommitRow {
  id: string
  message: string
  parentId: string | null
  author: { username: string | null; avatarUrl: string | null }
  fileVersion: { size: number; format: FileFormat; checksum: string }
  createdAt: Date
}

export async function getBranchCommits(branchId: string): Promise<CommitRow[]> {
  const commits = await prisma.commit.findMany({
    where: { branchId },
    select: {
      id: true,
      message: true,
      parentId: true,
      author: { select: { username: true, avatarUrl: true } },
      fileVersion: { select: { size: true, format: true, checksum: true } },
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return commits.map((c) => ({
    ...c,
    fileVersion: {
      ...c.fileVersion,
      format: c.fileVersion.format as FileFormat,
    },
  }))
}

// ─── Upload / Commit ───────────────────────────────────────────────────────────

const FORMAT_MAP: Record<string, FileFormat> = {
  bin: 'BIN',
  hex: 'HEX',
  frf: 'FRF',
  ols: 'OLS',
  xdf: 'XDF',
  a2l: 'A2L',
  damos: 'DAMOS',
}

export type UploadState = { error: string } | null

export async function uploadCommit(
  projectId: string,
  branchId: string,
  _: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const file = formData.get('file') as File | null
  const message = (formData.get('message') as string | null)?.trim()

  if (!file || file.size === 0) return { error: 'No file selected' }
  if (!message) return { error: 'Commit message is required' }

  // Validate format
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const format = FORMAT_MAP[ext]
  if (!format) return { error: `Unsupported format: .${ext}` }

  // Verify project ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  })
  if (!project || project.ownerId !== user.id) {
    return { error: 'Project not found or access denied' }
  }

  // Verify branch belongs to project
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { headId: true, projectId: true },
  })
  if (!branch || branch.projectId !== projectId) {
    return { error: 'Branch not found' }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const checksum = createHash('sha256').update(buffer).digest('hex')
  const storageKey = `${projectId}/${checksum}.${ext}`

  // TODO (ADR-006): migrate to Cloudflare R2 — swap this block for @aws-sdk/client-s3
  // Supabase Storage is used temporarily; R2 is the target (no egress cost at scale).
  const supabase = await createClient()
  const { error: uploadError } = await supabase.storage
    .from('ecu-files')
    .upload(storageKey, buffer, {
      contentType: 'application/octet-stream',
      upsert: false,
    })

  // Ignore "already exists" errors — same checksum = same file, reuse it
  if (uploadError && uploadError.message !== 'The resource already exists') {
    return { error: `Storage upload failed: ${uploadError.message}` }
  }

  await prisma.$transaction(async (tx) => {
    // Reuse existing FileVersion if same checksum
    let fileVersion = await tx.fileVersion.findUnique({
      where: { storageKey },
      select: { id: true },
    })

    if (!fileVersion) {
      fileVersion = await tx.fileVersion.create({
        data: {
          storageKey,
          checksum,
          size: buffer.length,
          format,
        },
        select: { id: true },
      })
    }

    const commit = await tx.commit.create({
      data: {
        message,
        branchId,
        parentId: branch.headId,
        authorId: user.id,
        fileVersionId: fileVersion.id,
      },
      select: { id: true },
    })

    await tx.branch.update({
      where: { id: branchId },
      data: { headId: commit.id },
    })

    await tx.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    })
  })

  revalidatePath(`/projects/${projectId}`)
  return null
}
