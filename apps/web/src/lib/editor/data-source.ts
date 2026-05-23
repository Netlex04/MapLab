import type { EditorParsedECU } from './types'

export interface DataSource {
  loadECU(fileUrl: string | null, ecuType: string | null): Promise<EditorParsedECU>
}

class MockDataSource implements DataSource {
  async loadECU(_fileUrl: string | null, ecuType: string | null): Promise<EditorParsedECU> {
    const { getMockECU } = await import('./mock-data')
    return getMockECU(ecuType)
  }
}

// Placeholder — wired up once Python /parse/full is ready
class APIDataSource implements DataSource {
  async loadECU(fileUrl: string | null, ecuType: string | null): Promise<EditorParsedECU> {
    if (!fileUrl) throw new Error('APIDataSource requires a fileUrl')
    const ecuUrl = process.env.NEXT_PUBLIC_ECU_PARSER_URL ?? 'http://localhost:8000'
    const res = await fetch(`${ecuUrl}/parse/full`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileUrl, ecuType }),
    })
    if (!res.ok) throw new Error(`Parser responded ${res.status}`)
    return res.json()
  }
}

export function createDataSource(): DataSource {
  const mode = process.env.NEXT_PUBLIC_EDITOR_DATASOURCE ?? 'mock'
  switch (mode) {
    case 'api':
      return new APIDataSource()
    case 'mock':
    default:
      return new MockDataSource()
  }
}
