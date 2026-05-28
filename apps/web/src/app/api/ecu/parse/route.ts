import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const ecuUrl = process.env.ECU_PARSER_URL ?? 'http://localhost:8000'
  const secret = process.env.ECU_PARSER_SECRET ?? 'dev-secret'

  const includeUnknown = req.nextUrl.searchParams.get('include_unknown') === 'true'

  const upstream = new FormData()
  upstream.append('file', file)

  try {
    const res = await fetch(
      `${ecuUrl}/parse${includeUnknown ? '?include_unknown=true' : ''}`,
      {
        method: 'POST',
        headers: { 'x-internal-secret': secret },
        body: upstream,
        signal: AbortSignal.timeout(30_000),
      },
    )
    if (!res.ok) throw new Error(`ECU engine responded with ${res.status}`)
    return NextResponse.json(await res.json())
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'ECU engine unavailable' },
      { status: 502 },
    )
  }
}
