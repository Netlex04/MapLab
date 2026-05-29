'use client'

import { useMemo, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Box } from 'lucide-react'
import {
  useEditorStore,
  selectActiveMap,
  selectActiveMapValues,
} from '@/lib/editor/store'

// ─── Type label map ───────────────────────────────────────────────────────────

const MAP_TYPE_LABELS: Record<string, string> = {
  INJECTION:   'Injection',
  IGNITION:    'Ignition',
  BOOST:       'Boost',
  LAMBDA:      'Lambda',
  TORQUE:      'Torque',
  DRIVER_WISH: 'Driver Wish',
  FUEL_CUTOFF: 'Fuel Cutoff',
  UNKNOWN:     'Unknown',
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────

const HEAT_STOPS: THREE.Color[] = [
  new THREE.Color('#0c1019'), // 0.0 – near background
  new THREE.Color('#2d1a02'), // 0.2 – dark brown
  new THREE.Color('#78350f'), // 0.4 – deep amber
  new THREE.Color('#b45309'), // 0.6 – amber
  new THREE.Color('#f59e0b'), // 0.8 – bright amber
  new THREE.Color('#fde68a'), // 1.0 – near-white amber
]

function heatColor(t: number): THREE.Color {
  const n = Math.max(0, Math.min(1, t))
  const s = 1 / (HEAT_STOPS.length - 1)
  const i = Math.min(Math.floor(n / s), HEAT_STOPS.length - 2)
  return HEAT_STOPS[i]!.clone().lerp(HEAT_STOPS[i + 1]!, (n - i * s) / s)
}

// ─── Scene contents ───────────────────────────────────────────────────────────

interface SurfaceSceneProps {
  values: number[][]
  rows: number
  cols: number
}

function SurfaceScene({ values, rows, cols }: SurfaceSceneProps) {
  const flat = useMemo(() => values.flat(), [values])
  const min  = useMemo(() => Math.min(...flat), [flat])
  const max  = useMemo(() => Math.max(...flat), [flat])

  const H = Math.max(rows - 1, cols - 1, 1) * 0.4

  // ── Surface geometry ────────────────────────────────────────────────────────
  const surfaceGeo = useMemo(() => {
    const range = max - min || 1
    const n = rows * cols
    const positions = new Float32Array(n * 3)
    const colors    = new Float32Array(n * 3)

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c
        const v   = values[r]?.[c] ?? 0
        const t   = (v - min) / range

        positions[idx * 3]     = c - (cols - 1) / 2
        positions[idx * 3 + 1] = t * H
        positions[idx * 3 + 2] = r - (rows - 1) / 2

        const col = heatColor(t)
        colors[idx * 3]     = col.r
        colors[idx * 3 + 1] = col.g
        colors[idx * 3 + 2] = col.b
      }
    }

    const faceCount = (rows - 1) * (cols - 1) * 6
    const indices   = new Uint32Array(faceCount)
    let ii = 0
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const tl = r * cols + c
        const tr = r * cols + c + 1
        const bl = (r + 1) * cols + c
        const br = (r + 1) * cols + c + 1
        indices[ii++] = tl; indices[ii++] = bl; indices[ii++] = tr
        indices[ii++] = tr; indices[ii++] = bl; indices[ii++] = br
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3))
    geo.setIndex(new THREE.BufferAttribute(indices, 1))
    geo.computeVertexNormals()
    return geo
  }, [values, rows, cols, min, max, H])

  // ── Grid-line geometry (horizontal + vertical only, no diagonals) ───────────
  const gridGeo = useMemo(() => {
    const range = max - min || 1
    const lineCount = rows * (cols - 1) + (rows - 1) * cols
    const positions = new Float32Array(lineCount * 2 * 3)
    let pi = 0

    const vpos = (r: number, c: number): [number, number, number] => {
      const v = values[r]?.[c] ?? 0
      const t = (v - min) / range
      // +0.002 vertical offset to avoid z-fighting with the surface
      return [c - (cols - 1) / 2, t * H + 0.002, r - (rows - 1) / 2]
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const [x0, y0, z0] = vpos(r, c)
        const [x1, y1, z1] = vpos(r, c + 1)
        positions[pi++] = x0; positions[pi++] = y0; positions[pi++] = z0
        positions[pi++] = x1; positions[pi++] = y1; positions[pi++] = z1
      }
    }

    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols; c++) {
        const [x0, y0, z0] = vpos(r, c)
        const [x1, y1, z1] = vpos(r + 1, c)
        positions[pi++] = x0; positions[pi++] = y0; positions[pi++] = z0
        positions[pi++] = x1; positions[pi++] = y1; positions[pi++] = z1
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [values, rows, cols, min, max, H])

  // Dispose stale geometries when deps change or component unmounts
  useEffect(() => () => { surfaceGeo.dispose() }, [surfaceGeo])
  useEffect(() => () => { gridGeo.dispose() },    [gridGeo])

  const dist = Math.max(rows, cols, 4) * 1.4

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[dist, dist, dist]}           intensity={1.1} />
      <directionalLight position={[-dist * 0.4, dist * 0.6, -dist * 0.4]} intensity={0.25} color="#93c5fd" />

      {/* Surface */}
      <mesh geometry={surfaceGeo}>
        <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.65} metalness={0.15} />
      </mesh>

      {/* Grid lines */}
      <lineSegments geometry={gridGeo}>
        <lineBasicMaterial color="#37415a" transparent opacity={0.65} />
      </lineSegments>

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={2}
        maxDistance={dist * 5}
      />
    </>
  )
}

// ─── Empty states ─────────────────────────────────────────────────────────────

function NoMapState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
      <div className="size-12 rounded-lg bg-secondary flex items-center justify-center">
        <Box className="size-5 text-muted-foreground/40" />
      </div>
      <p className="text-sm text-muted-foreground">Keine Map ausgewählt</p>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Map3DView() {
  const activeMap      = useEditorStore(selectActiveMap)
  const effectiveValues = useEditorStore(selectActiveMapValues)

  if (!activeMap || !effectiveValues) return <NoMapState />

  const { rows, cols } = activeMap
  const canRender = rows >= 2 && cols >= 2

  // Camera starts above-front, facing the origin
  const ext     = Math.max(rows, cols, 4)
  const camPos: [number, number, number] = [ext * 0.6, ext * 0.7, ext * 1.5]

  return (
    <div className="flex flex-col h-full bg-background">

      {/* Header — same structure as Map2DView */}
      <div className="flex items-center gap-3 px-4 h-10 border-b border-border shrink-0 bg-card">
        <span className="text-sm font-medium text-foreground truncate">
          {activeMap.aiLabel ?? activeMap.name ?? `Map @ 0x${activeMap.offset.toString(16).toUpperCase()}`}
        </span>
        {activeMap.type && (
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-sm">
            {MAP_TYPE_LABELS[activeMap.type] ?? activeMap.type}
          </span>
        )}
        <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground/60">
          {rows}×{cols}
          {activeMap.valueUnit ? ` [${activeMap.valueUnit}]` : ''}
        </span>
      </div>

      {/* Canvas */}
      {canRender ? (
        <Canvas
          className="flex-1 block"
          camera={{ position: camPos, fov: 50 }}
          gl={{ antialias: true }}
          onCreated={({ gl }) => gl.setClearColor(new THREE.Color('#0B0D11'))}
        >
          <SurfaceScene values={effectiveValues} rows={rows} cols={cols} />
        </Canvas>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-muted-foreground">
            3D-Ansicht benötigt mindestens 2×2 Werte
          </p>
        </div>
      )}

      {/* Controls hint */}
      <div className="flex items-center px-4 h-7 border-t border-border bg-card shrink-0 font-mono text-[10px] text-muted-foreground/40">
        Drehen: linke Maus · Zoom: Scrollrad · Verschieben: rechte Maus
      </div>
    </div>
  )
}
