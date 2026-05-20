# Infrastruktur & Deployment

## Übersicht

```
                    ┌──────────────┐
                    │  Cloudflare  │  DNS, CDN, DDoS-Schutz
                    └──────┬───────┘
                           │
              ┌────────────▼────────────┐
              │         Vercel          │  Next.js App (SSR + Edge)
              │   maplab.app            │
              └────────┬────────────────┘
                       │
         ┌─────────────┼──────────────────┐
         │             │                  │
         ▼             ▼                  ▼
   ┌──────────┐  ┌──────────┐      ┌──────────────┐
   │ Supabase │  │Cloudflare│      │ Railway /    │
   │          │  │    R2    │      │ Fly.io       │
   │ Postgres │  │  Storage │      │              │
   │ Auth     │  │ ECU Files│      │ Python ECU   │
   │ Realtime │  │ Diffs    │      │ Parser Svc   │
   └──────────┘  └──────────┘      └──────────────┘
```

---

## Services im Detail

### Vercel (Frontend + API)

- **Next.js** mit App Router
- **Edge Middleware** für Auth-Guard (JWT-Validation ohne DB-Round-Trip)
- **Edge Functions** für latenzarme API-Endpunkte (z.B. AI-Streaming)
- **ISR** für Community-Feed und öffentliche Projektseiten

### Supabase

| Feature | Nutzung |
|---|---|
| PostgreSQL | Haupt-Datenbank |
| Auth | JWT, OAuth (Google/GitHub), Row Level Security |
| Realtime | Live-Collaboration (Phase 2) |
| Edge Functions | Webhooks, Upload-Callbacks |
| Storage | Avatare, kleine Thumbnails (ECU-Dateien → R2) |

### Cloudflare R2

- ECU-Binärdateien (bis ~8 MB typisch)
- Berechnete Binary-Diffs
- Export-Dateien
- Kein Egress-Cost → günstig für große Download-Volumina

### Railway / Fly.io (Python Service)

- **FastAPI**-Server für ECU-Parsing
- Autoscaling auf 0 bei keiner Last (kostensparend im MVP)
- Kommunikation nur über **interne URLs** (nicht öffentlich exponiert)

---

## Umgebungen

| Umgebung | Branch | Domain | DB |
|---|---|---|---|
| Production | `main` | maplab.app | Supabase Production |
| Staging | `staging` | staging.maplab.app | Supabase Staging |
| Preview | PR-Branches | *.vercel.app | Supabase Staging |
| Local | - | localhost:3000 | Supabase Local / Docker |

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=

# ECU Parser Service (intern)
ECU_PARSER_URL=http://ecu-parser.internal:8000
ECU_PARSER_SECRET=

# Feature Flags
NEXT_PUBLIC_AI_ENABLED=true
NEXT_PUBLIC_3D_ENABLED=false  # Phase 2
```

---

## Monorepo-Struktur

```
maplab/
├── apps/
│   ├── web/                 # Next.js App
│   └── ecu-engine/          # Python FastAPI Service
├── packages/
│   ├── ecu-parser/          # Rust → WASM
│   ├── ecu-parser-wasm/     # Generiertes WASM-Package
│   ├── db/                  # Prisma Schema + Migrations
│   ├── ui/                  # Shared shadcn/ui Komponenten
│   └── types/               # Shared TypeScript Types
├── turbo.json
├── package.json
└── pnpm-workspace.yaml
```

---

## CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
jobs:
  typecheck:    # tsc --noEmit
  lint:         # ESLint + Ruff (Python)
  test:         # Vitest + Pytest
  wasm-build:   # wasm-pack build
  deploy:       # Vercel (automatisch via GitHub Integration)
  deploy-ecu:   # Railway Deploy bei main-Push
```

---

## Sicherheit

| Bereich | Maßnahme |
|---|---|
| Auth | Supabase RLS, JWT mit 15min Expiry |
| File Upload | Typ-Validierung (Magic Bytes, nicht nur Extension) |
| ECU Execution | Kein Code-Execution aus ECU-Dateien – nur Parsing |
| AI Prompts | System-Prompt nicht überschreibbar durch User |
| Rate Limiting | Upstash Redis, nach User-ID + IP |
| CORS | Strict Origin Policy |
| CSP | Content Security Policy Header via Next.js |

---

## Monitoring

| Tool | Zweck |
|---|---|
| Vercel Analytics | Core Web Vitals, Traffic |
| Sentry | Error Tracking (Frontend + Backend) |
| Supabase Dashboard | DB-Performance, Auth-Metriken |
| Upstash | Redis-Metriken, Rate-Limit-Hits |

---

## Kosten-Schätzung (MVP)

| Service | Plan | Kosten/Monat |
|---|---|---|
| Vercel | Pro | ~$20 |
| Supabase | Pro | ~$25 |
| Cloudflare R2 | Pay-as-you-go | ~$5–15 |
| Railway (ECU Engine) | Hobby | ~$5 |
| Anthropic API | Pay-as-you-go | ~$20–100 |
| **Gesamt** | | **~$75–165** |
