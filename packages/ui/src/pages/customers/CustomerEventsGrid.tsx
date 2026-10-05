import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@ui/components/primitives/sheet'
import { Section } from '@ui/compositions/Section'
import { SimpleTable } from '@ui/compositions/DetailKit'

/** Demo usage events: no customer event feed is wired yet. */
export interface CustomerEvent {
  id: string
  name: string
  properties: Record<string, string>
  source: string
  receivedAt: string
}

export const DEMO_CUSTOMER_EVENTS: CustomerEvent[] = [
  {
    id: 'evt_6',
    name: 'api_call',
    properties: { endpoint: '/v1/chat', tokens: '1204' },
    source: 'sdk',
    receivedAt: 'Today, 09:14',
  },
  {
    id: 'evt_5',
    name: 'api_call',
    properties: { endpoint: '/v1/embed', tokens: '88' },
    source: 'sdk',
    receivedAt: 'Today, 08:52',
  },
  {
    id: 'evt_4',
    name: 'storage_write',
    properties: { gb: '12' },
    source: 'api',
    receivedAt: 'Yesterday',
  },
  {
    id: 'evt_3',
    name: 'seat_added',
    properties: { seat: 'dana@acme.com' },
    source: 'api',
    receivedAt: 'Sep 28',
  },
  {
    id: 'evt_2',
    name: 'api_call',
    properties: { endpoint: '/v1/chat', tokens: '640' },
    source: 'sdk',
    receivedAt: 'Sep 20',
  },
  {
    id: 'evt_1',
    name: 'storage_write',
    properties: { gb: '4' },
    source: 'api',
    receivedAt: 'Sep 1',
  },
]

const summarize = (properties: Record<string, string>) =>
  Object.entries(properties)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ')

export function CustomerEventsGrid({ events }: { events: CustomerEvent[] }) {
  const [selected, setSelected] = useState<CustomerEvent | null>(null)

  return (
    <>
      <Section title="Recent events" description="Latest usage events for this customer" flush>
        <SimpleTable
          rows={events}
          getRowId={(event) => event.id}
          onRowClick={setSelected}
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
              cell: (e) => <span className="text-muted-foreground">{e.source}</span>,
            },
            {
              key: 'at',
              header: 'Received',
              cell: (e) => <span className="text-muted-foreground">{e.receivedAt}</span>,
            },
          ]}
          empty="No events yet. Events ingested for this customer appear here as they arrive."
        />
      </Section>

      <Sheet
        open={selected !== null}
        onOpenChange={(open) => (open ? undefined : setSelected(null))}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="font-mono text-sm">{selected?.name}</SheetTitle>
            <SheetDescription>
              Received {selected?.receivedAt} via {selected?.source}
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
