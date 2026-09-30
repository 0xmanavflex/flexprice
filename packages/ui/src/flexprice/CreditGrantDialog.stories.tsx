import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { CreditGrantDialog } from './CreditGrantDialog'

/**
 * The credit-grant dialog. Create: recurring reveals a period, a duration expiry
 * reveals a length. Edit: only the name and end date change. Open by default.
 */
const meta = {
  title: 'Surfaces/CreditGrantDialog',
  component: CreditGrantDialog,
  parameters: {
    layout: 'fullscreen',
    a11y: {
      config: {
        rules: [
          { id: 'aria-hidden-focus', enabled: false },
          { id: 'color-contrast', enabled: false },
          { id: 'button-name', enabled: false },
        ],
      },
    },
  },
  args: { open: true, onOpenChange: fn(), onSubmit: fn() },
} satisfies Meta<typeof CreditGrantDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** Credits must be a positive number. */
export const RequiresPositiveCredits: Story = {
  play: async ({ canvasElement, args }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await userEvent.click(await screen.findByRole('button', { name: /create credit grant/i }))
    await expect(await screen.findByText('Enter an amount')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** A named grant with credits submits the validated value. */
export const SubmitsAGrant: Story = {
  play: async ({ canvasElement, args }) => {
    const screen = within(canvasElement.ownerDocument.body)
    const name = await screen.findByRole('textbox', { name: /^Name/ })
    await userEvent.clear(name)
    await userEvent.type(name, 'Welcome credits')
    await userEvent.type(screen.getByRole('textbox', { name: /^Credits/ }), '500')
    await userEvent.click(screen.getByRole('button', { name: /create credit grant/i }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Welcome credits', credits: '500' }),
    )
  },
}

export const Edit: Story = {
  args: { mode: 'edit', defaultValue: { name: 'Welcome credits' }, onEditSubmit: fn() },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('heading', { name: 'Edit credit grant' })).toBeInTheDocument()
    await expect(await screen.findByDisplayValue('Welcome credits')).toBeInTheDocument()
  },
}

export const SubmitError: Story = {
  args: { submitError: 'Could not create the grant. Try again.' },
}
