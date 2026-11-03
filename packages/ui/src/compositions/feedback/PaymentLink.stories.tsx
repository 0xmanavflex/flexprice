import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { PaymentLink } from './PaymentLink'

const URL = 'https://rzp.io/i/checkout_demo_8f2a91c4e7b6d3a05f19c2e84b7d6a13'

const meta = {
  title: 'Building blocks/Feedback & states/PaymentLink',
  component: PaymentLink,
  args: { url: URL },
} satisfies Meta<typeof PaymentLink>

export default meta
type Story = StoryObj<typeof meta>

/** A long provider URL wraps in its own box and opens in a new tab. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole('link', { name: URL })
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  },
}

/** No link: nothing renders. */
export const NoLink: Story = {
  args: { url: null },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('a')).toBeNull()
  },
}
