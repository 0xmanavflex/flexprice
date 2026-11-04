import { type ComponentProps, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { DEFAULT_RAW_EVENT_QUERY, type RawEvent } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { UploadIcon } from '@ui/icons'
import { EventGrid } from './EventGrid'

const events: RawEvent[] = [
  {
    id: 'evt_01',
    eventName: 'api_call',
    externalCustomerId: 'acme-corp',
    customerId: 'cust_01',
    source: 'sdk',
    timestamp: new Date('2026-09-01T10:15:30Z'),
    properties: { endpoint: '/v1/search', tokens: 412 },
  },
  {
    // Never matched to a Flexprice customer, and no source: both render as dashes.
    id: 'evt_02',
    eventName: 'storage_gb',
    externalCustomerId: 'globex',
    customerId: '',
    source: '',
    timestamp: new Date('2026-09-01T09:00:00Z'),
    properties: {},
  },
]

function manyEvents(count: number): RawEvent[] {
  const names = ['api_call', 'storage_gb', 'tokens_used', 'seat_added']
  return Array.from({ length: count }, (_, index) => ({
    id: `evt_gen_${index}`,
    eventName: names[index % names.length] as string,
    externalCustomerId: index % 5 === 4 ? 'globex' : 'acme-corp',
    customerId: index % 5 === 4 ? '' : 'cust_01',
    source: index % 3 === 2 ? '' : 'sdk',
    timestamp: new Date(Date.UTC(2026, 8, 1, 10, 0, 0) - index * 60_000),
    properties: { index, tokens: 100 + index },
  }))
}

const meta = {
  title: 'App/Developers/Events/Event table',
  component: EventGrid,
  parameters: { layout: 'padded' },
  args: {
    events,
    total: 2,
    query: { ...DEFAULT_RAW_EVENT_QUERY },
    onQueryChange: fn(),
    locale: 'en-US',
  },
  argTypes: {
    events: { control: false },
    total: { control: false },
    query: { control: false },
    isLoading: { control: 'boolean' },
    error: { control: false },
    locale: { control: 'select', options: ['en-US', 'en-GB', 'de-DE'] },
    onQueryChange: { control: false },
    onRetry: { control: false },
    onEventClick: { control: false },
    onClearFilters: { control: false },
  },
} satisfies Meta<typeof EventGrid>

export default meta
type Story = StoryObj<typeof meta>

type PlaygroundArgs = ComponentProps<typeof EventGrid> & {
  rows: number
  hasError: boolean
  page: number
  pageSize: number
}

function EventGridPlayground({ rows, hasError, page, pageSize, ...args }: PlaygroundArgs) {
  const [query, setQuery] = useState(() => ({ ...DEFAULT_RAW_EVENT_QUERY, page, pageSize }))
  const start = (query.page - 1) * query.pageSize
  return (
    <EventGrid
      {...args}
      events={manyEvents(rows).slice(start, start + query.pageSize)}
      total={rows}
      query={query}
      onQueryChange={(next) => {
        setQuery(next)
        args.onQueryChange(next)
      }}
      error={hasError ? 'Could not reach Flexprice.' : null}
    />
  )
}

/** Drag `rows` from 0 to 60 to see first-run, a short list and paging; toggle loading and error. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: { rows: 30, hasError: false, page: 1, pageSize: 10, isLoading: false },
  argTypes: {
    rows: { control: { type: 'range', min: 0, max: 60, step: 1 } },
    hasError: { control: 'boolean' },
    page: { control: { type: 'number', min: 1, max: 6, step: 1 } },
    pageSize: { control: 'select', options: [10, 25, 50] },
  },
  render: (args) => <EventGridPlayground key={`${args.page}-${args.pageSize}`} {...args} />,
}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('api_call')).toBeInTheDocument()
    await expect(canvas.getByText('acme-corp')).toBeInTheDocument()
    const headers = Array.from(canvasElement.querySelectorAll('thead th')).map((th) =>
      (th.textContent ?? '').trim().toLowerCase(),
    )
    await expect(headers).toContain('event id')
  },
}

export const Loading: Story = { args: { events: [], total: 0, isLoading: true } }

/**
 * Nothing in the window. Every read covers a window of time, so the list says
 * what it looked at and keeps its toolbar to widen it, rather than claiming
 * no event was ever received.
 */
export const Empty: Story = {
  args: { events: [], total: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('No events in the last 30 days')).toBeInTheDocument()
    await expect(canvas.queryByText('No events received yet')).not.toBeInTheDocument()
    await expect(canvas.getByRole('search', { name: 'Search and filter events' })).toBeVisible()
    // The window is a filter like any other: open the bar and it is there to widen.
    await userEvent.click(canvas.getByRole('button', { name: 'Filter' }))
    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByText('Received')).toBeVisible()
    await expect(body.getByText('Last 30 days')).toBeVisible()
  },
}

export const FilteredEmpty: Story = {
  args: {
    events: [],
    total: 0,
    query: { ...DEFAULT_RAW_EVENT_QUERY, customer: 'nobody' },
    onClearFilters: fn(),
  },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText('No events match these filters'),
    ).toBeInTheDocument()
  },
}

export const Failed: Story = {
  args: { events: [], total: 0, error: 'Could not reach Flexprice.', onRetry: fn() },
}

/** Events land a moment after they are sent, so the table can be reloaded in place. */
export const Reload: Story = {
  args: { onReload: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Reload' }))
    await expect(args.onReload).toHaveBeenCalledOnce()
  },
}

/** The page's Import CSV sits beside Reload, so a backfill starts where events are read. */
export const WithImport: Story = {
  args: {
    onReload: fn(),
    importAction: (
      <Button variant="outline" size="sm" className="h-8 px-3">
        <UploadIcon aria-hidden />
        Import CSV
      </Button>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('button', { name: 'Import CSV' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  },
}
