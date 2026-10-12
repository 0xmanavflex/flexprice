import { useEffect, useRef, useState } from 'react'
import { LoadingGate, type LoadingGateOptions, type LoadingPhase } from './loadingGate'

/**
 * React wrapper around `LoadingGate`: returns the phase a loading flag is in
 * (idle, reserved, visible, slow). Starts `reserved` when mounted loading, so
 * the first paint holds the skeleton's space instead of flashing content.
 */
export function useLoadingPhase(isLoading: boolean, options?: LoadingGateOptions): LoadingPhase {
  const [phase, setPhase] = useState<LoadingPhase>(isLoading ? 'reserved' : 'idle')
  const gate = useRef<LoadingGate | null>(null)
  const { delayMs, minMs, slowMs } = options ?? {}

  useEffect(() => {
    const next = new LoadingGate(setPhase, {
      ...(delayMs !== undefined ? { delayMs } : {}),
      ...(minMs !== undefined ? { minMs } : {}),
      ...(slowMs !== undefined ? { slowMs } : {}),
    })
    gate.current = next
    return () => {
      next.dispose()
      gate.current = null
    }
  }, [delayMs, minMs, slowMs])

  useEffect(() => {
    gate.current?.set(isLoading)
  }, [isLoading, delayMs, minMs, slowMs])

  return phase
}
