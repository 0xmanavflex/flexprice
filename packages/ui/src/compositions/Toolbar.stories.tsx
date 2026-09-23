import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Button } from '@ui/primitives/button'
import { Toolbar } from './Toolbar'

const meta = {
  title: 'Foundation/Compositions/Toolbar',
  component: Toolbar,
  parameters: { layout: 'padded' },
  args: {
    search: '',
    onSearchChange: fn(),
    searchPlaceholder: 'Search features…',
    actions: <Button size="sm">New feature</Button>,
  },
} satisfies Meta<typeof Toolbar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithActiveFilters: Story = {
  args: { search: 'api', activeFilterCount: 2, onClear: fn() },
  play: async ({ canvasElement }) => {
    // The count is in the accessible name, not only in a dimmed glyph.
    await expect(
      within(canvasElement).getByRole('button', { name: /clear filters.*2 active/i }),
    ).toBeInTheDocument()
  },
}

/** Controlled: it reports intent and renders what it is given. */
export const ReportsSearchUpward: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.type(within(canvasElement).getByRole('searchbox', { name: 'Search' }), 'api')
    await expect(args.onSearchChange).toHaveBeenCalled()
  },
}

/** A search landmark, reachable without tabbing through the page. */
export const IsASearchLandmark: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('search')).toBeInTheDocument()
  },
}
