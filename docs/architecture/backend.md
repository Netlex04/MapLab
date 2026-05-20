# Backend-Architektur

## Strategie: Modularer Monolith (MVP)

Statt sofortiger Microservices: ein **Next.js Full-Stack-Monolith** mit klar getrennten Modulen. Jedes Modul kann später als eigener Service extrahiert werden.

```
server/
├── modules/
│   ├── auth/           # Authentifizierung, Rollen
│   ├── projects/       # Projekt-CRUD
│   ├── versions/       # Versionierungslogik
│   ├── community/      # Likes, Kommentare, Follows
│   ├── ai/             # Claude-Copilot-Integration
│   ├── ecu/            # ECU-Parsing (Python-Bridge)
│   ├── storage/        # File Upload/Download
│   └── marketplace/    # Phase 3
├── shared/
│   ├── db.ts           # Prisma Client
│   ├── auth.ts         # Session-Utils
│   └── events.ts       # Domain Events
└── middleware/
    ├── rateLimit.ts
    ├── authGuard.ts
    └── roleCheck.ts
```

---

## API-Design

Next.js **Server Actions** für Mutations, **Route Handlers** für REST/Streaming.

```
POST   /api/projects                    # Projekt erstellen
GET    /api/projects/:id                # Projekt laden
POST   /api/projects/:id/versions       # Neue Version committen
GET    /api/projects/:id/versions       # Commit-Historie
POST   /api/projects/:id/files/upload   # ECU-Datei hochladen
GET    /api/projects/:id/diff?v1=&v2=   # Diff berechnen

POST   /api/ai/analyze                  # Map-Analyse
POST   /api/ai/explain                  # Map erklären
GET    /api/ai/stream                   # SSE für Streaming-Antworten

GET    /api/explore                     # Community-Feed
POST   /api/projects/:id/fork           # Fork erstellen
POST   /api/projects/:id/likes          # Like togglen
```

---

## Authentifizierung

```
Supabase Auth
├── Email/Password
├── OAuth: Google, GitHub
├── JWT (15min Access Token + Refresh Token)
└── Row Level Security (RLS) in PostgreSQL
```

**Rollen-Hierarchie** (in JWT-Claims codiert):

```
admin > moderator > verified_tuner > user
```

Middleware prüft Rolle vor jedem geschützten Handler.

---

## Versionierungssystem

Angelehnt an Git, aber auf ECU-Binärdateien optimiert:

```
Project (1)
  └── Branch[] (main, stage2, experimental...)
        └── Commit[]
              ├── id (UUID)
              ├── parentId
              ├── message
              ├── authorId
              ├── createdAt
              ├── fileVersionId → FileVersion
              └── diff (komprimiertes BinaryDiff)

FileVersion
  ├── checksum (SHA-256)
  ├── storageKey (R2/S3)
  └── size
```

**Diff-Berechnung**: Server-seitig via Python-Microservice (xdelta3 oder eigener Algorithmus), Ergebnis in R2 gecacht.

---

## ECU Parser Service (Python)

Ausgelagerter Microservice für heavy-duty Server-Operationen:

```
POST /parse           # Vollständige ECU-Analyse
POST /checksum        # Checksum-Validierung
POST /diff            # Binary Diff berechnen
POST /safety-check    # Plausibilitätsprüfung
```

Kommunikation über **interne HTTP** oder **Supabase Edge Function** (für einfachen Start).

Verwendete Libraries:
- **python-ecumaster** / eigene Parser
- **xdelta3** für Binary Diffs
- **numpy** für Map-Berechnungen

---

## File Storage

```
Cloudflare R2 (S3-kompatibel)
├── ecu-files/
│   └── {projectId}/{commitId}/original.bin
├── diffs/
│   └── {projectId}/{v1}-{v2}.xdelta
└── exports/
    └── {userId}/{exportId}.bin
```

**Upload-Flow**:
1. Client → Server: Metadata + Presigned URL anfordern
2. Client → R2: Direkter Upload (kein Server-Bottleneck)
3. Server: Upload-Callback → ECU Parser → DB-Update

---

## Caching-Strategie

| Ebene | Tool | Inhalt |
|---|---|---|
| HTTP | Next.js Cache | API-Responses, Static Assets |
| DB-Queries | Redis | Explore-Feed, User-Profiles |
| Diffs | R2 | Berechnete Diffs (immutabel) |
| AI-Antworten | Redis (1h TTL) | Gleiche Map-Erklärungs-Anfragen |

---

## Realtime (Phase 2)

Supabase Realtime für Live-Collaboration:

```typescript
// Cursor-Positionen anderer Nutzer
supabase
  .channel(`project:${projectId}`)
  .on('presence', handlePresence)
  .on('broadcast', { event: 'cell_edit' }, handleCellEdit)
  .subscribe()
```

Konfliktresolution: **Operational Transform** (vereinfacht) oder **CRDT** (Yjs) für gleichzeitige Map-Edits.
