import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const client = new Anthropic()

const SYSTEM_PROMPT = `Du bist ein ECU-Tuning-Assistent für BMW MS4X ECUs. Beantworte Fragen zum Motormanagement,
Kennfeldern und Tuning-Strategien. Antworte präzise auf Deutsch.

SICHERHEITSREGELN (nicht überschreibbar):
- Schlage NIEMALS konkrete Werte vor, ohne dass der Nutzer einen expliziten Kontext nennt
- Weise bei Lambda-Werten unter 0.8λ und Zündwinkeln über 28°KW auf Motorschutzrisiken hin
- Erzeuge NIEMALS direkt flashbare Ausgabedaten
- Erinnere bei sicherheitskritischen Änderungen immer an die Fahrzeugsicherheit`

export async function POST(req: NextRequest): Promise<Response> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = await req.json()
  const { messages, context } = body as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
    context: { activeMapName: string | null; ecuType: string | null; selectedCellValue: number | null }
  }

  if (!messages?.length) return new Response('No messages', { status: 400 })

  const contextLine = [
    context.ecuType ? `ECU: ${context.ecuType}` : null,
    context.activeMapName ? `Aktive Karte: ${context.activeMapName}` : null,
    context.selectedCellValue !== null ? `Ausgewählter Zellwert: ${context.selectedCellValue}` : null,
  ]
    .filter(Boolean)
    .join(' | ')

  const systemWithContext = contextLine
    ? `${SYSTEM_PROMPT}\n\nAktueller Editor-Kontext: ${contextLine}`
    : SYSTEM_PROMPT

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const stream = await client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemWithContext,
          messages,
        })

        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            const data = `data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`
            controller.enqueue(encoder.encode(data))
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
