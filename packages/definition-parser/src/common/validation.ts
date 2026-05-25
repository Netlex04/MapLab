export type ValidationSeverity = 'info' | 'warning' | 'critical'

export interface ValidationWarning {
  code: string
  severity: ValidationSeverity
  message: string
  mapId?: string
  offset?: number
}

export type DefinitionMatchStatus = 'exact' | 'likely' | 'weak' | 'mismatch' | 'unknown'

export interface DefinitionMatchResult {
  status: DefinitionMatchStatus
  score: number
  warnings: ValidationWarning[]
}
