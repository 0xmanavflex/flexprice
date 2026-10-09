import { useMemo, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { ReceiptIcon } from 'lucide-react'
import { DEFAULT_INVOICE_QUERY, InvoiceStatus, type InvoiceQuery } from '@fp/domain'
import { ListState, PageBody } from '@ui/compositions'
import { InvoiceGrid } from '@ui/pages/billing/invoices/InvoiceGrid'
import { manyInvoices } from '@ui/pages/billing/invoices/invoiceFixtures'
import { PAGE_STORY_PARAMETERS, PageShell, listFailure, paginate } from '../../shared/shellFixtures'

interface InvoicesListPageProps {
  /** How many invoices exist. 0 shows the empty state. */
  rows: number
  /** Status given to every invoice, or the fixtures' own mix. */
  status: 'mixed' | InvoiceStatus
  isLoading: boolean
  hasError: boolean
  /** The search the page opens with. */
  initialSearch: string
}

/** The invoices route as the console composes it: shell, PageBody, ListState, InvoiceGrid. */
function InvoicesListPage(props: InvoicesListPageProps) {
  return (
    <PageShell activeItemId="invoices" trail={['Billing', 'Invoices']}>
      <InvoicesListBody key={props.initialSearch} {...props} />
    </PageShell>
  )
}

function InvoicesListBody({
  rows,
  status,
  isLoading,
  hasError,
  initialSearch,
}: InvoicesListPageProps) {
  const [query, setQuery] = useState<InvoiceQuery>({
    ...DEFAULT_INVOICE_QUERY,
    search: initialSearch,
  })
  const all = useMemo(
    () =>
      manyInvoices(rows).map((invoice) => (status === 'mixed' ? invoice : { ...invoice, status })),
    [rows, status],
  )

  const needle = query.search.toLowerCase()
  const matches = all.filter(
    (invoice) =>
      (invoice.number.toLowerCase().includes(needle) ||
        invoice.customerName.toLowerCase().includes(needle)) &&
      (query.statuses.length === 0 || query.statuses.includes(invoice.status)),
  )
  const isFiltered = query.search.length > 0 || query.statuses.length > 0
  const clearFilters = () => setQuery({ ...query, search: '', statuses: [], page: 1 })

  return (
    <PageBody>
      <ListState
        isLoading={isLoading}
        error={listFailure(hasError, 'invoices')}
        isEmpty={matches.length === 0 && !isFiltered}
        isFiltered={isFiltered}
        onRetry={fn()}
        onClearFilters={clearFilters}
        emptyIcon={<ReceiptIcon aria-hidden />}
        emptyTitle="No invoices yet"
        emptyDescription="Invoices are produced when a contract's billing period closes. Create a plan and subscribe a customer, and the first one will appear here."
      >
        <InvoiceGrid
          invoices={paginate(matches, query.page, query.pageSize)}
          total={matches.length}
          query={query}
          onQueryChange={setQuery}
          onInvoiceClick={fn()}
          onOpenCustomer={fn()}
          onClearFilters={clearFilters}
          locale="en-US"
        />
      </ListState>
    </PageBody>
  )
}

const meta = {
  title: 'Pages/Billing/Invoices list',
  component: InvoicesListPage,
  tags: ['!autodocs'],
  parameters: PAGE_STORY_PARAMETERS,
  args: { rows: 12, status: 'mixed', isLoading: false, hasError: false, initialSearch: '' },
  argTypes: {
    rows: { control: { type: 'number', min: 0, max: 60, step: 1 } },
    status: { control: 'select', options: ['mixed', ...Object.values(InvoiceStatus)] },
    isLoading: { control: 'boolean' },
    hasError: { control: 'boolean' },
    initialSearch: { control: 'text' },
  },
} satisfies Meta<typeof InvoicesListPage>

export default meta
type Story = StoryObj<typeof meta>

/** `/invoices` with every control live: drag rows from 0 to 60, pick a status, flip loading and error. */
export const Playground: Story = {}

/** `/invoices` for an account that has not billed anyone yet. */
export const Empty: Story = {
  args: { rows: 0 },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('No invoices yet')).toBeInTheDocument()
  },
}

/** `/invoices` with a search that matches nothing. */
export const NoMatches: Story = {
  args: { initialSearch: 'zzz' },
}

/** `/invoices` while the first page is loading. */
export const Loading: Story = {
  args: { isLoading: true },
}

/** `/invoices` when the request failed. */
export const Failed: Story = {
  args: { hasError: true },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText('Flexprice had a problem loading invoices.'),
    ).toBeInTheDocument()
  },
}
