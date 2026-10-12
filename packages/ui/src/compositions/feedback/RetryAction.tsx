import { useEffect, useRef, useState } from 'react'
import { Button } from '@ui/components/primitives/button'
import { Spinner } from '@ui/components/primitives/spinner'
import { provenance } from '@ui/provenance'

export const RetryActionProvenance = provenance({
  source: 'composition',
  composes: ['ui/button', 'ui/spinner'],
  note: 'Retry button that cannot be double-fired, shows progress, and honours a rate-limit cooldown.',
})

export interface RetryActionProps {
  onRetry: () => void
  /** The retry is in flight. The button holds its width and shows a spinner. */
  isRetrying?: boolean
  /** Disabled for this long, with a countdown, e.g. from a `Retry-After` header. */
  retryAfterMs?: number | undefined
  label?: string
  size?: 'sm' | 'default'
  variant?: 'outline' | 'default' | 'ghost'
}

/**
 * "Try again" that is safe to mash. A ref blocks a second click in the same
 * tick (before React has re-rendered the disabled state), and a rate-limit
 * cooldown counts down instead of inviting presses that will be refused.
 */
export function RetryAction({
  onRetry,
  isRetrying = false,
  retryAfterMs,
  label = 'Try again',
  size = 'sm',
  variant = 'outline',
}: RetryActionProps) {
  const fired = useRef(false)
  const [remaining, setRemaining] = useState(retryAfterMs ? Math.ceil(retryAfterMs / 1000) : 0)

  useEffect(() => {
    if (!isRetrying) fired.current = false
  }, [isRetrying])

  useEffect(() => {
    setRemaining(retryAfterMs ? Math.ceil(retryAfterMs / 1000) : 0)
  }, [retryAfterMs])

  useEffect(() => {
    if (remaining <= 0) return
    const timer = setTimeout(() => setRemaining((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [remaining])

  const cooling = remaining > 0
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={isRetrying || cooling}
      aria-busy={isRetrying || undefined}
      onClick={() => {
        if (fired.current) return
        fired.current = true
        // Callers that do not report `isRetrying` still get the button back.
        setTimeout(() => {
          fired.current = false
        }, 800)
        onRetry()
      }}
    >
      {isRetrying ? <Spinner aria-hidden className="size-3.5 motion-reduce:animate-none" /> : null}
      {isRetrying ? 'Retrying…' : cooling ? `Try again in ${remaining}s` : label}
    </Button>
  )
}
