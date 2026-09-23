import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Button } from '@ui/primitives/button'
import { EmptyState } from './EmptyState'

const meta = {
  title: 'Foundation/Compositions/EmptyState',
  component: EmptyState,
  parameters: { layout: 'padded' },
  args: { title: 'No features yet' },
} satisfies Meta<typeof EmptyState>

export default meta
type Story = StoryObj<typeof meta>

/** Nothing created yet: invite the first one. */
export const NothingYet: Story = {
  args: {
    description: 'Features describe what your customers are entitled to and what you meter.',
    action: <Button>New feature</Button>,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'New feature' })).toBeVisible()
  },
}

/**
 * A filter matched nothing: offer to clear it.
 *
 * Showing "create your first feature" to someone who just typed a search is the
 * confusion this separation prevents.
 */
export const NoResults: Story = {
  args: {
    title: 'No features match these filters',
    isFiltered: true,
    action: <Button>New feature</Button>,
    onClearFilters: <Button variant="outline">Clear filters</Button>,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Clear filters' })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'New feature' })).not.toBeInTheDocument()
  },
}

/** The change is announced, not only seen. */
export const IsAnnounced: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toBeInTheDocument()
  },
}
