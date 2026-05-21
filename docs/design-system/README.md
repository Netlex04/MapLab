# MapLab Design System

**Aesthetic Direction: Diagnostic Precision**

Dark, technical, and authoritative — like the cockpit of a performance car crossed with a professional engineering workstation. Not a consumer SaaS. A craftsman's tool.

---

## Files

| File | Contents |
|------|----------|
| [index.html](./index.html) | **Visual reference** — open in browser to see all components rendered |
| [tokens.md](./tokens.md) | CSS variables, Tailwind config, full color/type/spacing reference |
| [components.md](./components.md) | shadcn customizations, domain-specific components, layout patterns |

---

## Core Aesthetic Decisions

**Background**: Near-black with a subtle cool tint (`#0B0D11`) — not pure black. Gives depth without harsh contrast.

**Primary Accent — Amber (`#F59E0B`)**: Like an illuminated instrument gauge needle. Used for: primary actions, active states, focus rings, selected map cells.

**Secondary Accent — Cyan (`#22D3EE`)**: Like a diagnostic readout display. Reserved for: AI Copilot, commit hashes, modified values, info states. Keeps AI interactions visually distinct.

**Typography**:
- Headings → `Rajdhani` (technical, automotive HUD feel — purposeful, not decorative)
- Body → `Outfit` (clean and readable, not generic)
- Code/Data → `JetBrains Mono` (appropriate for a tool built around hex and maps)

**Borders**: Very subtle (`#252A38`). Present for structure, invisible as decoration.

---

## Quick Setup

1. Copy CSS variables from `tokens.md` into `app/globals.css`
2. Apply the Tailwind config from `tokens.md` to `tailwind.config.ts`
3. Add font imports to `app/layout.tsx` via `next/font/google`
4. See `components.md` for shadcn customization patterns

---

## Design Principles

1. **Information density over whitespace** — tuners want data visible, not hidden behind clicks
2. **Color carries meaning** — amber = active, cyan = AI/version, red = danger, green = safe
3. **Monospace for data** — hex values, addresses, map IDs, commit hashes always in JetBrains Mono
4. **Precision over decoration** — sharp edges, minimal radius, no shadows for their own sake
5. **Dark only** — no light mode; this is a tool used for focused work, not casual browsing
