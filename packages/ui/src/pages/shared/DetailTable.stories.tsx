import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Button } from '@ui/components/primitives/button'
import { Section } from '@ui/compositions/layout/Section'
import { DetailTable, type DetailColumn } from './DetailTable'

interface Invoice {
  id: string
  number: string
  payment: 'Paid' | 'Overdue' | 'Unpaid'
  total: number
}

const INVOICES: Invoice[] = Array.from({ length: 14 }, (_, index) => ({
  id: `inv_${index + 1}`,
  number: `INV-2026-${String(1000 + index)}`,
  payment: (['Paid', 'Overdue', 'Unpaid'] as const)[index % 3]!,
  total: (index + 1) * 125,
}))

const COLUMNS: DetailColumn<Invoice>[] = [
  { key: 'number', header: 'Invoice', sortBy: (row) => row.number, cell: (row) => row.number },
  { key: 'payment', header: 'Payment', cell: (row) => row.payment },
  {
    key: 'total',
    header: 'Total',
    sortBy: (row) => row.total,
    cell: (row) => `$${row.total.toFixed(2)}`,
  },
]

/** `count` invoices, deterministic, cycling payment status and growing totals. */
function makeInvoices(count: number): Invoice[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `inv_${index + 1}`,
    number: `INV-2026-${String(1000 + index)}`,
    payment: (['Paid', 'Overdue', 'Unpaid'] as const)[index % 3]!,
    total: (index + 1) * 125,
  }))
}

const meta = {
  title: 'Building blocks/Tables & lists/DetailTable',
  component: DetailTable<Invoice>,
  args: {
    label: 'Invoices',
    noun: 'invoices',
    rows: INVOICES,
    columns: COLUMNS,
    facet: { label: 'Payment', value: (row: Invoice) => row.payment },
  },
  argTypes: {
    label: { control: 'text' },
    noun: { control: 'text' },
    pageSize: { control: { type: 'number', min: 1, max: 50, step: 1 } },
    compact: { control: 'boolean' },
    toolbar: { control: 'boolean' },
    rows: { control: false },
    columns: { control: false },
    facet: { control: false },
    facets: { control: false },
    getRowId: { control: false },
    action: { control: false },
    onRowClick: { control: false },
    searchText: { control: false },
    empty: { control: false },
    className: { control: false },
  },
} satisfies Meta<typeof DetailTable<Invoice>>

export default meta
type Story = StoryObj<typeof meta>

interface PlaygroundArgs {
  rowCount: number
  pageSize: number
  noun: string
  emptyMessage: string
  withFacet: boolean
  withAction: boolean
  clickableRows: boolean
  toolbar: boolean
  compact: boolean
  onRowClick: () => void
}

/** Drag rowCount from 0 (empty message) to 50 (several pages); search, filter, sort and paging all work. */
export const Playground = {
  args: {
    rowCount: 14,
    pageSize: 10,
    noun: 'invoices',
    emptyMessage: 'No invoices yet.',
    withFacet: true,
    withAction: true,
    clickableRows: false,
    toolbar: true,
    compact: false,
    onRowClick: fn(),
  },
  argTypes: {
    rowCount: { control: { type: 'range', min: 0, max: 50, step: 1 } },
    pageSize: { control: { type: 'number', min: 1, max: 50, step: 1 } },
    noun: { control: 'text' },
    emptyMessage: { control: 'text' },
    withFacet: { control: 'boolean' },
    withAction: { control: 'boolean' },
    clickableRows: { control: 'boolean' },
    toolbar: { control: 'boolean' },
    compact: { control: 'boolean' },
    onRowClick: { control: false },
  },
  parameters: {
    controls: {
      include: [
        'rowCount',
        'pageSize',
        'noun',
        'emptyMessage',
        'withFacet',
        'withAction',
        'clickableRows',
        'toolbar',
        'compact',
        'onRowClick',
      ],
    },
  },
  render: ({
    rowCount,
    pageSize,
    noun,
    emptyMessage,
    withFacet,
    withAction,
    clickableRows,
    toolbar,
    compact,
    onRowClick,
  }) => (
    <DetailTable<Invoice>
      label="Invoices"
      noun={noun}
      rows={makeInvoices(rowCount)}
      columns={COLUMNS}
      pageSize={pageSize}
      toolbar={toolbar}
      compact={compact}
      empty={emptyMessage}
      {...(withFacet ? { facet: { label: 'Payment', value: (row: Invoice) => row.payment } } : {})}
      {...(withAction
        ? {
            action: (
              <Button variant="outline" className="h-9 px-3">
                View all
              </Button>
            ),
          }
        : {})}
      {...(clickableRows ? { onRowClick } : {})}
    />
  ),
} satisfies StoryObj<PlaygroundArgs>

/** The list table inside a bordered panel: search, filter, sort, rows, paging. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('1 - 10 of 14 invoices')).toBeInTheDocument()
    await userEvent.type(canvas.getByLabelText('Search invoices'), '1013')
    await expect(canvas.getByText('1 - 1 of 1 invoices')).toBeInTheDocument()
  },
}

/** The action sits on the toolbar, to the right of the filter. */
export const WithAction: Story = {
  args: {
    action: (
      <Button variant="outline" className="h-9 px-3">
        View all
      </Button>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'View all' })).toBeVisible()
  },
}

export const Empty: Story = {
  args: { rows: [], empty: 'No invoices yet.' },
}

/** `border`: the same table with its own outline, for a table with no Section around it. */
export const Bordered: Story = {
  args: { border: true },
  play: async ({ canvasElement }) => {
    const frame = canvasElement.querySelector('[data-slot="entity-list-frame"]')
    await expect(frame).toHaveAttribute('data-border')
  },
}

/** Borderless (the default): the outline is the surrounding Section's job. */
export const Borderless: Story = {
  play: async ({ canvasElement }) => {
    const frame = canvasElement.querySelector('[data-slot="entity-list-frame"]')
    await expect(frame).not.toHaveAttribute('data-border')
  },
}

const LONG_NAME =
  'Enterprise platform fee for the EU region, including premium support and dedicated onboarding'

/** A value cut off with an ellipsis shows its full text on hover; one that fits does not. */
export const TruncatedTextOnHover: Story = {
  args: {
    rows: INVOICES.slice(0, 2).map((row, index) => ({
      ...row,
      number: index === 0 ? LONG_NAME : row.number,
    })),
    columns: [
      {
        key: 'number',
        header: 'Invoice',
        width: 160,
        cell: (row) => <span className="block truncate">{row.number}</span>,
      },
      { key: 'payment', header: 'Payment', cell: (row) => row.payment },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const long = canvas.getByText(LONG_NAME)
    await userEvent.hover(long)
    await expect(long).toHaveAttribute('title', LONG_NAME)

    const short = canvas.getByText('Paid')
    await userEvent.hover(short)
    await expect(short).not.toHaveAttribute('title')
  },
}

/**
 * In a titled Section the tools move into its header. A table longer than one
 * page keeps its pager, so the rows past the first page can still be reached.
 */
export const InSectionPaged: Story = {
  render: () => (
    <Section title="Credit grants" table flush>
      <DetailTable
        label="Credit grants"
        noun="invoices"
        rows={makeInvoices(7)}
        columns={COLUMNS}
        pageSize={5}
        compact
      />
    </Section>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('1 - 5 of 7 invoices')).toBeInTheDocument()
    await expect(canvas.queryByText('INV-2026-1005')).not.toBeInTheDocument()
  },
}

/** A titled table that fits on one page needs no footer. */
export const InSectionOnePage: Story = {
  render: () => (
    <Section title="Credit grants" table flush>
      <DetailTable
        label="Credit grants"
        noun="invoices"
        rows={makeInvoices(3)}
        columns={COLUMNS}
        pageSize={5}
        compact
      />
    </Section>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('INV-2026-1002')).toBeVisible()
    await expect(canvas.queryByText(/of 3 invoices/)).not.toBeInTheDocument()
  },
}
