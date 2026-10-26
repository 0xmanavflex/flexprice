import type { ReactNode } from 'react'
import {
  WEBHOOK_DELIVERY_STATUS_LABEL,
  type WebhookDeliveryStatus,
  type WebhookStatusFilter,
} from '@fp/domain'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/components/primitives/tooltip'
import { EmDash, type EntityColumn, Pill, type PillTone } from '../../shared/cells'

/**
 * The webhook pages' shared cells: the delivery-status pill and a timestamp
 * that shows the time (deliveries are minutes apart, a date alone says
 * nothing) with the full instant, seconds and zone, on hover.
 */

const STATUS_TONE: Record<WebhookDeliveryStatus, PillTone> = {
  succeeded: 'success',
  failed: 'danger',
  pending: 'warning',
  sending: 'warning',
}

export function WebhookStatusPill({ status }: { status: WebhookDeliveryStatus }) {
  return <Pill tone={STATUS_TONE[status]}>{WEBHOOK_DELIVERY_STATUS_LABEL[status]}</Pill>
}

/** The attempt-table filter: Svix's portal offers All, Succeeded and Failed; Pending is added. */
export const WEBHOOK_STATUS_CHOICES: readonly { value: WebhookStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Pending' },
]

export function formatWebhookTime(value: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(value)
}

function formatFull(value: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'full',
    timeStyle: 'long',
  }).format(value)
}

/** A timestamp with its full form in a tooltip. */
export function WebhookTime({
  value,
  locale,
}: {
  value: Date | null
  locale?: string | undefined
}) {
  if (!value) return <EmDash />
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className="text-muted-foreground block truncate tabular-nums" />}
      >
        {formatWebhookTime(value, locale)}
      </TooltipTrigger>
      <TooltipContent>{formatFull(value, locale)}</TooltipContent>
    </Tooltip>
  )
}

export function timestampColumn<T>(
  id: string,
  header: string,
  get: (row: T) => Date | null,
  locale?: string,
): EntityColumn<T> {
  return {
    id,
    header,
    cell: (row) => <WebhookTime value={get(row)} locale={locale} />,
    text: (row) => {
      const value = get(row)
      return value ? value.toISOString() : ''
    },
    width: 190,
    skeleton: <Skeleton className="h-4 w-32" />,
  }
}

export function statusColumn<T>(get: (row: T) => WebhookDeliveryStatus): EntityColumn<T> {
  return {
    id: 'status',
    header: 'Status',
    cell: (row) => <WebhookStatusPill status={get(row)} />,
    text: (row) => WEBHOOK_DELIVERY_STATUS_LABEL[get(row)],
    width: 130,
    hideable: false,
    skeleton: <Skeleton className="h-5 w-20 rounded-full" />,
  }
}

/** The event-type name, monospaced as Svix renders it. */
export function EventTypeName({ name }: { name: string }): ReactNode {
  if (!name) return <EmDash />
  return (
    <span title={name} className="block truncate font-mono text-xs">
      {name}
    </span>
  )
}
