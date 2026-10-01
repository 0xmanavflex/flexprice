import type { ReactNode } from 'react'
import { Badge } from '@ui/components/reui/badge'
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
  /** Already formatted — a Money element, a count, a percentage. */
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
 * Rendered as a tinted badge rather than coloured text.
 *
 * `text-success` is a background-tuned green and fails WCAG AA as a foreground
 * on the card — caught by the accessibility check, not by eye. There is no
 * text-on-card success token, and adding one would breach the no-new-tokens
 * rule, so this reuses the `-light` badge variants that were already validated
 * for the status badges.
 */
const SENTIMENT_VARIANT: Record<Sentiment, 'success-light' | 'destructive-light' | 'secondary'> = {
  positive: 'success-light',
  negative: 'destructive-light',
  neutral: 'secondary',
}

export function Metric({ label, value, hint, change, isLoading = false }: MetricProps) {
  return (
    <div className="bg-card flex flex-col gap-1 rounded-xl border p-4">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>

      {isLoading ? (
        <div aria-hidden className="bg-muted h-7 w-24 animate-pulse rounded" />
      ) : (
        <span className="text-2xl font-medium tabular-nums">{value}</span>
      )}
      {isLoading ? <span className="sr-only">Loading {label}</span> : null}

      {change && !isLoading ? (
        <Badge variant={SENTIMENT_VARIANT[change.sentiment]} size="sm" className="w-fit">
          <span aria-hidden>{change.direction === 'up' ? '↑' : '↓'} </span>
          {change.label}
          <span className="sr-only"> {change.direction === 'up' ? 'increase' : 'decrease'}</span>
        </Badge>
      ) : null}

      {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
    </div>
  )
}
