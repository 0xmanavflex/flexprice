import type { EventDebug, RawEvent } from '@fp/domain'
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
}: EventDetailSheetProps) {
  const payload = event ? JSON.stringify(event.properties, null, 2) : ''
  const showTrace = debug !== undefined || debugPending || debugError !== null
  const versions = debug?.versions ?? []

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
                  isPending={debugPending}
                  error={debugError}
                  {...(onRetryDebug ? { onRetry: onRetryDebug } : {})}
                  {...(onOpenSubscription ? { onOpenSubscription } : {})}
                />
              ) : null}

              <CodeBlock code={payload} language="json" showLineNumbers>
                <CodeBlockHeader>
                  <CodeBlockTitle>Properties</CodeBlockTitle>
                  <CodeBlockCopyButton className="ml-auto" />
                </CodeBlockHeader>
              </CodeBlock>

              {/*
                Every row stored under this id.
                More than one means the same event was sent again — a replay,
                or a retry that lost its idempotency key. Seeing two here is
                usually the explanation for a doubled quantity.
              */}
              {versions.length > 1 ? (
                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">Ingested {versions.length} times</h3>
                  <ul className="divide-border/60 flex flex-col divide-y rounded-lg border text-[13px]">
                    {versions.map((version, index) => (
                      <li
                        key={`${version.id}-${index}`}
                        className="flex items-baseline justify-between gap-3 px-4 py-2"
                      >
                        <span className="text-muted-foreground">
                          {version.source || 'No source'}
                        </span>
                        <span className="tabular-nums">
                          {version.ingestedAt
                            ? new Intl.DateTimeFormat(locale, {
                                dateStyle: 'medium',
                                timeStyle: 'medium',
                              }).format(version.ingestedAt)
                            : '—'}
                        </span>
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
