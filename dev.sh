#!/usr/bin/env bash
# MapLab development startup script
#
# Usage:
#   ./dev.sh              Hybrid mode (default) – ecu-engine in Docker, web runs natively
#   ./dev.sh --docker     Full Docker mode       – all services via docker compose

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${BLUE}▸${NC}  $*"; }
ok()   { echo -e "${GREEN}✓${NC}  $*"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
err()  { echo -e "${RED}✗${NC}  $*" >&2; exit 1; }
sep()  { echo -e "${BOLD}────────────────────────────────────────${NC}"; }

# ── Args ──────────────────────────────────────────────────────────────────────

DOCKER_MODE=false
for arg in "$@"; do
  [[ "$arg" == "--docker" ]] && DOCKER_MODE=true
done

# ── Banner ────────────────────────────────────────────────────────────────────

sep
echo -e "  ${BOLD}MapLab – Dev Environment${NC}"
if $DOCKER_MODE; then
  echo -e "  Mode: ${BLUE}Full Docker${NC} (all services in docker compose)"
else
  echo -e "  Mode: ${BLUE}Hybrid${NC} (ecu-engine via Docker, web native)"
fi
sep
echo ""

# ── Prerequisites ─────────────────────────────────────────────────────────────

need() {
  command -v "$1" &>/dev/null || err "Missing: ${BOLD}$1${NC}  →  $2"
}

need docker "Install Docker Desktop → https://docs.docker.com/desktop/"
ok "docker found"

if ! $DOCKER_MODE; then
  need node "Install Node.js ≥22 → https://nodejs.org"
  ok "node $(node --version) found"

  # Resolve pnpm: prefer local binary, fall back to corepack
  if ! command -v pnpm &>/dev/null; then
    if command -v corepack &>/dev/null; then
      log "Activating pnpm via corepack..."
      corepack enable pnpm 2>/dev/null || true
    fi
    command -v pnpm &>/dev/null || err "Missing: ${BOLD}pnpm${NC}  →  npm install -g pnpm"
  fi
  ok "pnpm $(pnpm --version) found"
fi

echo ""

# ── .env.local check ──────────────────────────────────────────────────────────

ENV_FILE="apps/web/.env.local"

if [ ! -f "$ENV_FILE" ]; then
  warn ".env.local not found"
  if [ -f ".env.example" ]; then
    cp .env.example "$ENV_FILE"
    echo ""
    warn "Created ${BOLD}$ENV_FILE${NC} from .env.example."
    warn "Fill in the required values (Supabase URL/keys, R2 credentials) and re-run."
    echo ""
  else
    err "No .env.example found either. Create apps/web/.env.local manually."
  fi
  exit 1
fi

ok "$ENV_FILE found"
echo ""

# ── Optional: WASM build ──────────────────────────────────────────────────────

if command -v cargo &>/dev/null; then
  if ! command -v wasm-pack &>/dev/null; then
    warn "cargo found but wasm-pack missing – skipping WASM build"
    warn "Install: cargo install wasm-pack"
    echo ""
  else
    WASM_OUT="packages/ecu-parser-wasm/wasm/ecu_parser.js"
    NEEDS_BUILD=false

    if [ ! -f "$WASM_OUT" ]; then
      NEEDS_BUILD=true
    elif find packages/ecu-parser/src -name "*.rs" -newer "$WASM_OUT" 2>/dev/null | grep -q .; then
      NEEDS_BUILD=true
    elif [ "packages/ecu-parser/Cargo.toml" -nt "$WASM_OUT" ] || [ "packages/ecu-parser/Cargo.lock" -nt "$WASM_OUT" ]; then
      NEEDS_BUILD=true
    fi

    if $NEEDS_BUILD; then
      log "Building ECU Parser WASM..."
      wasm-pack build packages/ecu-parser \
        --target web \
        --out-dir packages/ecu-parser-wasm/wasm \
        --quiet
      ok "WASM built → packages/ecu-parser-wasm/wasm/"
    else
      ok "WASM up-to-date"
    fi
    echo ""
  fi
else
  warn "Rust not found – skipping WASM build (using pre-built or JS fallback)"
  warn "Install: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
  echo ""
fi

# ── Start services ────────────────────────────────────────────────────────────

if $DOCKER_MODE; then
  # ── Full Docker mode ──────────────────────────────────────────────────────
  log "Starting all services via Docker Compose..."
  echo ""
  docker compose --profile full up --build
else
  # ── Hybrid mode ───────────────────────────────────────────────────────────

  log "Starting ecu-engine via Docker..."
  docker compose up -d --build ecu-engine
  echo ""

  # Wait for health
  log "Waiting for ecu-engine to be healthy..."
  ATTEMPTS=0
  until curl -sf http://localhost:8000/health > /dev/null 2>&1; do
    ATTEMPTS=$((ATTEMPTS + 1))
    [[ $ATTEMPTS -ge 30 ]] && err "ecu-engine failed to start after 30s. Check: docker compose logs ecu-engine"
    sleep 1
  done
  ok "ecu-engine is healthy → http://localhost:8000"
  echo ""

  # Install / sync JS dependencies
  log "Installing dependencies..."
  pnpm install --frozen-lockfile
  echo ""

  # Graceful shutdown: stop Docker services when the script exits
  cleanup() {
    echo ""
    log "Shutting down..."
    docker compose stop ecu-engine 2>/dev/null || true
    ok "ecu-engine stopped. Bye!"
  }
  trap cleanup EXIT INT TERM

  sep
  ok "ecu-engine  →  http://localhost:8000"
  ok "docs        →  http://localhost:8000/docs"
  echo ""
  log "Starting Next.js on http://localhost:3000  (Ctrl+C to stop all)"
  sep
  echo ""

  pnpm --filter @maplab/web dev
fi
