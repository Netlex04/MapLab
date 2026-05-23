import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CellChange, EditorParsedMap } from '@/lib/editor/types'

export interface SafetyIssue {
  severity: 'warning' | 'critical'
  message: string
  cells?: [number, number][]
}

export interface SafetyCheckResult {
  passed: boolean
  issues: SafetyIssue[]
}

// Hardcoded safety rules for MS43 maps — extend as needed
function runSafetyRules(
  map: EditorParsedMap,
  changes: CellChange[],
): SafetyIssue[] {
  const issues: SafetyIssue[] = []

  for (const change of changes) {
    const { row, col, newValue } = change

    switch (map.group) {
      case 'FUEL': {
        // Lambda below 0.72 is critically lean
        if (newValue < 0.72) {
          issues.push({
            severity: 'critical',
            message: `Lambda ${newValue.toFixed(2)}λ bei Zeile ${row + 1}/Spalte ${col + 1} ist kritisch mager. Motorschaden möglich.`,
            cells: [[row, col]],
          })
        } else if (newValue < 0.78) {
          issues.push({
            severity: 'warning',
            message: `Lambda ${newValue.toFixed(2)}λ bei Zeile ${row + 1}/Spalte ${col + 1} ist sehr mager.`,
            cells: [[row, col]],
          })
        }
        break
      }
      case 'IGNITION': {
        // Over 32° advance is risky on N42/N46
        if (newValue > 32) {
          issues.push({
            severity: 'critical',
            message: `Zündwinkel ${newValue}°KW bei Zeile ${row + 1}/Spalte ${col + 1} überschreitet sicheres Limit (32°KW).`,
            cells: [[row, col]],
          })
        } else if (newValue > 28) {
          issues.push({
            severity: 'warning',
            message: `Zündwinkel ${newValue}°KW bei Zeile ${row + 1}/Spalte ${col + 1} nahe am Klopflimit.`,
            cells: [[row, col]],
          })
        }
        break
      }
      case 'TORQUE': {
        if (newValue > 250) {
          issues.push({
            severity: 'warning',
            message: `Drehmomentsollwert ${newValue} Nm bei Zeile ${row + 1}/Spalte ${col + 1} überschreitet Werksfreigabe.`,
            cells: [[row, col]],
          })
        }
        break
      }
    }
  }

  return issues
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Try forwarding to Python service first; fall back to built-in rules
  const ecuUrl = process.env.ECU_PARSER_URL
  const ecuSecret = process.env.ECU_PARSER_SECRET ?? 'dev-secret'

  const body = await req.json()
  const { map, changes } = body as { map: EditorParsedMap; changes: CellChange[] }

  if (ecuUrl) {
    try {
      const res = await fetch(`${ecuUrl}/safety-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': ecuSecret },
        body: JSON.stringify({ map, changes }),
        signal: AbortSignal.timeout(5_000),
      })
      if (res.ok) return NextResponse.json(await res.json())
    } catch {
      // fall through to built-in rules
    }
  }

  const issues = runSafetyRules(map, changes)
  const hasCritical = issues.some((i) => i.severity === 'critical')

  const result: SafetyCheckResult = {
    passed: !hasCritical,
    issues,
  }

  return NextResponse.json(result)
}
