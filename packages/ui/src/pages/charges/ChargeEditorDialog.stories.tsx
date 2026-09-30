import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { BillingModel, BillingPeriod, type CreateCharge, InvoiceCadence, PriceType } from '@fp/domain'
import { ChargeEditorDialog } from './ChargeEditorDialog'

/**
 * The charge editor, as a large centred dialog carrying `ChargeForm`. The page
 * owns when it is open and what a submit does; a validated `CreateCharge` comes
 * out. Open by default so the surface is visible. No provider, no network.
 */
const meta = {
  title: 'Surfaces/ChargeEditorDialog',
  component: ChargeEditorDialog,
  parameters: {
    layout: 'fullscreen',
    a11y: {
      config: {
        rules: [
          { id: 'aria-hidden-focus', enabled: false },
          { id: 'color-contrast', enabled: false },
          { id: 'button-name', enabled: false },
          { id: 'aria-input-field-name', enabled: false },
        ],
      },
    },
  },
  args: { open: true, onOpenChange: fn(), mode: 'create', onSubmit: fn() },
} satisfies Meta<typeof ChargeEditorDialog>

export default meta
type Story = StoryObj<typeof meta>

const fixedFlatFee: CreateCharge = {
  type: PriceType.Fixed,
  billingModel: BillingModel.FlatFee,
  currency: 'USD',
  billingPeriod: BillingPeriod.Monthly,
  invoiceCadence: InvoiceCadence.Advance,
  amount: '29',
  displayName: 'Platform base',
}

export const Create: Story = {
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('heading', { name: 'Add charge' })).toBeInTheDocument()
  },
}

export const Edit: Story = {
  args: { mode: 'edit', defaultValue: fixedFlatFee },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('heading', { name: 'Edit charge' })).toBeInTheDocument()
    await expect(await screen.findByText(/creates a new version/i)).toBeInTheDocument()
  },
}

export const Submitting: Story = { args: { isSubmitting: true, defaultValue: fixedFlatFee } }

export const SubmitError: Story = {
  args: { submitError: 'Could not save the charge.', defaultValue: fixedFlatFee },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByText('Could not save the charge.')).toBeInTheDocument()
  },
}

/** An empty amount is rejected by the domain schema. */
export const ValidatesAmount: Story = {
  play: async ({ canvasElement, args }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await userEvent.click(await screen.findByRole('button', { name: /create charge/i }))
    await expect(await screen.findByText('Enter an amount')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** A filled-in flat fee submits the validated value. */
export const SubmitsAFlatFee: Story = {
  play: async ({ canvasElement, args }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await userEvent.type(await screen.findByRole('textbox', { name: /^Amount/ }), '49')
    await userEvent.click(screen.getByRole('button', { name: /create charge/i }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ billingModel: BillingModel.FlatFee, amount: '49' }),
    )
  },
}
