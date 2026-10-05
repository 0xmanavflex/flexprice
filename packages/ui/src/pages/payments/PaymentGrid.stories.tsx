import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import {
  DEFAULT_PAYMENT_QUERY,
  type Payment,
  type PaymentQuery,
  PaymentStatus,
  money,
} from '@fp/domain'
import { PaymentGrid } from './PaymentGrid'

const meta = {
  title: 'Surfaces/PaymentGrid',
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

export const Default: Story = {}

/**
 * Method and Gateway are different facts, and both are real fields.
 *
 * "Card" is what the customer presented; Stripe is who charged it. A payment
 * recorded by hand has neither and dashes on both.
 */
export const MethodAndGateway: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(await canvas.findByText('INV-1041')).toBeInTheDocument()
    await expect(canvas.getAllByText('Card').length).toBeGreaterThan(0)
    // Two rows were taken through Stripe, one through Razorpay.
    await expect(canvas.getAllByText('Stripe')).toHaveLength(2)
    await expect(canvas.getByText('Razorpay')).toBeInTheDocument()
    // The wire's screaming snake case, made readable without a lookup table
    // that would render an unknown method blank.
    await expect(canvas.getByText('Ach Debit')).toBeInTheDocument()
    await expect(canvas.getAllByText('—').length).toBeGreaterThanOrEqual(3)
  },
}

/**
 * Customer is not a column, because `PaymentResponse` has no customer.
 *
 * Not a name, not even a `customer_id` — only `destination_id`, which is the
 * invoice. The Invoice column is the honest version of the same lookup.
 */
export const NoCustomerColumn: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('INV-1041')

    const headers = Array.from(canvasElement.querySelectorAll('thead th')).map((th) =>
      (th.textContent ?? '').trim().toLowerCase(),
    )
    await expect(headers).not.toContain('customer')
    await expect(headers).toContain('invoice')
    await expect(headers).toContain('gateway')
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
    await expect(
      await within(canvasElement).findByText(/no payments match these filters/i),
    ).toBeInTheDocument()
  },
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
