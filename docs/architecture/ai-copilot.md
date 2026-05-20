# AI Copilot – Architektur

## Prinzipien

Der AI Copilot ist **Assistent, nicht Autopilot**. Er schreibt niemals eigenständig flashfähige Dateien.

```
Nutzer-Anfrage
     │
     ▼
Kontext-Aggregation (Maps, Metadaten, Community-Daten)
     │
     ▼
Claude API (claude-sonnet-4-6 / claude-opus-4-7)
     │
     ▼
Response-Validation (Safety-Filter)
     │
     ▼
Streaming-Antwort → UI
```

---

## Funktionen & Implementierung

### 1. Map-Erkennung

**Trigger**: Upload einer ECU-Datei  
**Input**: WASM-Parser → rohe Map-Daten (Offset, Dimensionen, Werte)  
**Output**: Wahrscheinlichster Map-Typ + Konfidenz

```typescript
interface MapClassificationRequest {
  offset: number;
  rows: number;
  cols: number;
  xAxisValues: number[];
  yAxisValues: number[];
  values: number[][];
  ecuType?: string;
}

interface MapClassificationResult {
  label: string;        // "Torque Limiter"
  mapType: MapType;
  confidence: number;   // 0-1
  explanation: string;
}
```

Prompt-Strategie: Few-Shot mit bekannten ECU-Map-Mustern im System-Prompt.

---

### 2. Map-Erklärung (Lernmodus)

**Trigger**: Nutzer klickt „Erklären" auf einer Map  
**Kontext**: Map-Typ, Wertebereiche, Fahrzeugdaten

```typescript
const systemPrompt = `
Du bist ein ECU-Tuning-Experte. Erkläre Maps verständlich für 
Hobby-Tuner. Verwende Analogien. Weise auf Sicherheitsrisiken hin.
Schlage niemals konkrete Wertänderungen vor ohne Kontext.
`;
```

---

### 3. Sicherheitswarnungen

**Trigger**: Immer nach Map-Edit, vor Commit

```typescript
interface SafetyCheckInput {
  mapType: MapType;
  values: number[][];
  vehicleData: VehicleContext;
  relatedMaps: Map[];  // z.B. Lambda + Boost zusammen prüfen
}

interface SafetyWarning {
  severity: 'info' | 'warning' | 'critical';
  message: string;
  affectedCells?: CellRef[];
}
```

Prüfung läuft **lokal** (Regel-basiert, schnell) + optionale Claude-Analyse für Kontext.

---

### 4. Community-Vergleich

**Trigger**: Nutzer aktiviert „Ähnliche Builds vergleichen"  
**Implementierung**: pgvector-Similarity-Search über Map-Embeddings

```sql
SELECT p.id, p.name,
       1 - (me.embedding <=> $1) AS similarity
FROM map_embeddings me
JOIN maps m ON m.id = me.map_id
JOIN file_versions fv ON fv.id = m.file_version_id
JOIN commits c ON c.file_version_id = fv.id
JOIN branches b ON b.id = c.branch_id
JOIN projects p ON p.id = b.project_id
WHERE p.visibility = 'PUBLIC'
ORDER BY similarity DESC
LIMIT 10;
```

---

### 5. Intelligent Search

**Trigger**: Nutzersuche im Editor  
**Beispiel**: „Zeige alle Torque Limiter"

```
Nutzer-Query (natural language)
     │
     ▼ Intent Classification (lokal / Claude)
     │
     ├── mapType: TORQUE → DB-Query auf maps.type
     │
     └── fulltext → PostgreSQL Fulltext auf map.name / map.aiLabel
```

---

### 6. AI Autocomplete

**Trigger**: Nutzer beginnt Achsbeschriftung oder Map-Name einzugeben  
**Implementierung**: Client-Side mit gecachten Vorschlägen (Redis), kein Round-Trip nötig

---

## Technische Integration

```typescript
// server/modules/ai/copilot.ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function streamMapExplanation(
  map: Map,
  vehicle: Vehicle,
  res: Response
) {
  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: ECU_EXPERT_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: buildMapExplanationPrompt(map, vehicle)
    }]
  });

  // Server-Sent Events zum Client
  for await (const chunk of stream) {
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  }
}
```

---

## Sicherheits-Constraints (nicht verhandelbar)

```typescript
const SAFETY_RULES = [
  'Schlage niemals konkrete Werte ohne explizite Nutzer-Anfrage vor',
  'Weise immer auf Fahrzeugsicherheit hin bei kritischen Maps',
  'Erzeuge niemals direkt flashbare Output-Daten',
  'Kein "One-Click-Tuning" oder automatische Optimierungsvorschläge',
];
```

Diese Regeln sind im System-Prompt jedes AI-Calls hardcodiert und werden **nicht** durch User-Prompts überschrieben.

---

## Kosten-Optimierung

| Funktion | Modell | Caching |
|---|---|---|
| Map-Klassifikation | Haiku 4.5 | 24h Redis-Cache (Map-Hash als Key) |
| Erklärungen | Sonnet 4.6 | 1h Cache |
| Safety Checks | Haiku 4.5 (+ Regel-Engine) | Kein Cache |
| Deep Analysis | Opus 4.7 | Nur Pro-User, kein Cache |
| Autocomplete | Haiku 4.5 | Lokale JSON-Liste bevorzugt |

Prompt Caching (Anthropic API) für System-Prompts aktiviert → reduziert Token-Kosten bei wiederkehrenden Anfragen erheblich.
