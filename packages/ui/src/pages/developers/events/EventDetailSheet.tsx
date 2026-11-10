import type { ReactNode } from 'react'
import type { EventDebug, ProcessedUsage, RawEvent } from '@fp/domain'
import { ArrowUpRightIcon, CircleCheckIcon, ClockIcon } from '@ui/icons'
import {
  CodeBlock,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from '@ui/components/reui/code-block/code-block'
import { DetailList } from '@ui/compositions/tables/DetailList'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@ui/components/primitives/sheet'
import { provenance } from '@ui/provenance'
import { EventTrace } from './EventTrace'

/**
 * One event, and what billing did with it.
 *
 * The payload renders verbatim in the ReUI `CodeBlock`: a debugger's whole
 * point is seeing what the sender actually sent. Above it sits the part that
 * makes this a debugger rather than a viewer: the five stages the event went
 * through and the one that stopped it, from `GET /events/lookup`.
 *
 * `debug` is optional. The sheet is useful without it (the payload is right
 * there) and the trace is a second, heavier request, so a caller that has not
 * wired it still gets a working sheet.
 */
export const EventDetailSheetProvenance = provenance({
  source: 'composition',
  composes: ['primitives/sheet', 'compositions/DetailList', 'reui/code-block'],
  note: 'Read-only event detail: identifying fields plus the verbatim properties payload.',
})

export interface EventDetailSheetProps {
  /** The event to show. `null` closes the sheet. */
  event: RawEvent | null
  onClose: () => void
  locale?: string
  /** The trace, when the page reads one. */
  debug?: EventDebug | undefined
  debugPending?: boolean
  debugError?: string | null
  onRetryDebug?: (() => void) | undefined
  /** Opens a contract the event was matched to. */
  onOpenSubscription?: ((subscriptionId: string) => void) | undefined
  /** Opens the feature an event was counted for. */
  onOpenFeature?: ((featureId: string) => void) | undefined
  /** Opens the Flexprice customer the event was matched to. */
  onOpenCustomer?: ((customerId: string) => void) | undefined
  /** Customer id → name, for the processed usage cards. Unknown ids show as ids. */
  customerNames?: Readonly<Record<string, string>> | undefined
  /** Feature id → name, for the processed usage cards. */
  featureNames?: Readonly<Record<string, string>> | undefined
}

export function EventDetailSheet({
  event,
  onClose,
  locale,
  debug,
  debugPending = false,
  debugError = null,
  onRetryDebug,
  onOpenSubscription,
  onOpenFeature,
  onOpenCustomer,
  customerNames = {},
  featureNames = {},
}: EventDetailSheetProps) {
  const payload = event ? JSON.stringify(event.properties, null, 2) : ''
  const versions = debug?.versions ?? []
  const processed = debug?.processedUsage ?? []
  /*
   * Once an event has been billed the lookup answers with `processed_events`,
   * and the stage tracker is no longer filled in: every stage would read "Not
   * reached" under a summary saying it went through all of them. V1 shows only
   * the processed usage in that case, and so does this.
   */
  const showTrace =
    processed.length === 0 && (debug !== undefined || debugPending || debugError !== null)
  /** The event row often carries no internal customer id; billing knows it. */
  const flexpriceCustomer =
    event?.customerId || processed[0]?.customerId || debug?.customer?.id || ''
  const stamp = (value: Date | null) =>
    value
      ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium' }).format(value)
      : '—'

  return (
    <Sheet open={event !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        {event ? (
          <>
            <SheetHeader>
              <SheetTitle>{event.eventName || 'Event'}</SheetTitle>
              <SheetDescription>
                {event.timestamp
                  ? new Intl.DateTimeFormat(locale, {
                      dateStyle: 'long',
                      timeStyle: 'medium',
                    }).format(event.timestamp)
                  : 'No timestamp on this event'}
              </SheetDescription>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
              <DetailList
                items={[
                  {
                    label: 'Event ID',
                    value: <span className="font-mono text-xs">{event.id || '—'}</span>,
                  },
                  { label: 'Source', value: event.source || '—' },
                  {
                    label: 'Customer ID',
                    value: (
                      <span className="font-mono text-xs">{event.externalCustomerId || '—'}</span>
                    ),
                  },
                  {
                    label: 'Flexprice customer',
                    value: openLink(
                      <span className="font-mono text-xs">
                        {flexpriceCustomer
                          ? (customerNames[flexpriceCustomer] ??
                            (debug?.customer?.id === flexpriceCustomer && debug.customer.name
                              ? debug.customer.name
                              : flexpriceCustomer))
                          : 'Not matched'}
                      </span>,
                      flexpriceCustomer,
                      onOpenCustomer,
                      'customer',
                    ),
                  },
                ]}
              />
              {debug?.idempotencyKey ? (
                <section className="flex flex-col gap-1">
                  <h3 className="text-sm font-medium">Idempotency key</h3>
                  <p className="text-muted-foreground font-mono text-xs break-all">
                    {debug.idempotencyKey}
                  </p>
                </section>
              ) : null}

              {showTrace ? (
                <EventTrace
                  debug={debug}
                  properties={event.properties}
                  {...(locale ? { locale } : {})}
                  isPending={debugPending}
                  error={debugError}
                  {...(onRetryDebug ? { onRetry: onRetryDebug } : {})}
                  {...(onOpenSubscription ? { onOpenSubscription } : {})}
                />
              ) : null}

              {processed.length > 0 ? (
                <section className="flex flex-col gap-3">
                  <div className="flex flex-col gap-0.5">
                    <h3 className="text-sm font-medium">Processed usage</h3>
                    <p className="text-muted-foreground text-xs">
                      {processed.length === 1
                        ? 'Billed against one contract line item.'
                        : `Billed against ${processed.length} contract line items.`}
                    </p>
                  </div>
                  {processed.map((usage, index) => (
                    <ProcessedUsageCard
                      key={`${usage.lineItemId}-${index}`}
                      usage={usage}
                      index={index + 1}
                      processedAt={stamp(usage.processedAt)}
                      customerName={
                        customerNames[usage.customerId] ??
                        (debug?.customer?.id === usage.customerId ? debug.customer.name : '')
                      }
                      featureName={featureNames[usage.featureId] ?? ''}
                      {...(onOpenSubscription ? { onOpenSubscription } : {})}
                      {...(onOpenFeature ? { onOpenFeature } : {})}
                      {...(onOpenCustomer ? { onOpenCustomer } : {})}
                    />
                  ))}
                </section>
              ) : null}

              <CodeBlock code={payload} language="json" showLineNumbers label="Event properties">
                <CodeBlockHeader>
                  <CodeBlockTitle>Properties</CodeBlockTitle>
                  <CodeBlockCopyButton className="ml-auto" />
                </CodeBlockHeader>
              </CodeBlock>

              {/*
                Every row stored under this id, newest first. More than one
                means the same event was sent again: a replay, or a retry that
                lost its idempotency key: which is usually the explanation for
                a doubled quantity, so the heading says so.
              */}
              {versions.length > 0 ? (
                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">
                    {versions.length > 1
                      ? `Ingested ${versions.length} times`
                      : 'Ingested versions'}
                  </h3>
                  <ul className="divide-border/60 flex flex-col divide-y rounded-lg border text-[13px]">
                    {versions.map((version, index) => (
                      <li
                        key={`${version.id}-${index}`}
                        className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-3"
                      >
                        <span className="flex flex-col">
                          <span className="font-medium">Version {versions.length - index}</span>
                          <span className="text-muted-foreground text-xs">
                            {version.source || 'No source'}
                          </span>
                        </span>
                        <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-xs">
                          <dt className="text-muted-foreground">Ingested at</dt>
                          <dd className="tabular-nums">{stamp(version.ingestedAt)}</dd>
                          <dt className="text-muted-foreground">Timestamp</dt>
                          <dd className="tabular-nums">{stamp(version.timestamp)}</dd>
                        </dl>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

/** A value that opens its record, with the arrow that says so; plain when nothing can open it. */
function openLink(
  content: ReactNode,
  value: string,
  open: ((value: string) => void) | undefined,
  label: string,
): ReactNode {
  return value && open ? (
    <button
      type="button"
      onClick={() => open(value)}
      aria-label={`Open ${label} ${value}`}
      className="hover:text-primary flex max-w-full min-w-0 items-center gap-1 text-left underline-offset-2 hover:underline"
    >
      <span className="min-w-0">{content}</span>
      <ArrowUpRightIcon aria-hidden className="text-muted-foreground size-3.5 shrink-0" />
    </button>
  ) : (
    content
  )
}

/**
 * One line item the event was billed against: V1's "Processed usage #n" card.
 *
 * One label/value row per field, so a 30-character id sits on one line
 * instead of wrapping mid-id in half a column. A known name leads, with its id
 * underneath; the contract and the feature link to their pages.
 */
function ProcessedUsageCard({
  usage,
  index,
  processedAt,
  customerName,
  featureName,
  onOpenSubscription,
  onOpenFeature,
  onOpenCustomer,
}: {
  usage: ProcessedUsage
  index: number
  processedAt: string
  customerName: string
  featureName: string
  onOpenSubscription?: ((subscriptionId: string) => void) | undefined
  onOpenFeature?: ((featureId: string) => void) | undefined
  onOpenCustomer?: ((customerId: string) => void) | undefined
}) {
  const id = (value: string) => (
    <span className="block truncate font-mono text-xs" title={value || undefined}>
      {value || '—'}
    </span>
  )
  const named = (name: string, value: string) =>
    name ? (
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{name}</span>
        <span className="text-muted-foreground block truncate font-mono text-xs" title={value}>
          {value}
        </span>
      </span>
    ) : (
      id(value)
    )
  const rows: { label: string; value: ReactNode }[] = [
    {
      label: 'Customer',
      value: openLink(
        named(customerName, usage.customerId),
        usage.customerId,
        onOpenCustomer,
        'customer',
      ),
    },
    {
      label: 'Contract',
      value: openLink(
        id(usage.subscriptionId),
        usage.subscriptionId,
        onOpenSubscription,
        'contract',
      ),
    },
    {
      label: 'Feature',
      value: openLink(
        named(featureName, usage.featureId),
        usage.featureId,
        onOpenFeature,
        'feature',
      ),
    },
    { label: 'Line item', value: id(usage.lineItemId) },
    { label: 'Meter', value: id(usage.meterId) },
    { label: 'Price', value: id(usage.priceId) },
    {
      label: 'Quantity',
      value: <span className="font-medium tabular-nums">{usage.quantity}</span>,
    },
  ]

  return (
    <article
      aria-label={`Processed usage ${index}`}
      className="flex flex-col rounded-lg border text-[13px]"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <span className="flex items-center gap-2 font-medium">
          <CircleCheckIcon aria-hidden className="text-success size-4" />
          Processed usage #{index}
        </span>
        <span className="text-muted-foreground flex items-center gap-1 text-xs tabular-nums">
          <ClockIcon aria-hidden className="size-3.5" />
          {processedAt}
        </span>
      </header>
      <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 px-4 py-3">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-muted-foreground text-xs">{row.label}</dt>
            <dd className="min-w-0">{row.value}</dd>
          </div>
        ))}
      </dl>
    </article>
  )
}
