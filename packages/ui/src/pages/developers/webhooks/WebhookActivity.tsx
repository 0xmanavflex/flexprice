import { useState } from 'react'
import type { WebhookActivityPoint } from '@fp/domain'
import { ChartSkeleton } from '@ui/compositions/feedback/Skeletons'
import { ErrorState, type ErrorKind } from '@ui/compositions/feedback/States'
import { provenance } from '@ui/provenance'
import { MetricChart, formatWhole } from '../../shared/charts'

/**
 * Delivery activity over the last six hours, across every endpoint: V1's
 * Activity tab, on the shared metric chart: one tab per outcome, the hourly
 * series under it.
 */
export const WebhookActivityProvenance = provenance({
  source: 'composition',
  composes: [
    'pages/shared/charts',
    'compositions/feedback/States',
    'compositions/feedback/Skeletons',
  ],
  note: 'Successful and failed delivery attempts per hour on the shared MetricChart.',
})

export interface WebhookActivityProps {
  points: WebhookActivityPoint[]
  isLoading?: boolean
  error?: string | null
  errorKind?: ErrorKind | undefined
  onRetry?: (() => void) | undefined
  isRetrying?: boolean | undefined
  /** True when only the first N endpoints were counted. */
  truncated?: boolean
  locale?: string
}

export function WebhookActivity({
  points,
  isLoading = false,
  error = null,
  errorKind,
  onRetry,
  isRetrying,
  truncated = false,
  locale,
}: WebhookActivityProps) {
  const [tab, setTab] = useState('succeeded')

  if (error) {
    return (
      <ErrorState
        title="Activity could not be loaded"
        description={error}
        {...(errorKind ? { kind: errorKind } : {})}
        {...(onRetry ? { onRetry } : {})}
        {...(isRetrying !== undefined ? { isRetrying } : {})}
      />
    )
  }
  if (isLoading) return <ChartSkeleton height={320} label="Loading delivery activity" />

  const hour = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' })
  const series = (pick: (point: WebhookActivityPoint) => number) =>
    points.map((point) => ({ label: hour.format(point.start), value: pick(point) }))
  const total = (pick: (point: WebhookActivityPoint) => number) =>
    points.reduce((sum, point) => sum + pick(point), 0)

  return (
    <MetricChart
      activeTab={tab}
      onTabChange={setTab}
      caption={`Delivery attempts per hour, last 6 hours${truncated ? ', first 25 endpoints' : ''}`}
      tabs={[
        {
          id: 'succeeded',
          label: 'Successful attempts',
          value: formatWhole(total((point) => point.succeeded)),
          points: total((point) => point.succeeded) > 0 ? series((point) => point.succeeded) : [],
        },
        {
          id: 'failed',
          label: 'Failed attempts',
          value: formatWhole(total((point) => point.failed)),
          points: total((point) => point.failed) > 0 ? series((point) => point.failed) : [],
        },
      ]}
    />
  )
}
