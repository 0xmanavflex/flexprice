import { type ComponentProps, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import {
  DEFAULT_CUSTOMER_QUERY,
  type Customer,
  type CustomerQuery,
  CustomerStatus,
} from '@fp/domain'
import { CustomerGrid } from './CustomerGrid'

/**
 * The customer list on the shared table.
 *
 * Fixtures are plain domain values: no API client, no query client, no
 * provider. That is the claim `@fp/ui` makes, and a story file is where it is
 * either true or obviously false.
 */
const meta = {
  title: 'App/Customers/Customer table',
  component: CustomerGrid,
  parameters: { layout: 'padded' },
  args: {
    customers: customerFixtures(),
    total: 4,
    query: { ...DEFAULT_CUSTOMER_QUERY } satisfies CustomerQuery,
    onQueryChange: fn(),
    locale: 'en-US',
  },
  argTypes: {
    customers: { control: false },
    total: { control: false },
    query: { control: false },
    isLoading: { control: 'boolean' },
    error: { control: false },
    locale: { control: 'select', options: ['en-US', 'en-GB', 'de-DE'] },
    onQueryChange: { control: false },
    onRetry: { control: false },
    onCustomerClick: { control: false },
    onCreate: { control: false },
    onEdit: { control: false },
    onDelete: { control: false },
    onClearFilters: { control: false },
  },
} satisfies Meta<typeof CustomerGrid>

export default meta
type Story = StoryObj<typeof meta>

type PlaygroundArgs = ComponentProps<typeof CustomerGrid> & {
  rows: number
  hasError: boolean
  page: number
  pageSize: number
}

function CustomerGridPlayground({ rows, hasError, page, pageSize, ...args }: PlaygroundArgs) {
  const [query, setQuery] = useState(() => ({ ...DEFAULT_CUSTOMER_QUERY, page, pageSize }))
  const start = (query.page - 1) * query.pageSize
  return (
    <CustomerGrid
      {...args}
      customers={manyCustomers(rows).slice(start, start + query.pageSize)}
      total={rows}
      query={query}
      onQueryChange={(next) => {
        setQuery(next)
        args.onQueryChange(next)
      }}
      error={hasError ? 'You do not have access to customers in this environment.' : null}
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
  render: (args) => <CustomerGridPlayground key={`${args.page}-${args.pageSize}`} {...args} />,
}

/** Fixed dates, so a story renders identically today and next March. */
function customerFixtures(): Customer[] {
  return [
    {
      id: 'cus_01',
      name: 'Acme Robotics',
      email: 'billing@acme.example',
      externalId: 'acme-1000',
      addressCountry: 'ca',
      status: CustomerStatus.Published,
      createdAt: new Date('2025-04-19T00:00:00Z'),
      updatedAt: new Date('2026-09-01T00:00:00Z'),
      integrations: [
        {
          id: 'stripe',
          name: 'Stripe',
          providerType: 'stripe',
          providerEntityId: 'cus_Qx83mKd02aZpL',
        },
      ],
    },
    {
      id: 'cus_02',
      name: 'Globex',
      email: 'ap@globex.example',
      externalId: 'globex-77',
      addressCountry: 'US',
      status: CustomerStatus.Published,
      createdAt: new Date('2025-06-02T00:00:00Z'),
      updatedAt: new Date('2026-08-11T00:00:00Z'),
      integrations: [
        {
          id: 'stripe',
          name: 'Stripe',
          providerType: 'stripe',
          providerEntityId: 'cus_Rt41vNb77cWqE',
        },
        {
          id: 'quickbooks',
          name: 'QuickBooks',
          providerType: 'quickbooks',
          providerEntityId: 'qb_1042',
        },
      ],
    },
    {
      // Everything optional absent: the row a hand-written demo never includes,
      // and the one that proves the em dash rather than a blank cell.
      id: 'cus_03',
      name: 'Initech',
      email: '',
      externalId: '',
      addressCountry: '',
      status: CustomerStatus.Published,
      createdAt: new Date('2026-01-15T00:00:00Z'),
      updatedAt: null,
      integrations: [],
    },
    {
      id: 'cus_04',
      name: 'Umbrella Ltd',
      email: 'finance@umbrella.example',
      externalId: 'umb-4',
      addressCountry: 'GB',
      status: CustomerStatus.Archived,
      createdAt: new Date('2024-11-30T00:00:00Z'),
      updatedAt: new Date('2026-02-02T00:00:00Z'),
      integrations: [{ id: 'razorpay', name: 'Razorpay', providerType: 'razorpay' }],
    },
  ]
}

function manyCustomers(count: number): Customer[] {
  const base = customerFixtures()
  return Array.from({ length: count }, (_, index) => {
    const customer = base[index % base.length] as Customer
    return { ...customer, id: `cus_page_${index}`, name: `${customer.name} ${index + 1}` }
  })
}

export const Default: Story = {}

/**
 * Email is a column, not a subtitle.
 *
 * Stacked under the name it was unsortable, unexportable and clipped twice as
 * often: and it is the field support actually searches by.
 */
export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(await canvas.findByText('Acme Robotics')).toBeInTheDocument()
    await expect(canvas.getByText('billing@acme.example')).toBeInTheDocument()
    // Initech carries no email, external id or integrations.
    await expect(canvas.getAllByText('—').length).toBeGreaterThanOrEqual(3)
  },
}

/**
 * The four columns the redesign asked for and this table does not have.
 *
 * Plan, MRR, Wallet balance and Subscriptions are omitted rather than shipped
 * as permanently empty columns: a column of em dashes asserts that these
 * customers have no plan and no revenue, which is a different and worse claim
 * than saying nothing. Asserted so the omission is a decision on the record
 * rather than something that quietly drifts back in.
 */
export const NoInventedColumns: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('Acme Robotics')

    const headers = Array.from(canvasElement.querySelectorAll('thead th')).map((th) =>
      (th.textContent ?? '').trim().toLowerCase(),
    )
    for (const absent of ['mrr', 'plan', 'wallet balance', 'subscriptions']) {
      await expect(headers).not.toContain(absent)
    }
    await expect(headers).toContain('name')
  },
}

/** The shared table's geometry, as this surface renders it. */
export const Layout: Story = {
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText('Acme Robotics')

    const header = canvasElement.querySelector('thead th') as HTMLElement
    await expect(Math.round(header.getBoundingClientRect().height)).toBe(44)

    const cell = canvasElement.querySelector('tbody td') as HTMLElement
    await expect(Math.round(cell.getBoundingClientRect().height)).toBe(60)
    await expect(getComputedStyle(cell).paddingLeft).toBe('16px')
  },
}

export const Loading: Story = { args: { customers: [], total: 0, isLoading: true } }

/** A filter emptied the list: the toolbar survives, so it can be undone. */
export const FilteredEmpty: Story = {
  args: {
    customers: [],
    total: 0,
    query: { ...DEFAULT_CUSTOMER_QUERY, search: 'zzz' },
    onClearFilters: fn(),
  },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/no customers match these filters/i),
    ).toBeInTheDocument()
  },
}

/** Nobody to bill yet: the CTA, and three guide cards that resolve. */
export const FirstRun: Story = {
  args: { customers: [], total: 0, onCreate: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Nobody to bill yet')).toBeInTheDocument()
    await expect(canvas.getAllByText('Read docs')).toHaveLength(3)
  },
}

export const Error: Story = {
  args: {
    customers: [],
    total: 0,
    error: 'You do not have access to customers in this environment.',
    onRetry: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: /try again/i }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}

/** Paging reports a page number, never an offset, and never drops a query key. */
export const PaginationReportsDomainQuery: Story = {
  args: { total: 120 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.click(await canvas.findByRole('button', { name: /next|go to next page/i }))

    const spy = args.onQueryChange as unknown as { mock: { calls: unknown[][] } }
    const reportedPage = () =>
      spy.mock.calls.map((call) => call[0] as Record<string, unknown>).find((q) => q['page'] === 2)
    await waitFor(() => expect(reportedPage()).toBeDefined())
    const reported = reportedPage() as Record<string, unknown>
    expect(reported).toMatchObject({ page: 2 })
    expect(Object.keys(reported).sort()).toEqual(Object.keys(DEFAULT_CUSTOMER_QUERY).sort())
  },
}
