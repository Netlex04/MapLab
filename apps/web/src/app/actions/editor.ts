'use server'

import { createHash } from 'crypto'
import { revalidatePath } from 'next/cache'
import { prisma } from '@maplab/db'
import { createClient } from '@/lib/supabase/server'
import type { FileFormat } from '@maplab/types'

export type EditorCommitState = { error: string } | null

// ─── commitEditorChanges ──────────────────────────────────────────────────────
//
// Creates a new FileVersion + Commit from a modified buffer produced by the
// editor.  The `buffer` blob is the (WASM-modified) ECU binary; once the real
// WASM write_map_values() is wired in Step 8, this action stays unchanged.
//
// FormData shape:
//   message  – string (required)
//   buffer   – Blob  (required, application/octet-stream)
//   format   – string FileFormat (required)

export async function commitEditorChanges(
  projectId: string,
  branchId: string,
  formData: FormData,
): Promise<EditorCommitState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // ── Validate inputs ──────────────────────────────────────────────────────────

  const message = (formData.get('message') as string | null)?.trim()
  if (!message) return { error: 'Commit message is required' }

  const bufferBlob = formData.get('buffer') as Blob | null
  if (!bufferBlob || bufferBlob.size === 0) return { error: 'No buffer provided' }

  const format = (formData.get('format') as FileFormat | null) ?? 'BIN'

  // ── Authorisation ────────────────────────────────────────────────────────────

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  })
  if (!project || project.ownerId !== user.id) {
    return { error: 'Project not found or access denied' }
  }

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { headId: true, projectId: true },
  })
  if (!branch || branch.projectId !== projectId) {
    return { error: 'Branch not found' }
  }

  // ── Upload to Storage ────────────────────────────────────────────────────────

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
    return { error: `Storage upload failed: ${uploadError.message}` }
  }

  // ── Create DB records ────────────────────────────────────────────────────────

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
  return null
}
