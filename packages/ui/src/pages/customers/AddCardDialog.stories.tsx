import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor } from 'storybook/test'
import { AddCardDialog } from './AddCardDialog'

const LINK = 'https://checkout.stripe.com/c/pay/cs_test_a1b2c3'

/** Save a card for a customer on a connected provider's hosted page. */
const meta = {
  title: 'App/Customers/Add card dialog',
  component: AddCardDialog,
  args: {
    open: true,
    onOpenChange: fn(),
    customerName: 'Acme Corp',
    providers: [{ providerType: 'stripe', name: 'Stripe' }],
    onCreateLink: fn(async () => LINK),
  },
} satisfies Meta<typeof AddCardDialog>

export default meta
type Story = StoryObj<typeof meta>

/** One provider connected: no choice to make, the link comes back to open or copy. */
export const CreatesTheSetupLink: Story = {
  play: async ({ args }) => {
    await userEvent.click(await screen.findByRole('button', { name: 'Create setup link' }))
    await waitFor(() =>
      expect(args.onCreateLink).toHaveBeenCalledWith({ provider: 'stripe', setDefault: true }),
    )
    await expect(await screen.findByRole('dialog')).toHaveTextContent(LINK)
    await expect(screen.getByRole('button', { name: 'Open Stripe page' })).toBeVisible()
  },
}

/** Stripe and Razorpay both connected: the reader picks where the card is saved. */
export const ChoosesAProvider: Story = {
  args: {
    providers: [
      { providerType: 'stripe', name: 'Stripe' },
      { providerType: 'razorpay', name: 'Razorpay' },
    ],
  },
  play: async () => {
    await expect(await screen.findByText('Payment provider')).toBeVisible()
  },
}

/** The provider refused: the reason is shown and the dialog stays open. */
export const ShowsTheFailure: Story = {
  args: {
    onCreateLink: fn(async () => {
      throw new Error('Stripe is not connected in this environment.')
    }),
  },
  play: async () => {
    await userEvent.click(await screen.findByRole('button', { name: 'Create setup link' }))
    await expect(await screen.findByRole('alert')).toHaveTextContent('not connected')
  },
}
