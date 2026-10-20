import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@ui/components/primitives/sheet'
import { Section } from '@ui/compositions/layout/Section'
import { SubTabState, truncationNote, type SubTabQuery } from '@ui/compositions/detail/SubTabState'
import { DetailTable } from '../shared/DetailTable'

/** One ingested event for a customer, as the events grid shows it. */
export interface CustomerEvent {
  id: string
  name: string
  properties: Record<string, string>
  source: string
  /** Already formatted for display; empty when the event carries no timestamp. */
  receivedAt: string
}

const summarize = (properties: Record<string, string>) =>
  Object.entries(properties)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ')

/** The most recent events the customer page asks for. */
export const CUSTOMER_EVENTS_LIMIT = 50

export interface CustomerEventsGridProps extends Partial<SubTabQuery> {
  events: CustomerEvent[]
  /** Events the customer has in all, when the read reports it; shown beside the cap. */
  total?: number | undefined
  /**
   * Opens one event in the page's own detail view (the Events debugger sheet,
   * with its trace and processed usage). Omitted, the grid shows a minimal
   * sheet of the event's properties itself.
   */
  onOpenEvent?: ((eventId: string) => void) | undefined
}

export function CustomerEventsGrid({
  events,
  total,
  isLoading = false,
  error,
  errorKind,
  retryAfterMs,
  onRetry,
  isRetrying,
  onOpenEvent,
}: CustomerEventsGridProps) {
  const [selected, setSelected] = useState<CustomerEvent | null>(null)
  const capped =
    total !== undefined && total > events.length
      ? `Showing the latest ${events.length} of ${total} events.`
      : truncationNote(events.length, CUSTOMER_EVENTS_LIMIT)

  return (
    <>
      <Section table title="Recent events">
        <SubTabState
          hasData={events.length > 0}
          isLoading={isLoading}
          error={error}
          errorKind={errorKind}
          retryAfterMs={retryAfterMs}
          onRetry={onRetry}
          isRetrying={isRetrying}
          columns={4}
          loadingLabel="Loading events"
          truncation={capped}
          empty={{
            scene: 'customers',
            title: 'No events yet',
            description: 'Events ingested for this customer appear here as they arrive.',
          }}
        >
          <DetailTable
            label="Recent events"
            noun="events"
            rows={events}
            getRowId={(event) => event.id}
            onRowClick={(event) => (onOpenEvent ? onOpenEvent(event.id) : setSelected(event))}
            columns={[
              {
                key: 'name',
                header: 'Event',
                cell: (e) => <span className="font-mono text-[13px]">{e.name}</span>,
              },
              {
                key: 'properties',
                header: 'Properties',
                cell: (e) => (
                  <span className="text-muted-foreground block max-w-md truncate font-mono text-xs">
                    {summarize(e.properties)}
                  </span>
                ),
              },
              {
                key: 'source',
                header: 'Source',
                cell: (e) => <span className="text-muted-foreground">{e.source || '—'}</span>,
              },
              {
                key: 'at',
                header: 'Received',
                cell: (e) => <span className="text-muted-foreground">{e.receivedAt || '—'}</span>,
              },
            ]}
            empty="No events yet. Events ingested for this customer appear here as they arrive."
          />
        </SubTabState>
      </Section>

      <Sheet
        open={selected !== null}
        onOpenChange={(open) => (open ? undefined : setSelected(null))}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="font-mono text-sm">{selected?.name}</SheetTitle>
            <SheetDescription>
              Received {selected?.receivedAt || 'at an unknown time'} via{' '}
              {selected?.source || 'an unknown source'}
            </SheetDescription>
          </SheetHeader>
          <dl className="flex flex-col gap-3 px-4 text-sm">
            {Object.entries(selected?.properties ?? {}).map(([key, value]) => (
              <div key={key} className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground text-xs">{key}</dt>
                <dd className="font-mono text-xs">{value}</dd>
              </div>
            ))}
          </dl>
        </SheetContent>
      </Sheet>
    </>
  )
}
