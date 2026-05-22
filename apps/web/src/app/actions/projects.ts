'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@maplab/db'
import { createClient } from '@/lib/supabase/server'
import type { Visibility } from '@maplab/types'

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

  const project = await prisma.project.create({
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
