# MapLab Design Tokens

All tokens are defined as CSS custom properties in `globals.css` and mapped to Tailwind via `tailwind.config.ts`.

---

## Tailwind Config

```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss'

export default {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background:   'hsl(var(--background))',
        foreground:   'hsl(var(--foreground))',
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border:  'hsl(var(--border))',
        input:   'hsl(var(--input))',
        ring:    'hsl(var(--ring))',
        // Domain-specific
        amber:   'hsl(var(--color-amber))',
        cyan:    'hsl(var(--color-cyan))',
        'map-heat-1': 'rgba(245,158,11,0.08)',
        'map-heat-2': 'rgba(245,158,11,0.16)',
        'map-heat-3': 'rgba(245,158,11,0.26)',
        'map-heat-4': 'rgba(245,158,11,0.38)',
        'map-heat-5': 'rgba(245,158,11,0.55)',
      },
      fontFamily: {
        display: ['Rajdhani', 'sans-serif'],
        body:    ['Outfit', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
        sans:    ['Outfit', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['56px', { lineHeight: '1', letterSpacing: '0.03em', fontWeight: '700' }],
        'display-lg': ['36px', { lineHeight: '1.05', letterSpacing: '0.04em', fontWeight: '700' }],
        'heading':    ['22px', { lineHeight: '1.2', letterSpacing: '0.04em', fontWeight: '600' }],
        'label':      ['11px', { lineHeight: '1', letterSpacing: '0.1em', fontWeight: '700' }],
      },
      borderRadius: {
        sm:  '3px',
        DEFAULT: '5px',
        md:  '8px',
        lg:  '12px',
        xl:  '16px',
      },
      boxShadow: {
        sm:    '0 1px 3px rgba(0,0,0,0.4)',
        md:    '0 4px 12px rgba(0,0,0,0.5)',
        lg:    '0 8px 32px rgba(0,0,0,0.6)',
        amber: '0 0 20px rgba(245,158,11,0.15)',
        cyan:  '0 0 20px rgba(34,211,238,0.12)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config
```

---

## globals.css — shadcn CSS Variables

```css
@layer base {
  :root {
    /* MapLab is dark-only. These are the only values needed. */
    --background:    220 26% 7%;        /* #0B0D11 */
    --foreground:    220 15% 93%;       /* #EAEDF4 */

    --card:          228 23% 9%;        /* #131620 */
    --card-foreground: 220 15% 93%;

    --popover:       228 23% 9%;
    --popover-foreground: 220 15% 93%;

    --primary:       38 92% 50%;        /* #F59E0B — amber */
    --primary-foreground: 220 26% 7%;

    --secondary:     226 20% 13%;       /* #1C1F29 */
    --secondary-foreground: 220 10% 68%;

    --muted:         226 22% 14%;
    --muted-foreground: 222 12% 55%;    /* #8C93AC */

    --accent:        226 22% 17%;
    --accent-foreground: 220 15% 93%;

    --destructive:   0 84% 60%;         /* #EF4444 */
    --destructive-foreground: 0 0% 100%;

    --border:        222 23% 18%;       /* #252A38 */
    --input:         222 23% 18%;
    --ring:          38 92% 50%;        /* amber focus ring */

    --radius: 0.3125rem;                /* 5px */

    /* Extended domain tokens */
    --color-amber:   38 92% 50%;
    --color-cyan:    189 94% 53%;
    --color-green:   160 84% 39%;
    --color-red:     0 84% 60%;
    --color-orange:  25 95% 53%;
    --color-purple:  271 81% 56%;
  }
}

@layer base {
  * { @apply border-border; }
  body {
    @apply bg-background text-foreground;
    font-family: theme('fontFamily.body');
    -webkit-font-smoothing: antialiased;
  }
}
```

---

## Color Reference

| Token              | Hex       | HSL                  | Usage                                    |
|--------------------|-----------|----------------------|------------------------------------------|
| `bg-base`          | `#0B0D11` | `220 26% 7%`         | Page background                          |
| `bg-elevated`      | `#131620` | `228 23% 9%`         | Cards, panels, sidebar                   |
| `bg-surface`       | `#1C1F29` | `226 20% 13%`        | Input backgrounds, secondary surfaces    |
| `bg-overlay`       | `#232736` | `228 22% 17%`        | Hover, dropdown, tooltip                 |
| `border`           | `#252A38` | `222 23% 18%`        | All borders                              |
| `text-primary`     | `#EAEDF4` | `220 15% 93%`        | Default text                             |
| `text-secondary`   | `#8C93AC` | `222 12% 62%`        | Labels, descriptions                     |
| `text-muted`       | `#555B70` | `224 12% 38%`        | Placeholders, hints, timestamps          |
| `amber`            | `#F59E0B` | `38 92% 50%`         | Primary accent, CTAs, active, focus      |
| `cyan`             | `#22D3EE` | `189 94% 53%`        | AI Copilot, commit hashes, info, links   |
| `green`            | `#10B981` | `160 84% 39%`        | Success, safe score, diff additions      |
| `red`              | `#EF4444` | `0 84% 60%`          | Danger, warnings, out-of-range values    |
| `orange`           | `#F97316` | `25 95% 53%`         | Soft warnings, modified state            |
| `purple`           | `#A855F7` | `271 81% 56%`        | AI special, premium features             |

---

## Typography

| Role          | Font           | Weight | Size  | Letter Spacing | Use                                   |
|---------------|----------------|--------|-------|----------------|---------------------------------------|
| display-xl    | Rajdhani       | 700    | 56px  | 0.03em         | Hero, marketing                       |
| display-lg    | Rajdhani       | 700    | 36px  | 0.04em         | Page titles, project names            |
| heading       | Rajdhani       | 600    | 22px  | 0.04em         | Section headings, card titles         |
| subheading    | Outfit         | 600    | 16px  | —              | Panel titles, modal headings          |
| body          | Outfit         | 400    | 15px  | —              | Default prose, descriptions           |
| body-sm       | Outfit         | 400    | 13px  | —              | Secondary text, metadata              |
| label         | Outfit         | 700    | 11px  | 0.10em         | Uppercase field labels, section heads |
| mono          | JetBrains Mono | 400    | 13px  | 0.03em         | Hex values, addresses, code           |
| mono-sm       | JetBrains Mono | 400    | 11px  | 0.04em         | Commit hashes, map IDs, badges        |

**Google Fonts import:**
```html
<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
```

Or via `next/font/google` (preferred in Next.js):
```ts
import { Rajdhani, Outfit, JetBrains_Mono } from 'next/font/google'

export const fontDisplay = Rajdhani({ subsets: ['latin'], weight: ['400','500','600','700'], variable: '--font-display' })
export const fontBody    = Outfit({ subsets: ['latin'], variable: '--font-body' })
export const fontMono    = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })
```

---

## Spacing

Base unit: **4px**. All spacing is multiples of 4.

| Token     | px  | Tailwind |
|-----------|-----|----------|
| space-1   | 4   | `p-1`    |
| space-2   | 8   | `p-2`    |
| space-3   | 12  | `p-3`    |
| space-4   | 16  | `p-4`    |
| space-5   | 20  | `p-5`    |
| space-6   | 24  | `p-6`    |
| space-8   | 32  | `p-8`    |
| space-10  | 40  | `p-10`   |
| space-12  | 48  | `p-12`   |
| space-16  | 64  | `p-16`   |

---

## Border Radius

| Token      | px  | Tailwind      | Usage                                      |
|------------|-----|---------------|--------------------------------------------|
| radius-sm  | 3   | `rounded-sm`  | Badges, chips, code inline                 |
| radius     | 5   | `rounded`     | Buttons, inputs, small interactive         |
| radius-md  | 8   | `rounded-md`  | Dropdowns, tooltips, toolbars              |
| radius-lg  | 12  | `rounded-lg`  | Cards, panels, modals                      |
| radius-xl  | 16  | `rounded-xl`  | Feature cards, hero sections               |
| full       | —   | `rounded-full`| Avatars, dot indicators                    |

---

## Shadows

| Token        | Value                                  | Usage                            |
|--------------|----------------------------------------|----------------------------------|
| shadow-sm    | `0 1px 3px rgba(0,0,0,0.4)`            | Inline elevated elements         |
| shadow-md    | `0 4px 12px rgba(0,0,0,0.5)`           | Cards on hover                   |
| shadow-lg    | `0 8px 32px rgba(0,0,0,0.6)`           | Modals, popovers                 |
| shadow-amber | `0 0 20px rgba(245,158,11,0.15)`       | Active/focused amber elements    |
| shadow-cyan  | `0 0 20px rgba(34,211,238,0.12)`       | AI panel glow                    |

---

## Heatmap Scale (Map Editor)

Used to visualize value intensity in 2D map cells.

| Level   | Background                         | Text           | Meaning              |
|---------|------------------------------------|----------------|----------------------|
| heat-1  | `rgba(245,158,11,0.08)`            | default        | Low                  |
| heat-2  | `rgba(245,158,11,0.16)`            | default        | Medium-low           |
| heat-3  | `rgba(245,158,11,0.26)`            | default        | Medium               |
| heat-4  | `rgba(245,158,11,0.38)`            | amber          | Medium-high          |
| heat-5  | `rgba(245,158,11,0.55)`            | `#0B0D11`      | High (inverted text) |
