import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { SubTabState, knownCount, truncationNote } from './SubTabState'

/**
 * The body of a detail page sub-tab. Rows win; with none, an error beats a
 * skeleton beats the contextual empty. A failed or loading sub-query can never
 * read as "none yet".
 */
const meta = {
  title: 'Building blocks/Detail pages/SubTabState',
  component: SubTabState,
  parameters: { layout: 'padded' },
  args: {
    hasData: false,
    isLoading: false,
    empty: { title: 'No payments yet', description: 'Payments appear once the invoice is paid.' },
    columns: 3,
    loadingLabel: 'Loading payments',
    children: <p>Payment rows</p>,
  },
} satisfies Meta<typeof SubTabState>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No payments yet')).toBeVisible()
  },
}

export const Loading: Story = {
  args: { isLoading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Loading payments')).toBeInTheDocument()
    await expect(canvas.queryByText('No payments yet')).toBeNull()
  },
}

export const SubTabError: Story = {
  args: { error: 'Could not load the payments.', errorKind: 'server', onRetry: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Could not load the payments.')).toBeVisible()
    await expect(canvas.queryByText('No payments yet')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: /try again/i }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}

/** An error with rows already on screen: the rows win and no error shows. */
export const RowsWinOverError: Story = {
  args: { hasData: true, error: 'Could not load the payments.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Payment rows')).toBeVisible()
    await expect(canvas.queryByText('Could not load the payments.')).toBeNull()
  },
}

/** A capped list says so; it does not pretend the rows are everything. */
export const Truncated: Story = {
  args: { hasData: true, truncation: truncationNote(50, 50) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/showing the latest 50/i)).toBeVisible()
  },
}

/** The count helpers: unknown while loading or failed, never a false zero. */
export const Counts: Story = {
  render: () => (
    <p>
      {String(knownCount(0, { isLoading: true }))}/
      {String(knownCount(0, { isLoading: false, error: 'x' }))}/
      {String(knownCount(0, { isLoading: false }))}/{String(truncationNote(3, 50))}
    </p>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('undefined/undefined/0/null')).toBeVisible()
  },
}
