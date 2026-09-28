import { useState } from 'react'
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

function GridFooterHarness(args: GridFooterProps) {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: args.pageSize })
  const table = useTable({
    features: dataGridFeatures,
    data,
    columns,
    manualPagination: true,
    rowCount: 64,
    state: { pagination },
    onPaginationChange: setPagination,
  } as never)

  return (
    <DataGrid table={table as never} recordCount={64}>
      <GridFooter {...args} pageSize={pagination.pageSize} />
    </DataGrid>
  )
}

const meta = {
  title: 'Foundation/Compositions/GridFooter',
  component: GridFooter,
  parameters: { layout: 'padded' },
  render: (args) => <GridFooterHarness {...args} />,
  args: {
    fitToWindow: false,
    onFitToWindowChange: fn(),
    pageSize: 25,
    noun: 'coupons',
  },
} satisfies Meta<typeof GridFooter>

export default meta
type Story = StoryObj<typeof meta>

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
