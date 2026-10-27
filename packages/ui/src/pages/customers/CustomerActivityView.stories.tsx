import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
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
  source: 'Dashboard',
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
  source: 'Workflow',
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

/**
 * For stories that end with the filter's popover open: the vendored value
 * popover and cascader search input are unnamed, a gap in the primitive (as
 * in `FilterBar.stories.tsx`), not what these stories check.
 */
const OPEN_FILTER_A11Y = {
  a11y: {
    config: {
      rules: [
        { id: 'aria-hidden-focus', enabled: false },
        { id: 'aria-input-field-name', enabled: false },
        { id: 'aria-dialog-name', enabled: false },
        { id: 'label-title-only', enabled: false },
      ],
    },
  },
}

/** Keeps the filters in state, so the controls respond as they do in the app. */
function Stateful(args: CustomerActivityViewProps) {
  const [filters, setFilters] = useState(args.filters)
  return (
    <CustomerActivityView
      {...args}
      filters={filters}
      onFiltersChange={(next) => {
        setFilters(next)
        args.onFiltersChange(next)
      }}
    />
  )
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
    await expect(await canvas.findByText('Subrat')).toBeVisible()
    // Event, actor, source and time; no status column.
    const headers = canvas.getAllByRole('columnheader').map((cell) => cell.textContent?.trim())
    await expect(headers).toEqual(expect.arrayContaining(['Event', 'Actor', 'Source', 'Time']))
    await expect(headers).not.toContain('Status')
    await expect(canvas.getAllByText('Workflow').length).toBeGreaterThan(0)
    await userEvent.click(canvas.getAllByRole('button', { name: 'Row actions' })[0]!)
    await userEvent.click(await screen.findByRole('menuitem', { name: 'View details' }))
    await expect(await screen.findByText('Event metadata')).toBeVisible()
    await expect(screen.getByText('182.76.138.114')).toBeVisible()
    // The stacked sheet shows long IDs whole rather than shortened.
    await expect(screen.getByText('dde9a118-f186-45a6-969b-a9dab4590a75')).toBeVisible()
    await expect(screen.getByText('01M5M665C22MX2ZDF5FNA0T9Y8')).toBeVisible()
  },
}

/** The old All actions / All actors / All sources selects are gone: one Filter and one Sort. */
export const StandardFilterAndSort: Story = {
  parameters: OPEN_FILTER_A11Y,
  args: {
    personOptions: [
      { value: 'user_1', label: 'Subrat' },
      { value: 'user_2', label: 'Asha' },
    ],
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('combobox', { name: 'Action' })).toBeNull()
    await expect(canvas.queryByRole('combobox', { name: 'Actor' })).toBeNull()
    await expect(canvas.queryByRole('combobox', { name: 'Source' })).toBeNull()
    // The time range stays.
    await expect(canvas.getByRole('combobox', { name: 'Date range' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: /^Sort by Time, descending/ })).toBeVisible()

    // The Person filter (#222) lives in the filter and sets the actor to people.
    await userEvent.click(canvas.getByRole('button', { name: 'Filter' }))
    const dialog = await screen.findByRole('dialog', { name: 'Advanced filter' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add filter' }))
    const fields = (await screen.findAllByRole('option')).map((option) => option.textContent)
    await expect(fields).toEqual(['Action', 'Actor', 'Person', 'Source'])
    await userEvent.click(screen.getByRole('option', { name: 'Person' }))
    await userEvent.click(await screen.findByRole('option', { name: 'is' }))
    const people = await screen.findByRole('listbox', { name: 'Person' })
    await userEvent.click(within(people).getByRole('option', { name: 'Asha' }))
    await waitFor(() =>
      expect(args.onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({ actorType: 'user', actorId: 'user_2' }),
      ),
    )
  },
}

/** With Actor = System, choosing a person switches the actor to people rather than dropping the person. */
export const PersonOverridesActor: Story = {
  parameters: OPEN_FILTER_A11Y,
  args: {
    filters: { ...FILTERS, actorType: 'system' },
    personOptions: [
      { value: 'user_1', label: 'Subrat' },
      { value: 'user_2', label: 'Asha' },
    ],
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Filter. 1 active' }))
    const dialog = await screen.findByRole('dialog', { name: 'Advanced filter' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add filter' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Person' }))
    await userEvent.click(await screen.findByRole('option', { name: 'is' }))
    const people = await screen.findByRole('listbox', { name: 'Person' })
    await userEvent.click(within(people).getByRole('option', { name: 'Asha' }))
    await waitFor(() =>
      expect(args.onFiltersChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ actorType: 'user', actorId: 'user_2' }),
      ),
    )
  },
}

/** Adding a second filter keeps the first: Action set, then Source added. */
export const AddingAFilterKeepsTheOthers: Story = {
  parameters: OPEN_FILTER_A11Y,
  args: { filters: { ...FILTERS, action: 'customer.created' } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Filter. 1 active' }))
    const dialog = await screen.findByRole('dialog', { name: 'Advanced filter' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add filter' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Source' }))
    await userEvent.click(await screen.findByRole('option', { name: 'is' }))
    const sources = await screen.findByRole('listbox', { name: 'Source' })
    await userEvent.click(within(sources).getByRole('option', { name: 'Dashboard' }))
    await waitFor(() =>
      expect(args.onFiltersChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: 'customer.created', source: 'dashboard' }),
      ),
    )
  },
}

/** Sort reorders the page: oldest first reverses the newest-first order the API sends. */
export const SortOldestFirst: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const firstTitle = () =>
      within(canvas.getAllByRole('row')[1]!).getByText(/created$/).textContent
    await expect(firstTitle()).toBe('Customer created')
    await userEvent.click(canvas.getByRole('button', { name: /^Sort by Time/ }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Ascending' }))
    await waitFor(() => expect(firstTitle()).toBe('Invoice created'))
  },
}

export const Empty: Story = {
  args: { rows: [], summary: 'No events' },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('No activity matches')).toBeVisible()
  },
}

export const Failed: Story = {
  args: { rows: [], error: 'The time range can be at most 30 days.', onRetry: fn() },
}

/** A custom range shows its two days beside the range picker. */
export const CustomRange: Story = {
  args: { filters: { ...FILTERS, range: 'custom', from: '2026-10-01', to: '2026-10-15' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'From' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'To' })).toBeVisible()
  },
}

/** A chosen person shows as active filters: the actor (people) and the person. */
export const OnePerson: Story = {
  args: {
    filters: { ...FILTERS, actorType: 'user', actorId: 'user_1' },
    personOptions: [
      { value: 'user_1', label: 'Subrat' },
      { value: 'user_2', label: 'Asha' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Filter. 2 active' })).toBeVisible()
  },
}

/** Without people to choose, the filter offers no Person field. */
export const NoPeople: Story = {
  parameters: OPEN_FILTER_A11Y,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Filter' }))
    const dialog = await screen.findByRole('dialog', { name: 'Advanced filter' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add filter' }))
    await expect(await screen.findByRole('option', { name: 'Source' })).toBeVisible()
    await expect(screen.queryByRole('option', { name: 'Person' })).toBeNull()
  },
}
