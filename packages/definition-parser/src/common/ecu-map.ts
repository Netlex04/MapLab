import type { MapCategory, DefinitionSourceType, MapConfidence } from './map-definition'
import type { ValidationWarning } from './validation'

export interface ExtractionAxis {
  label?: string
  unit?: string
  values: number[]
}

export interface ExtractedMap {
  id: string
  definitionId: string

  name: string
  category: MapCategory

  offset: number
  rows: number
  cols: number

  valueUnit?: string

  xAxis: ExtractionAxis
  yAxis: ExtractionAxis

  values: number[][]
  rawValues: number[][]

  source: {
    type: DefinitionSourceType
    name?: string
    version?: string
  }

  confidence: MapConfidence
  warnings: ValidationWarning[]
}

export interface ExtractionResult {
  maps: ExtractedMap[]
  warnings: ValidationWarning[]
}
