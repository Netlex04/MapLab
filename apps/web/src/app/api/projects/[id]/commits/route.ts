import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { revalidatePath } from 'next/cache'
import { prisma } from '@maplab/db'
import { createClient } from '@/lib/supabase/server'
import type { FileFormat } from '@maplab/types'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/projects/[id]/commits
// Accepts multipart/form-data:
//   branchId  – string
//   message   – string
//   buffer    – Blob (application/octet-stream)
//   format    – FileFormat string

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: projectId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const branchId = (formData.get('branchId') as string | null)?.trim()
  if (!branchId) {
    return NextResponse.json({ error: 'branchId is required' }, { status: 400 })
  }

  const message = (formData.get('message') as string | null)?.trim()
  if (!message) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }

  const bufferBlob = formData.get('buffer') as Blob | null
  if (!bufferBlob || bufferBlob.size === 0) {
    return NextResponse.json({ error: 'buffer is required' }, { status: 400 })
  }

  const format = (formData.get('format') as FileFormat | null) ?? 'BIN'

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  })
  if (!project || project.ownerId !== user.id) {
    return NextResponse.json({ error: 'Not found or access denied' }, { status: 403 })
  }

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { headId: true, projectId: true },
  })
  if (!branch || branch.projectId !== projectId) {
    return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
  }

  const buffer = Buffer.from(await bufferBlob.arrayBuffer())
  const checksum = createHash('sha256').update(buffer).digest('hex')
  const ext = format.toLowerCase()
  const storageKey = `${projectId}/${checksum}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('ecu-files')
    .upload(storageKey, buffer, {
      contentType: 'application/octet-stream',
      upsert: false,
    })

  if (uploadError && uploadError.message !== 'The resource already exists') {
    return NextResponse.json(
      { error: `Storage upload failed: ${uploadError.message}` },
      { status: 500 },
    )
  }

  await prisma.$transaction(async (tx) => {
    let fileVersion = await tx.fileVersion.findUnique({
      where: { storageKey },
      select: { id: true },
    })

    if (!fileVersion) {
      fileVersion = await tx.fileVersion.create({
        data: { storageKey, checksum, size: buffer.length, format },
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
  return NextResponse.json({ ok: true }, { status: 201 })
}
