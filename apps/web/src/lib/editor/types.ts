export type MapGroup = 'TORQUE' | 'FUEL' | 'IGNITION' | 'VVT' | 'OTHER'

export interface EditorParsedMap {
  id: string
  name: string
  group: MapGroup
  offset: number
  rows: number
  cols: number
  xAxisLabel: string
  yAxisLabel: string
  xAxisValues: number[]
  yAxisValues: number[]
  values: number[][]
  unit: string
  min: number
  max: number
}

export interface EditorParsedECU {
  ecuType: string
  maps: EditorParsedMap[]
}

export interface CellChange {
  row: number
  col: number
  originalValue: number
  newValue: number
}

export interface EditorAIMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}
