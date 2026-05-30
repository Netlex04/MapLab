import type { MapCategory, DefinitionSourceType, MapConfidence, DataType, Endianness } from './map-definition'
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

  scaleFactor: number
  scaleOffset: number
  dataType: DataType
  endianness: Endianness

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
