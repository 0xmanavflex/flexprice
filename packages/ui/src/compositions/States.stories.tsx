import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Button } from '@ui/primitives/button'
import { ListState } from './States'

/**
 * Every state a list can be in, as stories — which is the point of designing
 * them once. A screen that uses `ListState` inherits all five, tested.
 */
const meta = {
  title: 'Foundation/Compositions/ListState',
  component: ListState,
  parameters: { layout: 'padded' },
  args: {
    isLoading: false,
    error: null,
    isEmpty: false,
    isFiltered: false,
    emptyTitle: 'No features yet',
    emptyDescription: 'Features describe what you meter and what customers are entitled to.',
    createAction: <Button size="sm">New feature</Button>,
    onRetry: fn(),
    onClearFilters: fn(),
    children: <div className="rounded-lg border p-6 text-sm">The list.</div>,
  },
} satisfies Meta<typeof ListState>

export default meta
type Story = StoryObj<typeof meta>

export const Content: Story = {}

/** A skeleton shaped like the result, not a page spinner. */
export const Loading: Story = {
  args: { isLoading: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Loading')).toBeInTheDocument()
  },
}

export const EmptyNoData: Story = {
  args: { isEmpty: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No features yet')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'New feature' })).toBeVisible()
  },
}

/**
 * A filter matched nothing — a different situation with a different offer.
 *
 * Showing "create your first feature" to someone who just typed a search is
 * the confusion this separation prevents.
 */
export const EmptyFiltered: Story = {
  args: { isEmpty: true, isFiltered: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Nothing matches these filters')).toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'New feature' })).not.toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: 'Clear filters' }))
    await expect(args.onClearFilters).toHaveBeenCalledOnce()
  },
}

export const ErrorRetryable: Story = {
  args: { error: { message: 'Could not reach Flexprice.', canRetry: true } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}

/**
 * Permission denied offers no retry.
 *
 * "Try again" on a permission error is worse than nothing — it invites someone
 * to keep pressing a button that will always fail.
 */
export const ErrorDenied: Story = {
  args: { error: { message: 'You do not have access to features here.', canRetry: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    await expect(canvas.getByText(/ask an administrator/i)).toBeInTheDocument()
  },
}

/** A failed refetch must not hide behind a skeleton. */
export const ErrorWinsOverLoading: Story = {
  args: { isLoading: true, error: { message: 'Something broke.', canRetry: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toBeInTheDocument()
    await expect(canvas.queryByText('Loading')).not.toBeInTheDocument()
  },
}
