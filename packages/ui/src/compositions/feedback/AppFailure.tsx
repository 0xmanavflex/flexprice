import type { ReactNode } from 'react'
import { Button } from '@ui/components/primitives/button'
import { provenance } from '@ui/provenance'

/**
 * The screen of last resort.
 *
 * It exists because of a specific failure: a configuration error thrown at
 * module load happened inside a lazily-loaded route chunk, Suspense caught the
 * rejected import, and the application rendered an empty body with no message
 * anywhere. A broken build looked exactly like an empty list.
 *
 * A blank screen is the one outcome never worth shipping. Whatever went wrong,
 * something has to say so: and say what to do about it.
 */
export const AppFailureProvenance = provenance({
  source: 'composition',
  composes: ['ui/button'],
  note: 'Full-page failure. Prevents a crash rendering as an empty screen.',
})

export interface AppFailureProps {
  title: string
  detail?: string
  /** What the reader can actually do. Shown as a distinct block, not prose. */
  fix?: string
  onRetry?: () => void
  /** The underlying error, for development. Never the primary message. */
  technical?: string
  children?: ReactNode
}

export function AppFailure({ title, detail, fix, onRetry, technical, children }: AppFailureProps) {
  return (
    <div role="alert" className="flex min-h-[60vh] w-full items-center justify-center p-6">
      <div className="flex w-full max-w-lg flex-col gap-4 rounded-xl border p-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-base font-medium">{title}</h1>
          {detail ? <p className="text-muted-foreground text-sm">{detail}</p> : null}
        </div>

        {fix ? (
          <p className="bg-muted/40 rounded-lg border px-3 py-2 font-mono text-xs">{fix}</p>
        ) : null}

        {technical ? (
          <details className="text-muted-foreground text-xs">
            <summary className="cursor-pointer">Technical detail</summary>
            <pre className="bg-muted/40 mt-2 overflow-auto rounded p-2">{technical}</pre>
          </details>
        ) : null}

        <div className="flex gap-2">
          {onRetry ? (
            <Button size="sm" onClick={onRetry}>
              Try again
            </Button>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  )
}
