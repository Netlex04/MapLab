# MapLab – Systemarchitektur

## Überblick

MapLab (TuneForge) ist eine webbasierte ECU-Tuning-Plattform. Die Architektur folgt einem **modularen Monolith mit selektiven Microservices** – pragmatisch für MVP, skalierbar für spätere Phasen.

---

## Systemdiagramm

```
┌─────────────────────────────────────────────────────────────────────┐
│                            CLIENTS                                  │
│   Browser (Next.js SPA/SSR)           Mobile App (Phase 4)          │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ HTTPS / WebSocket
┌───────────────────────────▼─────────────────────────────────────────┐
│                        API GATEWAY                                  │
│              (Next.js API Routes + Edge Middleware)                 │
└───┬──────────┬──────────┬──────────┬──────────┬───────────┬─────────┘
    │          │          │          │          │           │
    ▼          ▼          ▼          ▼          ▼           ▼
┌───────┐ ┌───────┐ ┌────────┐ ┌────────┐ ┌───────┐ ┌──────────┐
│ Auth  │ │Project│ │Version │ │Commun- │ │  AI   │ │  ECU     │
│Service│ │Service│ │Control │ │ity Svc │ │Copilot│ │ Parser   │
└───┬───┘ └───┬───┘ └───┬────┘ └───┬────┘ └───┬───┘ └────┬─────┘
    │         │          │          │          │           │
    └────┬────┴──────────┴──────────┴──────────┴───────────┘
         │                   DATENBANK-SCHICHT
         ▼
┌────────────────────────────────────────────────────────────────────┐
│   PostgreSQL (Supabase)  │  Redis Cache  │  pgvector (Embeddings) │
├────────────────────────────────────────────────────────────────────┤
│               Object Storage (Cloudflare R2 / S3)                 │
│                    ECU-Binärdateien, Diffs                        │
└────────────────────────────────────────────────────────────────────┘
```

---

## Kernprinzipien

| Prinzip | Entscheidung |
|---|---|
| **Frontend-first** | Next.js App Router, alles SSR-fähig |
| **Binary-Processing im Browser** | WASM für Hex/Map-Parsing (kein Upload nötig für Preview) |
| **Realtime** | Supabase Realtime für Live-Collaboration |
| **AI als Assistent** | Claude API, niemals autonomes Schreiben |
| **Git-Analogie** | Eigene Versionierungsschicht über PostgreSQL |
| **Security-First** | Checksums, Plausibilitätsprüfung vor jeder Publikation |

---

## Phasenplanung

| Phase | ECU-Scope | Architektur-Fokus |
|---|---|---|
| MVP | Siemens MS42, MS43, MS45, GS20 | Monolith, Next.js Full-Stack, Supabase |
| Phase 2 | + Bosch ME7.x | AI-Service auslagern, WebSocket-Layer |
| Phase 3 | + Bosch MED17, VAG | Marketplace-Service, Payment-Integration |
| Phase 4 | Breit | Mobile App (React Native), OBD-Bridge |
