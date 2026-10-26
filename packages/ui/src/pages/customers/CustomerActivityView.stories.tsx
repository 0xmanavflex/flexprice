import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import {
  CustomerActivityView,
  type ActivityFilters,
  type ActivityRowView,
  type CustomerActivityViewProps,
} from './CustomerActivityView'

const customerCreated: ActivityRowView = {
  id: 'act_1',
  title: 'Customer created',
  entityType: 'customer',
  entityNoun: 'Customer',
  entityLabel: 'Dinesh Khairnar',
  entityId: 'cust_01M5C4ZKXJ30AFYARXPN1RYNNT',
  entityHref: '/customers/cust_01M5C4ZKXJ30AFYARXPN1RYNNT',
  actor: 'Subrat',
  actorDetail: 'Dashboard',
  at: 'Oct 25, 2026, 11:03 PM GMT+5:30',
  atUtc: '25 Oct 2026, 17:33:42 UTC',
  statuses: [{ label: 'Published', tone: 'success' }],
  state: [
    { label: 'Tax treatment', value: 'Taxable' },
    { label: 'Timezone', value: 'UTC' },
    { label: 'Status', value: 'Published' },
  ],
  metadata: [
    { label: 'Source', value: 'Dashboard' },
    { label: 'Request ID', value: '01M5M665C22MX2ZDF5FNA0T9Y8', copy: true },
    { label: 'IP address', value: '182.76.138.114', copy: true },
    { label: 'Actor ID', value: 'dde9a118-f186-45a6-969b-a9dab4590a75', copy: true },
    { label: 'Event ID', value: 'act_1', copy: true },
  ],
  raw: '{\n  "id": "act_1",\n  "action": "customer.created"\n}',
}

const invoicePaid: ActivityRowView = {
  ...customerCreated,
  id: 'act_2',
  title: 'Invoice created',
  entityType: 'invoice',
  entityNoun: 'Invoice',
  entityLabel: 'INV-202610-00005',
  entityId: 'inv_01',
  entityHref: '/invoices/inv_01',
  actor: 'Billing workflow',
  actorDetail: 'Workflow',
  statuses: [
    { label: 'Finalized', tone: 'info' },
    { label: 'Paid', tone: 'success' },
  ],
  state: [{ label: 'Total', value: '$35.00' }],
  metadata: [
    { label: 'Source', value: 'Workflow' },
    { label: 'Event ID', value: 'act_2', copy: true },
  ],
}

const FILTERS: ActivityFilters = { search: '', action: '', actorType: '', source: '', range: '30d' }

/** Keeps the filters in state, so the controls respond as they do in the app. */
function Stateful(args: CustomerActivityViewProps) {
  const [filters, setFilters] = useState(args.filters)
  return <CustomerActivityView {...args} filters={filters} onFiltersChange={setFilters} />
}

const meta = {
  title: 'App/Customers/Customer activity',
  component: CustomerActivityView,
  parameters: { layout: 'padded' },
  args: {
    rows: [customerCreated, invoicePaid],
    filters: FILTERS,
    onFiltersChange: fn(),
    actionOptions: [{ value: 'customer.created', label: 'Customer created' }],
    actorOptions: [
      { value: 'user', label: 'People' },
      { value: 'system', label: 'System' },
    ],
    sourceOptions: [{ value: 'dashboard', label: 'Dashboard' }],
    summary: 'Showing 1–2 of 2 events',
    page: 1,
    hasPrevious: false,
    hasNext: false,
    onPrevious: fn(),
    onNext: fn(),
    pageSize: 25,
    onPageSizeChange: fn(),
    onNavigate: fn(),
  },
  render: (args) => <Stateful {...args} />,
} satisfies Meta<typeof CustomerActivityView>

export default meta
type Story = StoryObj<typeof meta>

/** The actor and the record stay separate; opening a row shows its metadata. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Subrat')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: /^Open details: Customer created/ }))
    await expect(await screen.findByText('Event metadata')).toBeVisible()
    await expect(screen.getByText('182.76.138.114')).toBeVisible()
    // The stacked sheet shows long IDs whole rather than shortened.
    await expect(screen.getByText('dde9a118-f186-45a6-969b-a9dab4590a75')).toBeVisible()
    await expect(screen.getByText('01M5M665C22MX2ZDF5FNA0T9Y8')).toBeVisible()
  },
}

export const Empty: Story = {
  args: { rows: [], summary: 'No events' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No activity matches')).toBeVisible()
  },
}

export const Failed: Story = {
  args: { rows: [], error: 'The time range can be at most 30 days.', onRetry: fn() },
}
