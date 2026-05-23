import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CellChange, EditorParsedMap } from '@/lib/editor/types'

// MVP mock export — patches a minimal placeholder binary with changed values.
// Real implementation will forward to Python /export once available.
function mockPatchBinary(
  maps: EditorParsedMap[],
  changes: Record<string, CellChange[]>,
): Buffer {
  // Build a minimal 512KB buffer representing a placeholder ECU binary
  const buf = Buffer.alloc(512 * 1024, 0xff)

  for (const [mapId, cellChanges] of Object.entries(changes)) {
    const map = maps.find((m) => m.id === mapId)
    if (!map) continue

    for (const change of cellChanges) {
      const cellOffset = map.offset + (change.row * map.cols + change.col) * 2
      if (cellOffset + 2 <= buf.length) {
        // Write new value as little-endian uint16 (simplified scaling)
        const scaled = Math.round(change.newValue * 100) & 0xffff
        buf.writeUInt16LE(scaled, cellOffset)
      }
    }
  }

  return buf
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { maps, changes } = body as {
    maps: EditorParsedMap[]
    changes: Record<string, CellChange[]>
  }

  const ecuUrl = process.env.ECU_PARSER_URL
  const ecuSecret = process.env.ECU_PARSER_SECRET ?? 'dev-secret'

  if (ecuUrl) {
    try {
      const res = await fetch(`${ecuUrl}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': ecuSecret },
        body: JSON.stringify({ maps, changes }),
        signal: AbortSignal.timeout(10_000),
      })
      if (res.ok) {
        const data = await res.json()
        return NextResponse.json({ binBase64: data.binBase64 })
      }
    } catch {
      // fall through to mock
    }
  }

  const binary = mockPatchBinary(maps, changes)
  return NextResponse.json({ binBase64: binary.toString('base64') })
}
