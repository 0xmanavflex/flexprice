import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import { InvoiceSortField, InvoiceStatus } from '@fp/domain'
import { InvoiceGrid, InvoiceGridProvenance } from './InvoiceGrid'
import { fixtureQuery, invoiceFixtures, manyInvoices } from './invoiceFixtures'

/**
 * The second proof, running the opposite way to the first.
 *
 *     SDK -> domain -> query -> page -> UI        (the app proof)
 *     fixture -> UI -> story -> test              (this one)
 *
 * The architectural assertion is in what this file does *not* import. There is
 * no `QueryClientProvider`, no `FlexpriceProvider`, no MSW handler and no
 * network — every state below is reached by passing props. If a story here ever
 * needed a data provider, that would be the smell telling us `@fp/ui` had
 * stopped being presentational.
 *
 * One story file, three artifacts: the visual workbench, a browser interaction
 * test, and an accessibility check. None of them can drift from the others,
 * because there is only one of them.
 */
const meta = {
  title: 'Surfaces/InvoiceGrid',
  component: InvoiceGrid,
  parameters: {
    layout: 'padded',
    docs: { description: { component: InvoiceGridProvenance.note } },
  },
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

/** The ordinary case: a page of invoices, mixed statuses. */
export const Default: Story = {}

/**
 * Populated, and checked for the things a screenshot would not catch.
 *
 * Money is asserted at full precision: `12345678901234567.89` is the value a
 * float would render as `...568.00`, so this is the regression test for the
 * whole reason `Money` exists.
 */
export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(await canvas.findByText('Acme Corp')).toBeInTheDocument()
    await expect(canvas.getByText('Overdue')).toBeInTheDocument()
    await expect(canvas.getByText('$12,345,678,901,234,567.89')).toBeInTheDocument()
    // A draft has no number, so the id stands in rather than a blank cell.
    await expect(canvas.getByText('inv_04')).toBeInTheDocument()
  },
}

export const Loading: Story = {
  args: { invoices: [], total: 0, isLoading: true },
}

export const Empty: Story = {
  args: { invoices: [], total: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/no invoices match these filters/i)).toBeInTheDocument()
  },
}

/**
 * The error state is a prop, not something provoked out of a server.
 *
 * The grid takes a string: it has no idea what an `ApiError` is. The page maps
 * `kind` to a sentence, which is what makes this state expressible here at all.
 */
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

/** A narrowed view, as it looks when arrived at from a filtered URL. */
export const Filtered: Story = {
  args: {
    invoices: invoiceFixtures.filter((invoice) => invoice.status === InvoiceStatus.Overdue),
    total: 1,
    query: { ...fixtureQuery, statuses: [InvoiceStatus.Overdue] },
  },
}

/**
 * The Sort menu reports intent in domain vocabulary, and changes nothing itself.
 *
 * The column carets now re-sort the loaded page client-side, so the *menu* is
 * what persists an ordering into the route. Its callback must carry
 * `sortBy: 'total'` — not `amount_due`, which is the API's name for it and
 * something this component must never learn. It must also reset to page 1:
 * staying on page 7 of a different ordering shows rows the user did not ask for
 * and cannot explain.
 */
export const SortInteraction: Story = {
  args: { query: { ...fixtureQuery, page: 7 } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    // The menu content portals to the body, so it is reached from `screen`.
    await userEvent.click(await canvas.findByRole('button', { name: /change sorting/i }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Total' }))

    await expect(args.onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: InvoiceSortField.Total, page: 1 }),
    )
  },
}

/**
 * Paging reports a page number, never an offset.
 *
 * `offset` is a transport detail that lives in `@fp/query`. If it ever appeared
 * in this callback, the boundary would have leaked.
 */
export const PaginationInteraction: Story = {
  args: {
    invoices: manyInvoices(25),
    total: 120,
    query: { ...fixtureQuery, page: 1, pageSize: 25 },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    const next = await canvas.findByRole('button', { name: /next|go to next page/i })
    await userEvent.click(next)

    await expect(args.onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, pageSize: 25 }),
    )

    // Stronger than "has no offset": what comes back has *exactly* the keys of
    // an InvoiceQuery. Nothing transport-shaped can ride along, so the day
    // somebody adds `offset` to this callback, this fails.
    const spy = args.onQueryChange as unknown as { mock: { calls: unknown[][] } }
    const reported = spy.mock.calls[0]?.[0] as Record<string, unknown>
    await expect(Object.keys(reported).sort()).toEqual(Object.keys(fixtureQuery).sort())
  },
}
