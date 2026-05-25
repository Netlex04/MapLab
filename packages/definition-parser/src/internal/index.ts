// Internal definition loader.
// Maps are stored as pre-generated JSON (derived from community XDF files, not ROM data).
// Dynamic imports ensure each definition set is a separate bundle chunk and only
// loaded when the matched ECU type is actually opened.

import type { MapDefinition } from '../common/map-definition'

export type { InternalECU, FingerprintResult } from './fingerprint'
export { fingerprintROM } from './fingerprint'

import type { InternalECU } from './fingerprint'

// Module-level cache — the same JSON is not re-parsed on repeated calls.
const definitionCache = new Map<string, MapDefinition[]>()

/**
 * Returns the internal MapDefinition[] for the given ECU / software version,
 * or null if no built-in definition exists for that combination.
 *
 * The first call for a given key triggers a dynamic import (separate chunk).
 * Subsequent calls return the cached result synchronously.
 */
export async function loadInternalDefinition(
  ecu: InternalECU,
  softwareVersion: string,
): Promise<MapDefinition[] | null> {
  const key = `${ecu}:${softwareVersion}`

  const cached = definitionCache.get(key)
  if (cached !== undefined) return cached

  let defs: MapDefinition[] | null = null

  if (ecu === 'MS43' && softwareVersion === 'MS430069') {
    const mod = await import('./ms43/ms430069.json')
    defs = mod.default as unknown as MapDefinition[]
  } else if (ecu === 'MS42' && softwareVersion === '0110C6') {
    const mod = await import('./ms42/0110c6.json')
    defs = mod.default as unknown as MapDefinition[]
  }

  if (defs !== null) definitionCache.set(key, defs)
  return defs
}
