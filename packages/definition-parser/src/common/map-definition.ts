export type MapCategory =
  | 'ignition'
  | 'fuel'
  | 'lambda'
  | 'torque'
  | 'driver_wish'
  | 'limit'
  | 'vanos'
  | 'idle'
  | 'maf'
  | 'boost'
  | 'diagnostic'
  | 'unknown'

export type DataType =
  | 'uint8'
  | 'int8'
  | 'uint16'
  | 'int16'
  | 'uint32'
  | 'int32'
  | 'float32'

export type Endianness = 'big' | 'little'

export type DefinitionSourceType =
  | 'internal'
  | 'xdf'
  | 'ecuflash_xml'
  | 'romraider_xml'
  | 'damos'
  | 'a2l'
  | 'manual'

export type MapConfidence =
  | 'verified'
  | 'definition'
  | 'user_uploaded'
  | 'inferred'
  | 'unknown'

export type AxisSource = 'inline' | 'address' | 'calculated' | 'index' | 'unknown'

export interface AxisDefinition {
  label?: string
  unit?: string
  source: AxisSource
  values?: number[]
  offset?: number
  length?: number
  dataType?: DataType
  endianness?: Endianness
  scale?: {
    factor: number
    offset: number
  }
}

export interface MapDefinition {
  id: string
  name: string
  description?: string
  category: MapCategory

  offset: number
  rows: number
  cols: number

  dataType: DataType
  endianness: Endianness

  value: {
    unit?: string
    factor: number
    offset: number
    expression?: string
  }

  xAxis?: AxisDefinition
  yAxis?: AxisDefinition

  source: {
    type: DefinitionSourceType
    name?: string
    version?: string
    author?: string
    license?: string
  }

  compatibility?: {
    ecu?: 'MS42' | 'MS43' | 'MS45'
    softwareVersion?: string
    expectedFileSize?: number
    fingerprints?: string[]
  }

  confidence: MapConfidence
  safetyTags?: string[]
  metadata?: Record<string, unknown>
}
