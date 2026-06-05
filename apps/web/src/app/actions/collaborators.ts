'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@maplab/db'
import { createClient } from '@/lib/supabase/server'

// ─── Auth Helper ──────────────────────────────────────────────────────────────

async function getAuthUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type CollaboratorRole = 'EDITOR' | 'VIEWER'
export type CollaboratorStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED'

export interface CollaboratorRow {
  id: string
  userId: string
  username: string | null
  avatarUrl: string | null
  role: CollaboratorRole
  status: CollaboratorStatus
  invitedAt: Date
}

export interface PendingInviteRow {
  id: string
  projectId: string
  projectName: string
  ownerUsername: string | null
  role: CollaboratorRole
  invitedAt: Date
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getCollaborators(projectId: string): Promise<CollaboratorRow[]> {
  const user = await getAuthUser()
  if (!user) return []

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  })
  if (!project) return []

  const isOwner = project.ownerId === user.id
  if (!isOwner) {
    const accepted = await prisma.projectCollaborator.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
      select: { status: true },
    })
    if (!accepted || accepted.status !== 'ACCEPTED') return []
  }

  const collaborators = await prisma.projectCollaborator.findMany({
    where: { projectId },
    select: {
      id: true,
      userId: true,
      role: true,
      status: true,
      createdAt: true,
      user: { select: { username: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return collaborators.map((c) => ({
    id: c.id,
    userId: c.userId,
    username: c.user.username,
    avatarUrl: c.user.avatarUrl,
    role: c.role as CollaboratorRole,
    status: c.status as CollaboratorStatus,
    invitedAt: c.createdAt,
  }))
}

export async function getPendingInvites(): Promise<PendingInviteRow[]> {
  const user = await getAuthUser()
  if (!user) return []

  const invites = await prisma.projectCollaborator.findMany({
    where: { userId: user.id, status: 'PENDING' },
    select: {
      id: true,
      projectId: true,
      role: true,
      createdAt: true,
      project: {
        select: {
          name: true,
          owner: { select: { username: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return invites.map((i) => ({
    id: i.id,
    projectId: i.projectId,
    projectName: i.project.name,
    ownerUsername: i.project.owner.username,
    role: i.role as CollaboratorRole,
    invitedAt: i.createdAt,
  }))
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function inviteCollaborator(
  projectId: string,
  usernameOrEmail: string,
  role: CollaboratorRole,
): Promise<{ error: string } | { id: string } | null> {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  })
  if (!project) return { error: 'Project not found' }
  if (project.ownerId !== user.id) return { error: 'Only the project owner can invite collaborators' }

  const trimmed = usernameOrEmail.trim()
  const target = await prisma.user.findFirst({
    where: {
      OR: [
        { username: { equals: trimmed, mode: 'insensitive' } },
        { email: { equals: trimmed, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  })
  if (!target) return { error: 'User not found' }
  if (target.id === user.id) return { error: 'You cannot invite yourself as a collaborator' }

  const existing = await prisma.projectCollaborator.findUnique({
    where: { projectId_userId: { projectId, userId: target.id } },
    select: { id: true, status: true },
  })
  if (existing) {
    if (existing.status === 'REJECTED') {
      const updated = await prisma.projectCollaborator.update({
        where: { id: existing.id },
        data: { role, status: 'PENDING', invitedById: user.id },
        select: { id: true },
      })
      revalidatePath(`/projects/${projectId}`)
      return { id: updated.id }
    }
    return { error: 'User is already a collaborator or has a pending invite' }
  }

  const collaborator = await prisma.projectCollaborator.create({
    data: {
      projectId,
      userId: target.id,
      role,
      invitedById: user.id,
    },
    select: { id: true },
  })

  revalidatePath(`/projects/${projectId}`)
  return { id: collaborator.id }
}

export async function respondToInvite(
  inviteId: string,
  accept: boolean,
): Promise<{ error: string } | null> {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const invite = await prisma.projectCollaborator.findUnique({
    where: { id: inviteId },
    select: { userId: true, projectId: true, status: true },
  })
  if (!invite) return { error: 'Invite not found' }
  if (invite.userId !== user.id) return { error: 'Not authorized' }
  if (invite.status !== 'PENDING') return { error: 'Invite is no longer pending' }

  await prisma.projectCollaborator.update({
    where: { id: inviteId },
    data: { status: accept ? 'ACCEPTED' : 'REJECTED' },
  })

  revalidatePath(`/projects/${invite.projectId}`)
  return null
}

export async function removeCollaborator(
  projectId: string,
  userId: string,
): Promise<{ error: string } | null> {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  })
  if (!project) return { error: 'Project not found' }
  if (project.ownerId !== user.id) return { error: 'Only the project owner can remove collaborators' }

  await prisma.projectCollaborator.deleteMany({
    where: { projectId, userId },
  })

  revalidatePath(`/projects/${projectId}`)
  return null
}

export async function updateCollaboratorRole(
  projectId: string,
  userId: string,
  role: CollaboratorRole,
): Promise<{ error: string } | null> {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  })
  if (!project) return { error: 'Project not found' }
  if (project.ownerId !== user.id) return { error: 'Only the project owner can update collaborator roles' }

  const collaborator = await prisma.projectCollaborator.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { id: true, status: true },
  })
  if (!collaborator) return { error: 'Collaborator not found' }
  if (collaborator.status !== 'ACCEPTED') return { error: 'Can only update role for accepted collaborators' }

  await prisma.projectCollaborator.update({
    where: { id: collaborator.id },
    data: { role },
  })

  revalidatePath(`/projects/${projectId}`)
  return null
}

export async function leaveProject(projectId: string): Promise<{ error: string } | null> {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  await prisma.projectCollaborator.deleteMany({
    where: { projectId, userId: user.id },
  })

  revalidatePath(`/projects/${projectId}`)
  return null
}
