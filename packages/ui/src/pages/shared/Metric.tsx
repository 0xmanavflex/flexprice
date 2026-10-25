import type { ReactNode } from 'react'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * A single number worth looking at, with what it means.
 *
 * The delta is deliberately not colour-only: "up 12%" is good for revenue and
 * bad for failed payments, so direction and sentiment are separate inputs. V1's
 * metric cards infer sentiment from the sign, which is wrong half the time.
 *
 * The change is also given a text label for screen readers, because an arrow
 * glyph and a colour convey nothing to them.
 */
export const MetricProvenance = provenance({
  source: 'custom',
  reason:
    'Stat display with direction and sentiment as separate inputs. ReUI has no metric primitive, and the separation is the behaviour worth owning.',
})

export type Sentiment = 'positive' | 'negative' | 'neutral'

export interface MetricProps {
  label: string
  /** Already formatted: a Money element, a count, a percentage. */
  value: ReactNode
  hint?: string
  change?: {
    /** e.g. "12%" or "3 more". Rendered verbatim. */
    label: string
    direction: 'up' | 'down'
    /** What the direction *means* here. Not inferred from the sign. */
    sentiment: Sentiment
  }
  isLoading?: boolean
}

/**
 * Coloured text, drawn the way the reference draws a trend: `text-xs
 * font-medium`, no fill. The `-foreground` token carries it in light mode and
 * the base token in dark, the pairing the light badge variants use, because bare
 * `text-success` fails contrast as small foreground text.
 */
const SENTIMENT_TEXT: Record<Sentiment, string> = {
  positive: 'text-success-foreground dark:text-success',
  negative: 'text-destructive-foreground dark:text-destructive',
  neutral: 'text-muted-foreground',
}

export function Metric({ label, value, hint, change, isLoading = false }: MetricProps) {
  return (
    <div className="bg-background flex min-w-0 flex-col gap-1 rounded-xl border p-4">
      <span className="text-muted-foreground truncate text-xs" title={label}>
        {label}
      </span>

      {isLoading ? (
        <div aria-hidden className="bg-muted h-7 w-24 rounded motion-safe:animate-pulse" />
      ) : (
        <span
          className="min-w-0 truncate text-2xl font-medium tabular-nums"
          {...(typeof value === 'string' || typeof value === 'number'
            ? { title: String(value) }
            : {})}
        >
          {value}
        </span>
      )}
      {isLoading ? (
        <span role="status" className="sr-only">
          Loading {label}
        </span>
      ) : null}

      {change && !isLoading ? (
        <span
          className={cn('w-fit text-xs font-medium tabular-nums', SENTIMENT_TEXT[change.sentiment])}
        >
          <span aria-hidden>{change.direction === 'up' ? '↑' : '↓'} </span>
          {change.label}
          <span className="sr-only"> {change.direction === 'up' ? 'increase' : 'decrease'}</span>
        </span>
      ) : null}

      {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
    </div>
  )
}
