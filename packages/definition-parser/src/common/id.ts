import type { MapDefinition } from './map-definition'

/**
 * Generates a stable, deterministic ID for a MapDefinition.
 * Stable across sessions so the same definition always produces the same ID.
 */
export function generateMapId(def: Pick<MapDefinition, 'name' | 'offset'> & {
  ecu?: string
}): string {
  const ecu = def.ecu ?? 'unknown'
  const name = def.name.replace(/\s+/g, '_').toLowerCase()
  return `${ecu}_${name}_0x${def.offset.toString(16).padStart(5, '0')}`
}
