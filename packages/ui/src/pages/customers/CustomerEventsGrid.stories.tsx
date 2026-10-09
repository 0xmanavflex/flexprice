import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, screen, userEvent, within } from 'storybook/test'
import { CustomerEventsGrid, DEMO_CUSTOMER_EVENTS, type CustomerEvent } from './CustomerEventsGrid'

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
  args: { events: DEMO_CUSTOMER_EVENTS },
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
