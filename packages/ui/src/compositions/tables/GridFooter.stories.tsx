import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { useTable } from '@tanstack/react-table'
import { DataGrid, dataGridFeatures } from '@ui/components/reui/data-grid/data-grid'
import type { GridFooterProps } from './GridFooter'
import { GridFooter } from './GridFooter'

/**
 * The bar below a grid: the fit-to-window toggle beside `DataGridPagination`,
 * which owns rows-per-page and the numbered pages. It reads the table instance
 * from context, so it is shown inside a real `DataGrid` here.
 */
interface Row {
  name: string
}

const data: Row[] = Array.from({ length: 25 }, (_, index) => ({ name: `Coupon ${index + 1}` }))
const columns = [{ id: 'name', accessorFn: (row: Row) => row.name, header: 'Name' }] as never

function GridFooterHarness({ total = 64, ...args }: GridFooterProps & { total?: number }) {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: args.pageSize })
  const [fit, setFit] = useState(args.fitToWindow)
  useEffect(() => setFit(args.fitToWindow), [args.fitToWindow])
  const table = useTable({
    features: dataGridFeatures,
    data,
    columns,
    manualPagination: true,
    rowCount: total,
    state: { pagination },
    onPaginationChange: setPagination,
  } as never)

  return (
    <DataGrid table={table as never} recordCount={total}>
      <GridFooter
        {...args}
        fitToWindow={fit}
        onFitToWindowChange={(next) => {
          setFit(next)
          args.onFitToWindowChange(next)
        }}
        pageSize={pagination.pageSize}
      />
    </DataGrid>
  )
}

const meta = {
  title: 'Building blocks/Tables & lists/GridFooter',
  component: GridFooter,
  parameters: { layout: 'padded' },
  render: (args) => <GridFooterHarness {...args} />,
  args: {
    fitToWindow: false,
    onFitToWindowChange: fn(),
    pageSize: 25,
    noun: 'coupons',
  },
  argTypes: {
    fitToWindow: { control: 'boolean' },
    pageSize: {
      control: 'select',
      options: [10, 25, 50, 100],
      description: 'Initial rows per page.',
    },
    noun: {
      control: 'text',
      description: 'Names the records in the range: "1 - 25 of 64 coupons".',
    },
    onFitToWindowChange: { control: false },
    children: { control: false },
  },
} satisfies Meta<typeof GridFooter>

export default meta
type Story = StoryObj<typeof meta>

/** Drag `total` from 0 to 500, change the page size and noun, and press Fit to window; pages and range follow. */
export const Playground: StoryObj<GridFooterProps & { total: number }> = {
  args: { fitToWindow: false, pageSize: 25, noun: 'coupons', total: 64, onFitToWindowChange: fn() },
  argTypes: {
    total: { control: { type: 'range', min: 0, max: 500, step: 1 } },
  },
  // `pageSize` seeds the table's own state, so remount when it is changed.
  render: (args) => <GridFooterHarness key={args.pageSize} {...args} />,
}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The one control the registry footer does not ship.
    await expect(canvas.getByRole('button', { name: 'Fit to window' })).toBeInTheDocument()
    // The range names the records, and agrees with the table above it.
    await expect(canvas.getByText('1 - 25 of 64 coupons')).toBeInTheDocument()
  },
}

/** Fitting is a pressed state, not a changed label. */
export const Fitting: Story = {
  args: { fitToWindow: true },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Fit to window' }),
    ).toHaveAttribute('aria-pressed', 'true')
  },
}
