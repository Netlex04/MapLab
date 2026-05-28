'use client'

import { useState } from 'react'
import { AlertTriangle, Info, ChevronDown, ChevronUp, ShieldAlert, X } from 'lucide-react'
import { useEditorStore } from '@/lib/editor/store'
import type { SafetyFlag, SafetySeverity } from '@maplab/types'

// ─── Severity helpers ─────────────────────────────────────────────────────────

function severityOrder(s: SafetySeverity): number {
  return s === 'critical' ? 0 : s === 'warning' ? 1 : 2
}

function SeverityIcon({ severity, className }: { severity: SafetySeverity; className?: string }) {
  if (severity === 'critical') return <ShieldAlert className={className} />
  if (severity === 'warning')  return <AlertTriangle className={className} />
  return <Info className={className} />
}

function severityColor(severity: SafetySeverity): string {
  if (severity === 'critical') return 'text-destructive'
  if (severity === 'warning')  return 'text-amber-400'
  return 'text-sky-400'
}

function borderColor(severity: SafetySeverity): string {
  if (severity === 'critical') return 'border-destructive/40'
  if (severity === 'warning')  return 'border-amber-400/30'
  return 'border-sky-400/20'
}

// ─── Summary badge ────────────────────────────────────────────────────────────

function SummaryBadge({ warnings }: { warnings: SafetyFlag[] }) {
  const critical = warnings.filter((w) => w.severity === 'critical').length
  const warning  = warnings.filter((w) => w.severity === 'warning').length
  const info     = warnings.filter((w) => w.severity === 'info').length

  return (
    <span className="flex items-center gap-2 text-[10px] font-mono">
      {critical > 0 && (
        <span className="flex items-center gap-1 text-destructive">
          <ShieldAlert className="size-3" />
          {critical}
        </span>
      )}
      {warning > 0 && (
        <span className="flex items-center gap-1 text-amber-400">
          <AlertTriangle className="size-3" />
          {warning}
        </span>
      )}
      {info > 0 && (
        <span className="flex items-center gap-1 text-sky-400">
          <Info className="size-3" />
          {info}
        </span>
      )}
    </span>
  )
}

// ─── Single warning row ───────────────────────────────────────────────────────

function WarningRow({ flag }: { flag: SafetyFlag }) {
  return (
    <li className={`flex items-start gap-2.5 py-1.5 px-3 border-l-2 ${borderColor(flag.severity)}`}>
      <SeverityIcon
        severity={flag.severity}
        className={`size-3 mt-0.5 shrink-0 ${severityColor(flag.severity)}`}
      />
      <span className="text-[11px] text-muted-foreground leading-relaxed">
        {flag.message}
      </span>
    </li>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SafetyWarningsPanel() {
  const [expanded, setExpanded] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const warnings = useEditorStore((s) => s.parsedECU?.warnings ?? [])

  if (warnings.length === 0 || dismissed) return null

  const sorted = [...warnings].sort(
    (a, b) => severityOrder(a.severity) - severityOrder(b.severity),
  )

  const hasCritical = warnings.some((w) => w.severity === 'critical')

  return (
    <div
      className={`shrink-0 border-b border-border bg-card ${hasCritical ? 'border-l-2 border-l-destructive/60' : ''}`}
    >
      {/* Header row */}
      <div className="flex items-center h-7 px-3 gap-2">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <SummaryBadge warnings={warnings} />
          <span className="text-[10px] text-muted-foreground/70 ml-1">
            {warnings.length === 1 ? '1 Hinweis' : `${warnings.length} Hinweise`}
          </span>
          <span className="text-[10px] text-muted-foreground/40 ml-auto">
            Kein Sicherheitscheck – immer vor dem Flashen prüfen
          </span>
          {expanded
            ? <ChevronUp className="size-3 text-muted-foreground/50 ml-2 shrink-0" />
            : <ChevronDown className="size-3 text-muted-foreground/50 ml-2 shrink-0" />
          }
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="ml-1 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
          aria-label="Hinweise ausblenden"
        >
          <X className="size-3" />
        </button>
      </div>

      {/* Expanded list */}
      {expanded && (
        <ul className="pb-1.5 space-y-0.5">
          {sorted.map((flag, i) => (
            <WarningRow key={`${flag.ruleId}-${i}`} flag={flag} />
          ))}
        </ul>
      )}
    </div>
  )
}
