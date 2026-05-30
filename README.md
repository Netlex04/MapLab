# MapLab

MapLab is a version control and community platform built specifically for ECU tuning directly in your browser. It lets tuners upload, track, and compare binary tune files (BIN, XDF, A2L, DAMOS) across branches and commits — similar to Git, but purpose-built for ECU workflows.

Beyond version control, MapLab is a community hub: tuners can publish their projects publicly, explore and fork other people's tunes, leave comments, and collaborate on calibrations. An integrated map editor lets you view and edit ECU maps directly in the browser, with a 3D visualizer and an AI-powered explanation panel for individual map cells.

The platform is designed for professional tuners and enthusiasts alike — from a single-car hobbyist tracking changes to their own tune, to a shop managing calibrations across a fleet of vehicles.

## Architecture overview

```
maplab/
├── apps/
│   └── web/               # Next.js 15 app (App Router)
├── packages/
│   ├── db/                # Prisma client + schema (PostgreSQL via Supabase)
│   ├── ui/                # Shared component library (shadcn/ui)
│   ├── types/             # Shared TypeScript types
│   ├── ecu-parser/        # ECU parser core (Rust)
│   └── ecu-parser-wasm/   # WASM build output + JS bindings
└── services/
    └── ecu-engine/        # ECU parsing API (Python FastAPI)
```

**External services required:** Supabase (auth + database), Cloudflare R2 (file storage), Anthropic API (AI features, optional).

---

## Prerequisites

### Required for all setups

| Tool | Version | Install |
|------|---------|---------|
| Docker Desktop | latest | https://docs.docker.com/desktop/ |

### Required for hybrid dev mode (recommended)

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 22 | https://nodejs.org |
| pnpm | ≥ 11 | `npm install -g pnpm` or `corepack enable pnpm` |

### Optional — ECU Parser WASM (for local Rust builds)

| Tool | Install |
|------|---------|
| Rust + Cargo | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| wasm-pack | `cargo install wasm-pack` |

The app ships a pre-built WASM fallback, so Rust is **not** required to run MapLab locally.

---

## Environment setup

1. Copy the example env file:

   ```bash
   cp .env.example apps/web/.env.local
   ```

2. Fill in the required values in `apps/web/.env.local`:

   ```env
   # Supabase — create a project at https://supabase.com
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

   # Database — from your Supabase project settings → Database → Connection string
   DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
   DIRECT_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres

   # Cloudflare R2 — create a bucket at https://dash.cloudflare.com
   R2_ACCOUNT_ID=your-account-id
   R2_ACCESS_KEY_ID=your-access-key
   R2_SECRET_ACCESS_KEY=your-secret-key
   R2_BUCKET_NAME=maplab-files
   R2_PUBLIC_URL=https://files.maplab.app

   # ECU Parser (set automatically in Docker, leave as-is for hybrid mode)
   ECU_PARSER_URL=http://localhost:8000
   ECU_PARSER_SECRET=your-internal-secret

   # Anthropic (optional — AI features only)
   ANTHROPIC_API_KEY=sk-ant-...

   # Feature flags (optional)
   NEXT_PUBLIC_AI_ENABLED=false
   NEXT_PUBLIC_3D_ENABLED=false
   NEXT_PUBLIC_MARKETPLACE_ENABLED=false
   ```

3. Push the database schema:

   ```bash
   pnpm --filter @maplab/db db:push
   ```

---

## Running locally

### Option A — Hybrid mode (recommended)

The ecu-engine runs in Docker; the Next.js app runs natively for fast hot-reload.

```bash
./dev.sh
```

What it does:
- Starts `ecu-engine` via Docker Compose and waits for it to be healthy
- Installs JS dependencies (`pnpm install`) if needed
- Starts the Next.js dev server on **http://localhost:3000**
- Stops Docker services automatically on Ctrl+C

### Option B — Full Docker mode

All services run inside Docker Compose. Slower hot-reload but no local Node.js required.

```bash
./dev.sh --docker
```

Or directly via Docker Compose:

```bash
docker compose --profile full up --build
```

Services:

| Service | URL |
|---------|-----|
| Next.js web app | http://localhost:3000 |
| ECU Engine API | http://localhost:8000 |
| ECU Engine docs | http://localhost:8000/docs |

### Option C — Start services individually

```bash
# ECU engine only (detached)
docker compose up -d ecu-engine

# Next.js only (requires ecu-engine running)
pnpm install
pnpm --filter @maplab/web dev
```

---

## Database

```bash
# Apply schema changes (development)
pnpm --filter @maplab/db db:push

# Run migrations
pnpm --filter @maplab/db db:migrate

# Open Prisma Studio
pnpm --filter @maplab/db db:studio

# Seed with test data
pnpm --filter @maplab/db db:seed
```

---

## Building the ECU Parser WASM (optional)

Only needed if you modify the Rust parser in `packages/ecu-parser/`.

```bash
pnpm wasm:build
```

Output is written to `packages/ecu-parser-wasm/wasm/` and copied to `apps/web/public/wasm/`.

---

## Other useful commands

```bash
# Type-check the entire monorepo
pnpm typecheck

# Lint
pnpm lint

# Format all files
pnpm format

# Build all packages
pnpm build

# Clean all build artifacts and node_modules
pnpm clean
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React, Tailwind CSS, shadcn/ui |
| Backend | Next.js Server Actions, Server Components |
| Database | PostgreSQL (Supabase), Prisma ORM |
| Auth | Supabase Auth |
| File storage | Cloudflare R2 |
| ECU parsing | Python FastAPI + Rust/WASM |
| AI | Anthropic Claude API |
| Monorepo | pnpm workspaces + Turborepo |
