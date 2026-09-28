import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { CreditGrantDialog } from './CreditGrantDialog'

/**
 * The add-credit-grant dialog. Recurring reveals a period; a duration expiry
 * reveals a length. A validated `CreateCreditGrant` comes out. Open by default.
 */
const meta = {
  title: 'Surfaces/CreditGrantDialog',
  component: CreditGrantDialog,
  parameters: { layout: 'fullscreen' },
  args: { open: true, onOpenChange: fn(), onSubmit: fn() },
} satisfies Meta<typeof CreditGrantDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** Credits must be a positive number. */
export const RequiresPositiveCredits: Story = {
  play: async ({ canvasElement, args }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await userEvent.click(await screen.findByRole('button', { name: /add credit grant/i }))
    await expect(await screen.findByText('Enter an amount')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

export const SubmitError: Story = {
  args: { submitError: 'Could not create the grant. Try again.' },
}
