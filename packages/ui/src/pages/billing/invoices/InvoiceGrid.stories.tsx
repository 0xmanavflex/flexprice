import { type ComponentProps, useMemo, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { DEFAULT_INVOICE_QUERY, type InvoiceQuery, InvoiceStatus } from '@fp/domain'
import { InvoiceGrid } from './InvoiceGrid'
import { fixtureQuery, invoiceFixtures, manyInvoices } from './invoiceFixtures'

/** Invoice table: payment status is visible; document status remains a filter. */
const meta = {
  title: 'App/Billing/Invoices/Invoice table',
  component: InvoiceGrid,
  parameters: { layout: 'padded' },
  args: {
    invoices: invoiceFixtures,
    total: invoiceFixtures.length,
    query: fixtureQuery,
    onQueryChange: fn(),
    locale: 'en-US',
  },
} satisfies Meta<typeof InvoiceGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** Missing payment status stays unknown, without inferring it from the balance. */
export const PaymentStatus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(await canvas.findByText('INV-1041')).toBeInTheDocument()
    const headings = canvas.getAllByRole('columnheader').map((cell) => cell.textContent?.trim())
    await expect(headings).toEqual([
      'Invoice number',
      'Customer',
      'Invoice date',
      'Due date',
      'Amount',
      'Amount due',
      'Payment status',
      'Integrations',
      'Actions',
    ])
    await expect(canvas.getByText('Succeeded')).toBeInTheDocument()
    // The draft and the void invoice carry no payment status.
    await expect(canvas.getAllByText('—').length).toBeGreaterThan(0)
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
    await expect(getComputedStyle(cell).paddingLeft).toBe('16px')
  },
}

/**
 * Amounts are left-aligned like every other column, with tabular figures.
 *
 * The rule `cells.tsx` exists to enforce, checked on the one grid where the
 * temptation to right-align is strongest.
 */
export const AmountsAreLeftAligned: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('INV-1041')

    const headers = Array.from(canvasElement.querySelectorAll('thead th'))
    const index = headers.findIndex((th) => /^amount$/i.test(th.textContent ?? ''))
    await expect(index).toBeGreaterThan(-1)

    const cell = canvasElement.querySelectorAll('tbody tr')[0]?.children[index] as HTMLElement
    await expect(getComputedStyle(cell).textAlign).not.toBe('right')
  },
}

/**
 * Choosing a derived status says on screen that it narrowed one page.
 *
 * `paid` and `overdue` are computed from a balance and a due date, so the API
 * cannot be asked for them. The alternative to this notice is an unfiltered
 * ledger presented as a filtered one, which on a billing console is the
 * failure mode worth engineering against.
 */
export const DerivedStatusSaysSo: Story = {
  args: { query: { ...fixtureQuery, statuses: [InvoiceStatus.Overdue] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/filtered within this page/i)).toBeInTheDocument()
  },
}

/** A stored status needs no caveat: the server did the filtering. */
export const StoredStatusIsSilent: Story = {
  args: { query: { ...fixtureQuery, statuses: [InvoiceStatus.Draft] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('INV-1041')
    await expect(canvas.queryByText(/filtered within this page/i)).not.toBeInTheDocument()
  },
}

export const Loading: Story = { args: { invoices: [], total: 0, isLoading: true } }

/** A filter emptied the list: the toolbar survives, so it can be undone. */
export const FilteredEmpty: Story = {
  args: {
    invoices: [],
    total: 0,
    query: { ...fixtureQuery, search: 'zzz' },
    onClearFilters: fn(),
  },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/no invoices match these filters/i),
    ).toBeInTheDocument()
  },
}

/** Nothing billed yet: the copy, and three guide cards that resolve. */
export const FirstRun: Story = {
  args: { invoices: [], total: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('No invoices yet')).toBeInTheDocument()
    await expect(canvas.getAllByText('Read docs')).toHaveLength(3)
  },
}

export const Error: Story = {
  args: {
    invoices: [],
    total: 0,
    error: 'You do not have access to invoices in this environment.',
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
  args: { invoices: manyInvoices(25), total: 120, query: { ...fixtureQuery, page: 1 } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.click(await canvas.findByRole('button', { name: /next|go to next page/i }))

    // The grid can also fire onQueryChange as it settles, so the Next click is
    // not necessarily call[0]. Wait for: then read: the call that reported
    // page 2, rather than racing whichever call landed first.
    const spy = args.onQueryChange as unknown as { mock: { calls: unknown[][] } }
    const reportedPage = () =>
      spy.mock.calls.map((call) => call[0] as Record<string, unknown>).find((q) => q['page'] === 2)
    await waitFor(() => expect(reportedPage()).toBeDefined())
    const reported = reportedPage() as Record<string, unknown>
    expect(reported).toMatchObject({ page: 2 })
    expect(Object.keys(reported).sort()).toEqual(Object.keys(fixtureQuery).sort())
  },
}

/** Overrides every row's status so one state can be inspected across a long list. */
function withStatus<T extends { status: unknown }>(items: T[], status: string): T[] {
  return status === 'mixed' ? items : items.map((item) => ({ ...item, status }) as T)
}

type PlaygroundArgs = Omit<
  ComponentProps<typeof InvoiceGrid>,
  'invoices' | 'total' | 'query' | 'onQueryChange' | 'error'
> & {
  /** How many records the server holds, 0 to 60. */
  rows: number
  /** The page shown, 1-based. */
  page: number
  pageSize: number
  /** Forces every row to one status; mixed keeps the fixture spread. */
  status: 'mixed' | InvoiceStatus
  /** Shows the error state instead of the list. */
  hasError: boolean
}

function InvoiceGridPlayground({
  rows,
  page,
  pageSize,
  status,
  hasError,
  ...rest
}: PlaygroundArgs) {
  const [query, setQuery] = useState<InvoiceQuery>({ ...DEFAULT_INVOICE_QUERY, page, pageSize })
  const all = useMemo(() => withStatus(manyInvoices(rows), status), [rows, status])
  const lastPage = Math.max(1, Math.ceil(all.length / query.pageSize))
  const current = Math.min(query.page, lastPage)
  const start = (current - 1) * query.pageSize
  return (
    <InvoiceGrid
      locale="en-US"
      {...rest}
      invoices={all.slice(start, start + query.pageSize)}
      total={all.length}
      query={{ ...query, page: current }}
      onQueryChange={setQuery}
      error={hasError ? 'You do not have access to invoices in this environment.' : null}
    />
  )
}

/** Drag rows from 0 to 60 to walk empty, one page, and a long list; flip loading and error. */
export const Playground: StoryObj<PlaygroundArgs> = {
  parameters: { controls: { exclude: /^(invoices|total|query|error|on[A-Z].*)$/ } },
  args: {
    rows: 30,
    page: 1,
    pageSize: 10,
    status: 'mixed',
    isLoading: false,
    hasError: false,
    onRetry: fn(),
    onCreate: fn(),
    onInvoiceClick: fn(),
    onOpenCustomer: fn(),
  },
  argTypes: {
    rows: { control: { type: 'number', min: 0, max: 60, step: 1 } },
    page: { control: { type: 'number', min: 1, max: 6, step: 1 } },
    pageSize: { control: 'select', options: [10, 25, 50] },
    status: { control: 'select', options: ['mixed', ...Object.values(InvoiceStatus)] },
    isLoading: { control: 'boolean' },
    hasError: { control: 'boolean' },
  },
  render: (args) => <InvoiceGridPlayground key={`${args.page}-${args.pageSize}`} {...args} />,
}

export const IntegrationMappings: Story = {
  args: {
    onInvoiceClick: fn(),
    integrationMappings: new Map([
      [
        invoiceFixtures[0]!.id,
        {
          state: 'ready',
          links: [
            {
              id: 'stripe',
              name: 'Stripe',
              providerType: 'stripe',
              mappingId: 'mapping',
              providerEntityId: 'in_external',
              createdAt: null,
              updatedAt: null,
            },
          ],
          retry: fn(),
        },
      ],
      [invoiceFixtures[1]!.id, { state: 'error', links: undefined, retry: fn() }],
    ]),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByLabelText('Stripe invoice ID in_external')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Retry integrations' }))
    await expect(args.integrationMappings!.get(invoiceFixtures[1]!.id)!.retry).toHaveBeenCalled()
    await expect(args.onInvoiceClick).not.toHaveBeenCalled()
  },
}
