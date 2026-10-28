import { type ComponentProps, useMemo, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import {
  DEFAULT_PAYMENT_QUERY,
  type Payment,
  type PaymentQuery,
  PaymentStatus,
  money,
} from '@fp/domain'
import { PaymentGrid } from './PaymentGrid'

const meta = {
  title: 'App/Collections/Payments/Payment table',
  component: PaymentGrid,
  parameters: { layout: 'padded' },
  args: {
    payments: paymentFixtures(),
    total: 4,
    query: { ...DEFAULT_PAYMENT_QUERY } satisfies PaymentQuery,
    onQueryChange: fn(),
    locale: 'en-US',
  },
} satisfies Meta<typeof PaymentGrid>

export default meta
type Story = StoryObj<typeof meta>

function paymentFixtures(): Payment[] {
  return [
    {
      id: 'pay_01JQ4ZK8ACME',
      amount: money('12480.00', 'USD'),
      status: PaymentStatus.Succeeded,
      methodType: 'CARD',
      gateway: 'stripe',
      invoiceNumber: 'INV-1041',
      createdAt: new Date('2026-02-03T00:00:00Z'),
      succeededAt: new Date('2026-02-03T00:00:00Z'),
    },
    {
      id: 'pay_01JQ4ZK8GLBX',
      amount: money('980.50', 'USD'),
      status: PaymentStatus.Failed,
      methodType: 'ACH_DEBIT',
      gateway: 'stripe',
      invoiceNumber: 'INV-1042',
      createdAt: new Date('2026-03-02T00:00:00Z'),
      succeededAt: null,
    },
    {
      // Recorded by hand: no gateway took it, and no method was reported.
      id: 'pay_01JQ4ZK8INIT',
      amount: money('4200.00', 'USD'),
      status: PaymentStatus.Pending,
      methodType: '',
      gateway: '',
      invoiceNumber: '',
      createdAt: new Date('2026-03-11T00:00:00Z'),
      succeededAt: null,
    },
    {
      id: 'pay_01JQ4ZK8UMBR',
      amount: money('310.00', 'GBP'),
      status: PaymentStatus.Refunded,
      methodType: 'CARD',
      gateway: 'razorpay',
      invoiceNumber: 'INV-1045',
      createdAt: new Date('2026-04-06T00:00:00Z'),
      succeededAt: new Date('2026-04-06T00:00:00Z'),
    },
  ]
}

/** A deterministic page-worth of payments: the fixtures, cycled with unique ids. */
function manyPayments(count: number): Payment[] {
  const base = paymentFixtures()
  return Array.from({ length: count }, (_, index) => ({
    ...(base[index % base.length] as Payment),
    id: `pay_page_${index}`,
    invoiceNumber: base[index % base.length]?.invoiceNumber ? `INV-${3000 + index}` : '',
  }))
}

export const Default: Story = {}

/**
 * Entities enabled: a Billing entity column (a payment without one reads as the
 * default) and a Billing entity field beside Status in the filter, reported
 * together with the statuses.
 */
export const WithBillingEntities: Story = {
  args: {
    billingEntities: [
      { id: 'be_default', name: 'Northwind Inc', isDefault: true },
      { id: 'be_india', name: 'Northwind India', isDefault: false },
    ],
    query: { ...DEFAULT_PAYMENT_QUERY, statuses: [PaymentStatus.Failed] },
    payments: paymentFixtures().map((payment, index) =>
      index === 0 ? { ...payment, billingEntityId: 'be_india' } : payment,
    ),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('columnheader', { name: /billing entity/i })).toBeVisible()
    await expect(canvas.getByText('Northwind India')).toBeInTheDocument()
    await expect(canvas.getAllByText('Northwind Inc').length).toBeGreaterThanOrEqual(1)

    await userEvent.click(canvas.getByRole('button', { name: /^Filter/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Add filter' }))
    await userEvent.click(await screen.findByRole('option', { name: /^Billing entity$/ }))
    await userEvent.click(await screen.findByRole('option', { name: /^is$/ }))
    await userEvent.click(await screen.findByRole('option', { name: 'Northwind India' }))
    await waitFor(() =>
      expect(args.onQueryChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          statuses: [PaymentStatus.Failed],
          filters: [{ field: 'billing_entity_id', op: 'eq', value: 'be_india' }],
        }),
      ),
    )
  },
}

/**
 * Method is a real field; a payment recorded by hand has none and dashes.
 *
 * "Card" is what the customer presented; the wire's screaming snake case is
 * made readable without a lookup table that would render an unknown method
 * blank.
 */
export const PaymentMethod: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(await canvas.findByText('INV-1041')).toBeInTheDocument()
    await expect(canvas.getAllByText('Card').length).toBeGreaterThan(0)
    await expect(canvas.getByText('Ach Debit')).toBeInTheDocument()
    await expect(canvas.getAllByText('—').length).toBeGreaterThanOrEqual(3)
  },
}

/**
 * The columns V1 showed: when, which invoice, how much, how, and the
 * gateway's reference. No always-empty customer or receipt column.
 */
export const Columns: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('INV-1041')

    const headers = Array.from(canvasElement.querySelectorAll('thead th')).map((th) =>
      (th.textContent ?? '').trim().toLowerCase(),
    )
    await expect(headers).toEqual(
      expect.arrayContaining([
        'date',
        'invoice number',
        'amount',
        'payment method',
        'status',
        'gateway reference',
      ]),
    )
    await expect(headers).not.toContain('customer')
    await expect(headers).not.toContain('receipt number')
  },
}

/** The shared table's geometry, as this surface renders it. */
export const Layout: Story = {
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText('INV-1041')

    const header = canvasElement.querySelector('thead th') as HTMLElement
    await expect(Math.round(header.getBoundingClientRect().height)).toBe(44)

    const cell = canvasElement.querySelector('tbody td') as HTMLElement
    await expect(Math.round(cell.getBoundingClientRect().height)).toBe(60)
  },
}

export const Loading: Story = { args: { payments: [], total: 0, isLoading: true } }

export const FilteredEmpty: Story = {
  args: {
    payments: [],
    total: 0,
    query: { ...DEFAULT_PAYMENT_QUERY, search: 'zzz' },
    onClearFilters: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Empty here means "none on this page", never "none in the ledger".
    await expect(await canvas.findByText(/no matching payments on this page/i)).toBeInTheDocument()
    await expect(canvas.getByText(/other pages may have matches/i)).toBeInTheDocument()
  },
}

/** A status filter over a page that still has hits: the caveat sits above the toolbar. */
export const FilteredWithinLoadedRows: Story = {
  args: {
    payments: paymentFixtures().slice(1, 2),
    total: 40,
    query: { ...DEFAULT_PAYMENT_QUERY, statuses: [PaymentStatus.Failed] },
    onClearFilters: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/filtered within the loaded rows/i)).toBeVisible()
    await expect(canvas.getByText(/the count below is every payment/i)).toBeVisible()
  },
}

/** Rows stay put while the next page loads; they are dimmed, not blanked. */
export const Refreshing: Story = { args: { isRefreshing: true } }

/** Held rows are dimmed on purpose, so they are not asserted against the contrast floor. */
export const ProvisionalPage: Story = {
  args: { isProvisional: true, isRefreshing: true },
  parameters: { a11y: { config: { rules: [{ id: 'color-contrast', enabled: false }] } } },
}

export const FirstRun: Story = {
  args: { payments: [], total: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('No money has moved yet')).toBeInTheDocument()
    await expect(canvas.getAllByText('Read docs')).toHaveLength(3)
  },
}

export const Error: Story = {
  args: {
    payments: [],
    total: 0,
    error: 'You do not have access to payments in this environment.',
    onRetry: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: /try again/i }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}

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
    expect(Object.keys(reported).sort()).toEqual(Object.keys(DEFAULT_PAYMENT_QUERY).sort())
  },
}

/** Overrides every row's status so one state can be inspected across a long list. */
function withStatus<T extends { status: unknown }>(items: T[], status: string): T[] {
  return status === 'mixed' ? items : items.map((item) => ({ ...item, status }) as T)
}

type PlaygroundArgs = Omit<
  ComponentProps<typeof PaymentGrid>,
  'payments' | 'total' | 'query' | 'onQueryChange' | 'error'
> & {
  /** How many records the server holds, 0 to 60. */
  rows: number
  /** The page shown, 1-based. */
  page: number
  pageSize: number
  /** Forces every row to one status; mixed keeps the fixture spread. */
  status: 'mixed' | PaymentStatus
  /** Shows the error state instead of the list. */
  hasError: boolean
}

function PaymentGridPlayground({
  rows,
  page,
  pageSize,
  status,
  hasError,
  ...rest
}: PlaygroundArgs) {
  const [query, setQuery] = useState<PaymentQuery>({ ...DEFAULT_PAYMENT_QUERY, page, pageSize })
  const all = useMemo(() => withStatus(manyPayments(rows), status), [rows, status])
  const lastPage = Math.max(1, Math.ceil(all.length / query.pageSize))
  const current = Math.min(query.page, lastPage)
  const start = (current - 1) * query.pageSize
  return (
    <PaymentGrid
      locale="en-US"
      {...rest}
      payments={all.slice(start, start + query.pageSize)}
      total={all.length}
      query={{ ...query, page: current }}
      onQueryChange={setQuery}
      error={hasError ? 'You do not have access to payments in this environment.' : null}
    />
  )
}

/** Drag rows from 0 to 60 to walk empty, one page, and a long list; flip loading and error. */
export const Playground: StoryObj<PlaygroundArgs> = {
  parameters: { controls: { exclude: /^(payments|total|query|error|on[A-Z].*)$/ } },
  args: {
    rows: 30,
    page: 1,
    pageSize: 10,
    status: 'mixed',
    isLoading: false,
    hasError: false,
    onRetry: fn(),
    onCreate: fn(),
    onPaymentClick: fn(),
  },
  argTypes: {
    rows: { control: { type: 'number', min: 0, max: 60, step: 1 } },
    page: { control: { type: 'number', min: 1, max: 6, step: 1 } },
    pageSize: { control: 'select', options: [10, 25, 50] },
    status: { control: 'select', options: ['mixed', ...Object.values(PaymentStatus)] },
    isLoading: { control: 'boolean' },
    hasError: { control: 'boolean' },
  },
  render: (args) => <PaymentGridPlayground key={`${args.page}-${args.pageSize}`} {...args} />,
}
