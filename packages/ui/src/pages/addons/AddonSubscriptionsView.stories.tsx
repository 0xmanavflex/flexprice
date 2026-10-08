import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { AddonSubscriptionsView, type AddonSubscriber } from './AddonSubscriptionsView'

const CUSTOMERS = ['Acme Corp', 'Globex', 'Umbrella', 'Initech', 'Hooli', 'Stark Industries']
const PLANS = ['Pro monthly', 'Scale annual', 'Team monthly', 'Starter']
const STATUSES = ['Active', 'Cancelled', 'Trialing'] as const
const SINCE = ['Aug 2, 2026', 'Jul 14, 2026', 'Jun 30, 2026', 'May 9, 2026']

type StatusMix = 'Mixed' | (typeof STATUSES)[number]

/** Deterministic rows: the same count always gives the same table. */
function makeSubscribers(count: number, status: StatusMix): AddonSubscriber[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `sub_${i + 1}`,
    customer: `${CUSTOMERS[i % CUSTOMERS.length]}${i >= CUSTOMERS.length ? ` ${Math.floor(i / CUSTOMERS.length) + 1}` : ''}`,
    plan: PLANS[i % PLANS.length] ?? 'Pro monthly',
    since: SINCE[i % SINCE.length] ?? 'Aug 2, 2026',
    status: status === 'Mixed' ? (STATUSES[i % STATUSES.length] ?? 'Active') : status,
  }))
}

const meta = {
  title: 'Surfaces/AddonSubscriptionsView',
  component: AddonSubscriptionsView,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof AddonSubscriptionsView>

export default meta
type Story = StoryObj<typeof meta>

interface PlaygroundArgs {
  rows: number
  status: StatusMix
}

/** Drag rows from 0 to 50: the empty state, a short list, then paging. Status recolours every row. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: { rows: 8, status: 'Mixed' },
  argTypes: {
    rows: { control: { type: 'range', min: 0, max: 50, step: 1 } },
    status: { control: 'select', options: ['Mixed', ...STATUSES] },
  },
  render: ({ rows, status }) => (
    <AddonSubscriptionsView subscriptions={makeSubscribers(rows, status)} />
  ),
}

/** The demo data the container ships with until an endpoint exists. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Acme Corp')).toBeInTheDocument()
  },
}

export const Empty: Story = {
  args: { subscriptions: [] },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText('No contract uses this add-on yet.'),
    ).toBeInTheDocument()
  },
}

export const LongList: Story = { args: { subscriptions: makeSubscribers(40, 'Mixed') } }
