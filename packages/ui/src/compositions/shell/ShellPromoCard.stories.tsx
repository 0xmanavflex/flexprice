import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ShellPromoCard } from './ShellPromoCard'

/**
 * The sidebar's promo card, at the width it renders in the rail's `pinned` slot.
 */
const meta = {
  title: 'Foundation/Compositions/Shell/ShellPromoCard',
  component: ShellPromoCard,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-56">
        <Story />
      </div>
    ),
  ],
  args: {
    title: 'Build with the API',
    description: 'Meter usage, price it however you sell, and invoice from one catalogue.',
  },
} satisfies Meta<typeof ShellPromoCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** With a call to action — the reason the card is there. */
export const WithCta: Story = {
  args: { cta: { label: 'Read the docs', onClick: fn() } },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Read the docs' }))
    await expect(args.cta!.onClick).toHaveBeenCalledOnce()
  },
}

/**
 * Dismissible: the close button removes the card. (With a `dismissKey` the
 * dismissal also persists to localStorage; here, without one, it just unmounts.)
 */
export const Dismissible: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('region', { name: 'Build with the API' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss' }))
    await expect(canvas.queryByRole('region', { name: 'Build with the API' })).not.toBeInTheDocument()
  },
}
