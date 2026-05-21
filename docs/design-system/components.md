# MapLab Component Patterns

This guide covers how to use and customize shadcn/ui components within the MapLab design system. Always install components via shadcn CLI — never copy-paste raw. Customize via CSS variables and Tailwind variants, not inline styles.

---

## shadcn Theme Override

The `components.json` preset for MapLab:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

---

## Button

```tsx
import { Button } from '@/components/ui/button'

// Primary — amber fill, for key actions (Commit, Save, Fork)
<Button>Commit Changes</Button>

// Secondary — subtle surface, for less prominent actions
<Button variant="secondary">View History</Button>

// Outline — amber border, for alternative CTAs (Fork, Subscribe)
<Button variant="outline">Fork Project</Button>

// Ghost — no background, for tertiary/icon actions
<Button variant="ghost">Cancel</Button>

// Destructive — for dangerous irreversible actions
<Button variant="destructive">Reset to Base</Button>

// AI variant — custom, for Copilot triggers
// Add to button variants in components/ui/button.tsx
<Button variant="ai">✦ Ask Copilot</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon"><IconUndo /></Button>
```

**Adding the AI variant** to `button.tsx`:
```ts
// In buttonVariants cva config:
ai: 'bg-gradient-to-r from-purple-500/15 to-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:from-purple-500/22 hover:to-cyan-500/16 hover:border-cyan-400/40 hover:shadow-cyan',
```

---

## Input

```tsx
import { Input } from '@/components/ui/input'

// Standard
<Input placeholder="Golf 7 GTI Stage 1" />

// Monospace (hex addresses, map values)
<Input className="font-mono text-[13px] tracking-wide" placeholder="0x0000A4" />

// With label
<div className="space-y-2">
  <Label htmlFor="project">Project Name</Label>
  <Input id="project" placeholder="Golf 7 GTI" />
</div>

// With prefix addon (not in shadcn — use custom wrapper)
<div className="flex">
  <span className="flex items-center px-3 bg-bg-overlay border border-r-0 border-border rounded-l text-muted-foreground font-mono text-xs">0x</span>
  <Input className="rounded-l-none font-mono" placeholder="00A4B2" />
</div>
```

---

## Card

```tsx
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'

// Project card — use the custom <ProjectCard> component (not raw shadcn Card)
// See: components/project/ProjectCard.tsx

// Standard content card
<Card>
  <CardHeader>
    <CardTitle>Version History</CardTitle>
  </CardHeader>
  <CardContent>
    {/* content */}
  </CardContent>
  <CardFooter className="justify-between">
    <span className="text-muted-foreground text-sm">14 versions</span>
    <Button variant="ghost" size="sm">View all</Button>
  </CardFooter>
</Card>

// Accent card (AI Copilot, featured content)
<Card className="bg-gradient-to-br from-purple-500/5 to-cyan-500/4 border-purple-500/18">
  ...
</Card>

// Left accent border (for warnings/active states)
<Card className="border-l-2 border-l-amber-500">
  ...
</Card>
```

---

## Badge

```tsx
import { Badge } from '@/components/ui/badge'

// Status badges — use variant prop mapped to color
<Badge>Stage 2</Badge>                              // default (amber)
<Badge variant="secondary">98 RON</Badge>           // neutral
<Badge variant="destructive">Warning</Badge>        // red

// Custom semantic badges (extend Badge variants):
<Badge className="bg-green-500/12 text-green-400 border-green-500/20">
  ✓ Safe
</Badge>
<Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
  AI Reviewed
</Badge>
<Badge className="bg-orange-500/12 text-orange-400 border-orange-500/20">
  Modified
</Badge>
```

**Dot indicator** helper:
```tsx
// components/ui/status-dot.tsx
export function StatusDot({ color }: { color: 'green' | 'amber' | 'red' }) {
  return <span className={`inline-block w-1.5 h-1.5 rounded-full bg-${color}-400`} />
}
```

---

## Alert / Toast

```tsx
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

// AI Safety Warning (most important alert type in MapLab)
<Alert className="border-red-500/25 bg-red-500/8 text-red-400">
  <AlertTitle>Safety Check Failed</AlertTitle>
  <AlertDescription className="text-muted-foreground">
    Lambda target 0.72λ at rows 6–8 is critically lean.
    This file cannot be published without correction.
  </AlertDescription>
</Alert>

// Copilot info
<Alert className="border-cyan-500/20 bg-cyan-500/7 text-cyan-400">
  <AlertTitle>AI Analysis Ready</AlertTitle>
  <AlertDescription className="text-muted-foreground">
    Copilot detected 3 maps matching known tuning patterns for this ECU.
  </AlertDescription>
</Alert>

// Use toast (sonner) for transient feedback
import { toast } from 'sonner'

toast.success('Version committed', { description: 'b4f2c9a pushed to main' })
toast.error('Checksum mismatch', { description: 'File may be corrupted' })
toast.warning('High boost detected', { description: 'Verify intercooler capacity' })
```

---

## Dialog / Modal

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

<Dialog>
  <DialogTrigger asChild>
    <Button>New Commit</Button>
  </DialogTrigger>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle className="font-display text-lg tracking-wide">Commit Changes</DialogTitle>
    </DialogHeader>
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Commit Message</Label>
        <Input placeholder="Reduce torque limiter at WOT" />
      </div>
      <div className="space-y-2">
        <Label>Changed Maps</Label>
        {/* Diff summary here */}
      </div>
    </div>
    <DialogFooter>
      <Button variant="ghost">Cancel</Button>
      <Button>Commit</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Tabs (Editor Views)

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

<Tabs defaultValue="map2d">
  <TabsList className="bg-bg-elevated border border-border rounded-t-md rounded-b-none w-full justify-start h-auto p-0 gap-0">
    <TabsTrigger value="map2d" className="data-[state=active]:text-amber-400 data-[state=active]:border-b-amber-400 rounded-none border-b-2 border-b-transparent px-4 py-3 text-sm">
      2D Map
    </TabsTrigger>
    <TabsTrigger value="3d" className="...">3D View</TabsTrigger>
    <TabsTrigger value="hex" className="...">HEX</TabsTrigger>
    <TabsTrigger value="diff" className="...">Diff</TabsTrigger>
  </TabsList>
  <TabsContent value="map2d">
    <MapGridView />
  </TabsContent>
</Tabs>
```

---

## Select / Combobox

```tsx
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

// ECU selector — use Command (combobox) for searchable long lists
<Select>
  <SelectTrigger>
    <SelectValue placeholder="Select ECU type" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="med17">Bosch MED17</SelectItem>
    <SelectItem value="me7">Bosch ME7</SelectItem>
    <SelectItem value="edc17">Bosch EDC17</SelectItem>
  </SelectContent>
</Select>
```

For large ECU databases, use shadcn `Command` (combobox) with search.

---

## Domain-Specific Components

These are custom components built on top of shadcn primitives. Each lives in `components/domain/`.

### `<MapGrid>` — 2D value table
- Props: `data: number[][]`, `axes: {x: number[], y: number[]}`, `selectedCell?: [number, number]`, `modifiedCells?: Set<string>`, `warningCells?: Set<string>`
- Uses CSS Grid + inline styles for heatmap coloring
- Selection managed by Zustand `editorStore`

### `<HexView>` — Binary hex display
- Built on Monaco Editor (configured for hex mode) or custom canvas
- Highlights: selected bytes (amber), modified bytes (cyan), cursor row
- Font: JetBrains Mono, 12px
- Shows: address column, hex bytes, ASCII column

### `<CommitHash>` — Version identifier
```tsx
<CommitHash hash="b4f2c9a" />
// Renders: cyan badge with monospace hash, click to copy
```

### `<SafeScore>` — Plausibility indicator
```tsx
<SafeScore score={87} />
// Renders: circular progress in green/amber/red, score/100
// < 60: red, 60–80: amber, > 80: green
```

### `<DiffLine>` — Single changed value row
```tsx
<DiffLine map="TrqLim_Driver" before={380} after={420} address="0x00A4" />
```

### `<AICopilotPanel>` — Sidebar chat interface
- Purple/cyan gradient border
- Message bubbles: system (cyan tint) + user (surface)
- Warning inline alerts for safety issues
- "✦" icon for AI messages

---

## Layout Patterns

### App Shell
```
AppShell
├── TopBar (52px) — logo, breadcrumb, user menu
├── Body (flex, 100vh - 52px)
│   ├── Sidebar (220px, collapsible)
│   └── Main (flex-1, overflow-auto)
└── (optional) RightPanel — AI Copilot (320px, slide-in)
```

### Editor Shell
```
EditorShell (h-screen flex flex-col)
├── EditorToolbar (48px) — view tabs, undo/redo, AI button, commit
├── EditorBody (flex-1 flex overflow-hidden)
│   ├── MapTree sidebar (200px)
│   └── EditorCanvas (flex-1) — active view
└── StatusBar (28px) — cursor position, ECU info, AI status
```

### Page max-widths
- Marketing pages: `max-w-6xl mx-auto`
- App pages: `max-w-7xl mx-auto` (or full-width for editor)
- Modals: `sm:max-w-md` (default), `sm:max-w-2xl` (wide)

---

## Motion

Use CSS transitions for micro-interactions, Framer Motion for page-level. Keep animations purposeful.

| Duration | Use                                      |
|----------|------------------------------------------|
| 100ms    | Hover states, opacity                    |
| 150ms    | Button/input state changes               |
| 200ms    | Card hover lift, badge appearance        |
| 300ms    | Sidebar collapse, modal enter            |
| 500ms    | Page transitions, skeleton to content    |

```css
/* Standard interactive transition */
transition: all 150ms ease;

/* Card hover */
transition: border-color 150ms, box-shadow 150ms, transform 150ms;
transform: translateY(-2px);     /* hover lift */

/* Focus ring */
transition: box-shadow 150ms;
box-shadow: 0 0 0 3px rgba(245,158,11,0.2);  /* amber focus */
```

---

## Accessibility

- **Focus visible**: always use `focus-visible:ring-2 focus-visible:ring-amber-500` — never remove focus outlines
- **Color alone**: never use color as the only status indicator — pair with icon or text
- **Contrast**: `text-primary` on `bg-base` passes WCAG AA (5.8:1)
- **Keyboard**: all interactive elements reachable via Tab, ESC closes modals/dropdowns
- **ARIA**: map cells use `role="gridcell"`, hex view uses `role="grid"`, commit list uses `role="list"`

---

## Don'ts

- Don't use `bg-white`, `text-black`, or light-mode colors anywhere — MapLab is dark-only
- Don't use `Inter`, `Roboto`, or `system-ui` as body font — use `Outfit`
- Don't use generic purple gradients on white — that's not this aesthetic
- Don't add decorative elements (stripes, chevrons, racing-themed graphics) — precision over spectacle
- Don't use `rounded-2xl` or larger for interactive elements — keeps the UI sharp and technical
- Don't show AI-generated map values without a safety disclaimer
