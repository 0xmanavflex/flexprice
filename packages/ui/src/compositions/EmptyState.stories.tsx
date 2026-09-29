import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Button } from '@ui/primitives/button'
import { EmptyState, ListOfferProvider } from './EmptyState'

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

/**
 * The first-run offer takes the grid's empty body in place.
 *
 * A grid can only describe a filtered miss — from inside the table, "nothing
 * matched" and "nothing exists" are both zero rows. So the page publishes
 * which one it is, and the copy written for the filter gives way to the
 * invitation, in the same slot, under the same toolbar.
 */
export const FirstRunTakesTheSlot: Story = {
  args: {
    title: 'No features match these filters',
    size: 'inline',
    isFiltered: true,
    onClearFilters: <Button variant="outline">Clear filters</Button>,
  },
  decorators: [
    (Story) => (
      <ListOfferProvider
        value={{
          isFirstRun: true,
          title: 'No features yet',
          description: 'Features describe what you meter and what customers are entitled to.',
          action: <Button>New feature</Button>,
        }}
      >
        <Story />
      </ListOfferProvider>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No features yet')).toBeInTheDocument()
    await expect(canvas.queryByText(/match these filters/)).not.toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'New feature' })).toBeVisible()
    // The filter had nothing to do with this, so it is not offered as the fix.
    await expect(canvas.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
  },
}

/**
 * A filtered miss is still a filtered miss when the list has records.
 *
 * `isFirstRun` is false here, so the grid's own copy stands and the way out
 * is the one that caused it.
 */
export const FilteredMissKeepsItsCopy: Story = {
  args: {
    title: 'No features match these filters',
    size: 'inline',
    isFiltered: true,
    onClearFilters: <Button variant="outline">Clear filters</Button>,
  },
  decorators: [
    (Story) => (
      <ListOfferProvider
        value={{
          isFirstRun: false,
          title: 'No features yet',
          action: <Button>New feature</Button>,
        }}
      >
        <Story />
      </ListOfferProvider>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No features match these filters')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Clear filters' })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'New feature' })).not.toBeInTheDocument()
  },
}

/**
 * A page-sized empty state centres in the height it is given.
 *
 * Measured at 1920×1080 the block used to span y 221→323 with ~750px of blank
 * white under it, which reads as a table that failed to render rather than a
 * screen with nothing on it yet.
 */
export const PageSizedIsCentred: Story = {
  args: {
    description: 'Features describe what you meter and what customers are entitled to.',
    action: <Button>New feature</Button>,
  },
  decorators: [
    (Story) => (
      <div className="flex h-[32rem] flex-col border">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const block = canvas.getByRole('status')
    const parent = block.parentElement as HTMLElement

    // It takes the height it is offered rather than shrinking to its content,
    // which is what gives `justify-center` something to centre in.
    await expect(block.getBoundingClientRect().height).toBeGreaterThan(
      parent.getBoundingClientRect().height - 4,
    )

    // And the slack is shared: roughly as much room above the illustration as
    // below the button, instead of all of it in one blank band underneath.
    const blockBox = block.getBoundingClientRect()
    const header = block.querySelector('[data-slot="empty-header"]') as HTMLElement
    const above = header.getBoundingClientRect().top - blockBox.top
    const below =
      blockBox.bottom -
      canvas.getByRole('button', { name: 'New feature' }).getBoundingClientRect().bottom

    await expect(above).toBeGreaterThan(60)
    await expect(Math.abs(above - below)).toBeLessThan(24)
  },
}
