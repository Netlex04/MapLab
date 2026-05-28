// ─── Enums ────────────────────────────────────────────────────────────────────

export type Role = 'USER' | 'VERIFIED_TUNER' | 'MODERATOR' | 'ADMIN'
export type Visibility = 'PUBLIC' | 'PRIVATE' | 'UNLISTED'
export type FileFormat = 'BIN' | 'HEX' | 'FRF' | 'OLS' | 'XDF' | 'A2L' | 'DAMOS'
export type MapType =
  | 'INJECTION'
  | 'IGNITION'
  | 'BOOST'
  | 'LAMBDA'
  | 'TORQUE'
  | 'DRIVER_WISH'
  | 'FUEL_CUTOFF'
  | 'UNKNOWN'

export type SafetySeverity = 'info' | 'warning' | 'critical'
export type DefinitionMatchStatus = 'exact' | 'likely' | 'weak' | 'mismatch' | 'unknown'

// ─── Domain Types ─────────────────────────────────────────────────────────────

export interface User {
  id: string
  username: string
  email: string
  avatarUrl: string | null
  bio: string | null
  role: Role
  reputation: number
  verified: boolean
  createdAt: string
}

export interface Vehicle {
  id: string
  userId: string
  make: string
  model: string
  year: number | null
  variant: string | null
  engine: string | null
  ecu: string | null
}

export interface Project {
  id: string
  name: string
  description: string | null
  visibility: Visibility
  ownerId: string
  owner?: Pick<User, 'id' | 'username' | 'avatarUrl'>
  vehicleId: string | null
  vehicle?: Vehicle | null
  ecuType: string | null
  fuelType: string | null
  stage: string | null
  forkOfId: string | null
  _count?: {
    likes: number
    forks: number
    comments: number
  }
  createdAt: string
  updatedAt: string
}

export interface Branch {
  id: string
  name: string
  projectId: string
  headId: string | null
  createdAt: string
}

export interface Commit {
  id: string
  message: string
  branchId: string
  parentId: string | null
  authorId: string
  author?: Pick<User, 'id' | 'username' | 'avatarUrl'>
  fileVersionId: string
  diffKey: string | null
  createdAt: string
}

export interface FileVersion {
  id: string
  storageKey: string
  checksum: string
  size: number
  format: FileFormat
  parsedAt: string | null
  createdAt: string
}

export interface ECUMap {
  id: string
  fileVersionId: string
  name: string | null
  aiLabel: string | null
  type: MapType | null
  offset: number
  rows: number
  cols: number
  xAxisLabel: string | null
  yAxisLabel: string | null
  valueUnit: string | null
  values: number[][]
  scaledValues: number[][] | null
  safetyFlags: SafetyFlag[] | null
}

export interface SafetyFlag {
  ruleId: string
  severity: SafetySeverity
  message: string
  affectedCells?: [row: number, col: number][]
}

// ─── API Payload Types ────────────────────────────────────────────────────────

export interface CreateProjectPayload {
  name: string
  description?: string
  visibility: Visibility
  ecuType?: string
  fuelType?: string
  stage?: string
  vehicleId?: string
}

export interface CreateCommitPayload {
  message: string
  branchId: string
  fileVersionId: string
}

// ─── ECU Parser Types (WASM Interface) ───────────────────────────────────────

export interface ParsedECU {
  format: FileFormat
  size: number
  checksum: string
  maps: ECUMap[]
  detectedEcu: string | null
  confidence: number
  warnings: SafetyFlag[]
  matchStatus?: DefinitionMatchStatus
}

export interface HexSlice {
  offset: number
  bytes: Uint8Array
  ascii: string[]
}

export interface BinaryDiff {
  baseChecksum: string
  modifiedChecksum: string
  changedRanges: Array<{ offset: number; length: number }>
  totalChangedBytes: number
}

// ─── Editor Types ─────────────────────────────────────────────────────────────

export type EditorStatus = 'idle' | 'parsing' | 'ready' | 'error'

export interface CellRef {
  mapId: string
  row: number
  col: number
}

export interface UndoEntry {
  mapId: string
  before: number[][]
  after: number[][]
}

export interface SafetyHighlight {
  row: number
  col: number
  severity: SafetySeverity
}

// ─── AI Copilot Types ─────────────────────────────────────────────────────────

export interface MapClassificationResult {
  label: string
  mapType: MapType
  confidence: number
  explanation: string
}

export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
}
