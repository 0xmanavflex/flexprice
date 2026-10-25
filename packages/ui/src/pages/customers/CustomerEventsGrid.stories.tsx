import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import { CustomerEventsGrid, type CustomerEvent } from './CustomerEventsGrid'

const NAMES = ['api_call', 'storage_write', 'seat_added', 'image_generated']
const SOURCES = ['sdk', 'api', 'webhook']
const WHEN = ['Today, 09:14', 'Today, 08:52', 'Yesterday', 'Sep 28', 'Sep 20', 'Sep 1']

/** Deterministic events: the same count always gives the same table. */
function makeEvents(count: number): CustomerEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `evt_${count - i}`,
    name: NAMES[i % NAMES.length] ?? 'api_call',
    properties: { endpoint: `/v1/route-${i % 5}`, tokens: String(80 + ((i * 131) % 1500)) },
    source: SOURCES[i % SOURCES.length] ?? 'sdk',
    receivedAt: WHEN[i % WHEN.length] ?? 'Today, 09:14',
  }))
}

const meta = {
  title: 'App/Customers/Customer events',
  component: CustomerEventsGrid,
  parameters: { layout: 'padded' },
  args: { events: makeEvents(6) },
} satisfies Meta<typeof CustomerEventsGrid>

export default meta
type Story = StoryObj<typeof meta>

/** Drag events from 0 to 60: the empty state, a short list, then paging. Click a row for its sheet. */
export const Playground: StoryObj<{ rows: number }> = {
  args: { rows: 12 },
  argTypes: { rows: { control: { type: 'range', min: 0, max: 60, step: 1 } } },
  render: ({ rows }) => <CustomerEventsGrid events={makeEvents(rows)} />,
}

export const Default: Story = {}

export const Empty: Story = {
  args: { events: [] },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText(/No events yet/)).toBeInTheDocument()
  },
}

export const LongList: Story = { args: { events: makeEvents(40) } }

/** Opening a row shows its properties in a side sheet. */
export const OpensEventSheet: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const row = (await canvas.findAllByText('api_call'))[0]
    if (!row) throw new Error('no event row')
    await userEvent.click(row)
    await expect(await screen.findByText(/Received Today, 09:14 via sdk/)).toBeInTheDocument()
  },
}

/** With `onOpenEvent`, a row opens the page's own detail view instead of the minimal sheet. */
export const HandsRowToPage: Story = {
  args: { onOpenEvent: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const row = (await canvas.findAllByText('api_call'))[0]
    if (!row) throw new Error('no event row')
    await userEvent.click(row)
    await expect(args.onOpenEvent).toHaveBeenCalledOnce()
    await expect(screen.queryByText(/Received .* via sdk/)).toBeNull()
  },
}

/** Refresh sits in the section header, so it is there even before any event arrives. */
export const Refresh: Story = {
  args: { events: [], onRefresh: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/No events yet/)).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Refresh' }))
    await expect(args.onRefresh).toHaveBeenCalledOnce()
  },
}

/** While a refresh is in flight the button is disabled. */
export const Refreshing: Story = {
  args: { onRefresh: fn(), isRefreshing: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Refresh' })).toBeDisabled()
  },
}

/** The read is in flight: a shaped skeleton, never "No events yet". */
export const Loading: Story = {
  args: { events: [], isLoading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Loading events')).toBeInTheDocument()
    await expect(canvas.queryByText(/No events yet/)).not.toBeInTheDocument()
  },
}

/** The read failed: an inline error with retry, never an empty list. */
export const SubTabError: Story = {
  args: {
    events: [],
    error: 'Flexprice had a problem loading events.',
    errorKind: 'server',
    onRetry: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/problem loading events/)).toBeInTheDocument()
    await expect(canvas.queryByText(/No events yet/)).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: /try again/i }))
    await expect(args.onRetry).toHaveBeenCalledTimes(1)
  },
}

/** The newest 50 of a longer log: the cap is stated. */
export const Truncated: Story = {
  args: { events: makeEvents(50), total: 1204 },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/Showing the latest 50 of 1204 events/),
    ).toBeInTheDocument()
  },
}

/** A longer log loads as it is scrolled; the button does the same by hand. */
export const LoadsMore: Story = {
  args: { events: makeEvents(50), total: 1204, hasMore: true, onLoadMore: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText(/Showing the latest/)).not.toBeInTheDocument()
    await userEvent.click(await canvas.findByRole('button', { name: 'Load more events' }))
    await expect(args.onLoadMore).toHaveBeenCalled()
  },
}

/** The next page is on its way: the button waits. */
export const LoadingMore: Story = {
  args: { events: makeEvents(50), hasMore: true, isLoadingMore: true, onLoadMore: fn() },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole('button', { name: 'Loading…' }),
    ).toBeDisabled()
  },
}

/** All loaded events stay reachable: nothing hides behind a first page. */
export const ShowsEveryLoadedEvent: Story = {
  args: { events: makeEvents(120), hasMore: true, onLoadMore: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findAllByRole('row')).toHaveLength(121)
  },
}

/** A later page failed: the list says so and the retry is the reader's. */
export const LoadMoreFailed: Story = {
  args: { events: makeEvents(50), hasMore: true, loadMoreFailed: true, onLoadMore: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('The next events could not be loaded.')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }))
    await expect(args.onLoadMore).toHaveBeenCalledTimes(1)
  },
}
