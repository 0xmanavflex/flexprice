import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { PaymentLink } from './PaymentLink'

const URL = 'https://rzp.io/i/checkout_demo_8f2a91c4e7b6d3a05f19c2e84b7d6a13'

const meta = {
  title: 'Building blocks/Feedback & states/PaymentLink',
  component: PaymentLink,
  args: { url: URL },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PaymentLink>

export default meta
type Story = StoryObj<typeof meta>

/** A long provider URL on one line, with Copy beside it and Open in a new tab. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(URL)).toHaveAttribute('title', URL)
    await expect(canvas.getByRole('button', { name: 'Copy payment link' })).toBeInTheDocument()
    const link = canvas.getByRole('link', { name: 'Open payment link in a new tab' })
    await expect(link).toHaveAttribute('href', URL)
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
