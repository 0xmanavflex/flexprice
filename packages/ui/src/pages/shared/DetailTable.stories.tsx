import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Button } from '@ui/components/primitives/button'
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

const meta = {
  title: 'Pages/Shared/DetailTable',
  component: DetailTable<Invoice>,
  args: {
    label: 'Invoices',
    noun: 'invoices',
    rows: INVOICES,
    columns: COLUMNS,
    facet: { label: 'Payment', value: (row: Invoice) => row.payment },
  },
} satisfies Meta<typeof DetailTable<Invoice>>

export default meta
type Story = StoryObj<typeof meta>

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
