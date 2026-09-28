import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Button } from '@ui/primitives/button'
import { GridToolbar } from './GridToolbar'

/**
 * The bar above a grid: borderless search on the left, controls on the right.
 * Controlled — the route owns the query, so the toolbar and grid cannot
 * disagree about what is shown.
 */
const meta = {
  title: 'Foundation/Compositions/GridToolbar',
  component: GridToolbar,
  parameters: { layout: 'padded' },
  args: {
    search: '',
    onSearchChange: fn(),
    placeholder: 'Search…',
    label: 'Search coupons',
    children: (
      <Button size="sm" variant="ghost">
        Filter
      </Button>
    ),
  },
} satisfies Meta<typeof GridToolbar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** A search landmark, reachable without tabbing through the page. */
export const IsASearchLandmark: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('search')).toBeInTheDocument()
  },
}

/** Controlled: it reports what was typed and renders what it is given. */
export const ReportsSearchUpward: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.type(
      within(canvasElement).getByRole('textbox', { name: 'Search coupons' }),
      'acme',
    )
    await expect(args.onSearchChange).toHaveBeenCalled()
  },
}

/**
 * The clear button exists only once there is something to clear.
 *
 * A permanent ✕ on an empty field is a control that does nothing most of the
 * time — and it is the one thing people misread as "close this".
 */
export const WithQueryClears: Story = {
  args: { search: 'acme' },
  play: async ({ canvasElement, args }) => {
    const clear = within(canvasElement).getByRole('button', { name: 'Clear search' })
    await userEvent.click(clear)
    await expect(args.onSearchChange).toHaveBeenCalledWith('')
  },
}
