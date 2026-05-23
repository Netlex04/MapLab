import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const client = new Anthropic()

const SYSTEM_PROMPT = `Du bist ein erfahrener Kfz-Elektronik-Experte mit Schwerpunkt BMW ECU-Tuning (MS43, MS42, MS45, GS20).
Erkläre ECU-Karten verständlich für Hobby-Tuner. Verwende technisch korrekte Fachbegriffe, aber erkläre sie kurz.
Antworte auf Deutsch, in 2–4 Sätzen. Mache KEINE konkreten Wertvorschläge ohne spezifischen Kontext.
Weise bei sicherheitskritischen Karten kurz auf die Fahrzeugsicherheit hin.`

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { mapId, mapName, unit, ecuType } = body as {
    mapId: string
    mapName: string
    unit: string
    ecuType: string | null
  }

  if (!mapId || !mapName) {
    return NextResponse.json({ error: 'Missing mapId or mapName' }, { status: 400 })
  }

  const prompt = `ECU-Typ: ${ecuType ?? 'unbekannt'}
Karte: ${mapName} (Einheit: ${unit})

Was macht diese Karte und warum ist sie für das Tuning relevant?`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    })

    const text =
      message.content[0]?.type === 'text' ? message.content[0].text : ''

    return NextResponse.json({ explanation: text })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI unavailable' },
      { status: 502 },
    )
  }
}
