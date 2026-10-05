import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { InvoiceStatus } from '@fp/domain'
import { InvoiceGrid } from './InvoiceGrid'
import { fixtureQuery, invoiceFixtures, manyInvoices } from './invoiceFixtures'

/**
 * The invoice list on the shared table.
 *
 * The stories worth keeping are `DerivedStatusSaysSo` and `TwoStatuses`: the
 * first is the one honesty guarantee this screen makes that no other list
 * needs, and the second is the reason there are two status columns rather
 * than the one the redesign drew.
 */
const meta = {
  title: 'Surfaces/InvoiceGrid',
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

/**
 * The document's state and the money's state are different columns.
 *
 * INV-1041 is overdue with nothing collected; INV-1042 is paid and its
 * payment succeeded. A draft has no payment status at all and renders the em
 * dash rather than a blank, because a blank cell reads as a value that failed
 * to load.
 */
export const TwoStatuses: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(await canvas.findByText('INV-1041')).toBeInTheDocument()
    await expect(canvas.getByText('Overdue')).toBeInTheDocument()
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
    const index = headers.findIndex((th) => /total/i.test(th.textContent ?? ''))
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
    await expect(
      await canvas.findByText(/narrows the invoices already loaded, not the whole ledger/i),
    ).toBeInTheDocument()
  },
}

/** A stored status needs no caveat — the server did the filtering. */
export const StoredStatusIsSilent: Story = {
  args: { query: { ...fixtureQuery, statuses: [InvoiceStatus.Draft] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('INV-1041')
    await expect(canvas.queryByText(/narrows the invoices already loaded/i)).not.toBeInTheDocument()
  },
}

export const Loading: Story = { args: { invoices: [], total: 0, isLoading: true } }

/** A filter emptied the list — the toolbar survives, so it can be undone. */
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
    // not necessarily call[0]. Wait for — then read — the call that reported
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
