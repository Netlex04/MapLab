import { useCallback, useEffect, useRef } from 'react'
import type { FileFormat } from '@maplab/types'
import type { WorkerInbound, WorkerOutbound } from '@/workers/ecu-parser.worker'
import { useEditorStore } from './store'

// ─── Format Detection ─────────────────────────────────────────────────────────

function detectFormat(file: File): FileFormat {
  const ext = file.name.split('.').pop()?.toUpperCase()
  const formatMap: Record<string, FileFormat> = {
    BIN: 'BIN',
    HEX: 'HEX',
    FRF: 'FRF',
    OLS: 'OLS',
    XDF: 'XDF',
    A2L: 'A2L',
    DAMOS: 'DAMOS',
  }
  return formatMap[ext ?? ''] ?? 'BIN'
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useECUParser() {
  const workerRef = useRef<Worker | null>(null)
  const { setStatus, setParsedECU } = useEditorStore()

  // Worker lazy-initialisieren – erst wenn er wirklich gebraucht wird
  function getWorker(): Worker {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('@/workers/ecu-parser.worker.ts', import.meta.url),
        { type: 'module' },
      )
    }
    return workerRef.current
  }

  // Worker aufräumen wenn die Komponente unmountet
  useEffect(() => {
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  const parseFile = useCallback(
    async (file: File): Promise<void> => {
      setStatus('parsing')

      const format = detectFormat(file)
      const arrayBuffer = await file.arrayBuffer()

      // Kopie des Buffers für den Store – der Worker bekommt das Original (Transferable)
      const bufferForStore = new Uint8Array(arrayBuffer.slice(0))

      const worker = getWorker()

      return new Promise<void>((resolve, reject) => {
        const onMessage = (event: MessageEvent<WorkerOutbound>) => {
          const msg = event.data
          if (msg.type !== 'parse:success' && msg.type !== 'parse:error') return

          worker.removeEventListener('message', onMessage)
          worker.removeEventListener('error', onError)

          if (msg.type === 'parse:success') {
            setParsedECU(msg.result, bufferForStore)
            resolve()
          } else {
            setStatus('error', msg.message)
            reject(new Error(msg.message))
          }
        }

        const onError = (event: ErrorEvent) => {
          worker.removeEventListener('message', onMessage)
          worker.removeEventListener('error', onError)
          const message = event.message ?? 'Worker-Fehler'
          setStatus('error', message)
          reject(new Error(message))
        }

        worker.addEventListener('message', onMessage)
        worker.addEventListener('error', onError)

        const msg: WorkerInbound = { type: 'parse', buffer: arrayBuffer, format }
        // ArrayBuffer als Transferable übergeben – zero-copy, kein Kopieren der 1MB+
        worker.postMessage(msg, [arrayBuffer])
      })
    },
    [setStatus, setParsedECU],
  )

  const requestHexSlice = useCallback(
    (buffer: Uint8Array, offset: number, length: number): Promise<{ bytes: number[]; ascii: string[] }> => {
      const worker = getWorker()
      const transferBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer

      return new Promise((resolve, reject) => {
        const onMessage = (event: MessageEvent<WorkerOutbound>) => {
          const msg = event.data
          if (msg.type !== 'hex-slice:success' && msg.type !== 'hex-slice:error') return

          worker.removeEventListener('message', onMessage)

          if (msg.type === 'hex-slice:success') {
            resolve({ bytes: msg.bytes, ascii: msg.ascii })
          } else {
            reject(new Error(msg.message))
          }
        }

        worker.addEventListener('message', onMessage)

        const outMsg: WorkerInbound = { type: 'hex-slice', buffer: transferBuffer, offset, length }
        worker.postMessage(outMsg)
      })
    },
    [],
  )

  return { parseFile, requestHexSlice }
}
