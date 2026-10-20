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
 * The payload renders verbatim in the ReUI `CodeBlock` — a debugger's whole
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
}: EventDetailSheetProps) {
  const payload = event ? JSON.stringify(event.properties, null, 2) : ''
  const showTrace = debug !== undefined || debugPending || debugError !== null
  const versions = debug?.versions ?? []
  const processed = debug?.processedUsage ?? []
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
                    value: (
                      <span className="font-mono text-xs">{event.customerId || 'Not matched'}</span>
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
                  {...(locale ? { locale } : {})}
                  isPending={debugPending}
                  error={debugError}
                  {...(onRetryDebug ? { onRetry: onRetryDebug } : {})}
                  {...(onOpenSubscription ? { onOpenSubscription } : {})}
                />
              ) : null}

              {processed.length > 0 ? (
                <section className="flex flex-col gap-3">
                  <h3 className="text-sm font-medium">Processed usage</h3>
                  {processed.map((usage, index) => (
                    <ProcessedUsageCard
                      key={`${usage.lineItemId}-${index}`}
                      usage={usage}
                      index={index + 1}
                      processedAt={stamp(usage.processedAt)}
                      customerName={
                        debug?.customer && debug.customer.id === usage.customerId
                          ? debug.customer.name
                          : ''
                      }
                      {...(onOpenSubscription ? { onOpenSubscription } : {})}
                      {...(onOpenFeature ? { onOpenFeature } : {})}
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
                means the same event was sent again — a replay, or a retry that
                lost its idempotency key — which is usually the explanation for
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

/**
 * One line item the event was billed against: V1's "Processed usage #n" card.
 * Every id is copyable text, and the two with a page in the console link to it.
 */
function ProcessedUsageCard({
  usage,
  index,
  processedAt,
  customerName,
  onOpenSubscription,
  onOpenFeature,
}: {
  usage: ProcessedUsage
  index: number
  processedAt: string
  customerName: string
  onOpenSubscription?: ((subscriptionId: string) => void) | undefined
  onOpenFeature?: ((featureId: string) => void) | undefined
}) {
  const id = (value: string) => <span className="font-mono text-xs break-all">{value || '—'}</span>
  const link = (value: string, open: ((value: string) => void) | undefined, label: string) =>
    value && open ? (
      <button
        type="button"
        onClick={() => open(value)}
        aria-label={`Open ${label} ${value}`}
        className="hover:text-primary inline-flex max-w-full items-center gap-1 text-left underline-offset-2 hover:underline"
      >
        {id(value)}
        <ArrowUpRightIcon aria-hidden className="text-muted-foreground size-3.5 shrink-0" />
      </button>
    ) : (
      id(value)
    )

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
      <div className="px-4 py-3">
        <DetailList
          items={[
            {
              label: 'Customer',
              value: customerName ? (
                <span className="flex flex-col">
                  <span>{customerName}</span>
                  {id(usage.customerId)}
                </span>
              ) : (
                id(usage.customerId)
              ),
            },
            {
              label: 'Contract',
              value: link(usage.subscriptionId, onOpenSubscription, 'contract'),
            },
            { label: 'Feature', value: link(usage.featureId, onOpenFeature, 'feature') },
            { label: 'Line item', value: id(usage.lineItemId) },
            { label: 'Meter', value: id(usage.meterId) },
            { label: 'Price', value: id(usage.priceId) },
            {
              label: 'Quantity',
              value: <span className="font-medium tabular-nums">{usage.quantity}</span>,
            },
          ]}
        />
      </div>
    </article>
  )
}
