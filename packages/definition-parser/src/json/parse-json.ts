import type { MapDefinition } from '../common/map-definition'
import type { NormalizeXdfResult } from '../xdf/normalize-xdf'

/**
 * Parse a JSON file that contains MapDefinition data.
 *
 * Accepted shapes:
 *   - MapDefinition[]                      — plain array (e.g. internal definition files)
 *   - { definitions: MapDefinition[] }     — wrapped format
 *
 * Entries missing required fields (id, offset, rows, cols) are skipped with a warning.
 * Throws if the top-level structure is wrong or no valid entries remain.
 */
export function parseAndNormalizeJson(jsonText: string, fileName: string): NormalizeXdfResult {
  let raw: unknown
  try {
    raw = JSON.parse(jsonText)
  } catch {
    throw new Error(`${fileName}: invalid JSON`)
  }

  let items: unknown[]
  if (Array.isArray(raw)) {
    items = raw
  } else if (
    raw !== null &&
    typeof raw === 'object' &&
    'definitions' in raw &&
    Array.isArray((raw as Record<string, unknown>).definitions)
  ) {
    items = (raw as { definitions: unknown[] }).definitions
  } else {
    throw new Error(
      `${fileName}: expected a MapDefinition[] array or { definitions: MapDefinition[] } object`,
    )
  }

  if (items.length === 0) {
    throw new Error(`${fileName}: file contains no definitions`)
  }

  const warnings: string[] = []
  const definitions: MapDefinition[] = []
  let skipped = 0

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item || typeof item !== 'object') {
      skipped++
      continue
    }
    const obj = item as Record<string, unknown>
    if (!('id' in obj) || !('offset' in obj) || !('rows' in obj) || !('cols' in obj)) {
      warnings.push(`Entry ${i}: missing required fields (id, offset, rows, cols) — skipped`)
      skipped++
      continue
    }
    definitions.push(obj as unknown as MapDefinition)
  }

  if (skipped > 0 && warnings.length === 0) {
    warnings.push(`${skipped} entr${skipped === 1 ? 'y' : 'ies'} skipped due to invalid structure`)
  }

  if (definitions.length === 0) {
    throw new Error(`${fileName}: no valid definitions found`)
  }

  return {
    definitions,
    warnings,
    stats: {
      tablesFound: 0,
      constantsFound: 0,
      definitionsCreated: definitions.length,
    },
  }
}
