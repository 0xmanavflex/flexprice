import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { FeatureType } from '@fp/domain'
import { EntitlementDialog } from './EntitlementDialog'

/**
 * The entitlement dialog. Create picks a feature and shapes the form to its
 * type; edit opens on the entitlement's own fields. Open by default; no provider.
 */
const features = [
  { id: 'feat_api', name: 'API calls', type: FeatureType.Metered, unit: 'calls' },
  { id: 'feat_sso', name: 'Single sign-on', type: FeatureType.Boolean },
  { id: 'feat_seats', name: 'Seats', type: FeatureType.Static },
  { id: 'feat_config', name: 'Retention window', type: FeatureType.Config },
]

const meta = {
  title: 'Surfaces/EntitlementDialog',
  component: EntitlementDialog,
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
  args: { open: true, onOpenChange: fn(), mode: 'create', onSubmit: fn(), features },
} satisfies Meta<typeof EntitlementDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Create: Story = {
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('heading', { name: 'Add entitlement' })).toBeInTheDocument()
  },
}

/** Choosing a metered feature reveals the limit and reset fields. */
export const MeteredRevealsLimit: Story = {
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await userEvent.click(await screen.findByRole('combobox'))
    await userEvent.click(await screen.findByRole('option', { name: 'API calls' }))
    await expect(await screen.findByText('Unlimited — no cap on usage')).toBeInTheDocument()
  },
}

/** Submitting without a feature is rejected by the schema. */
export const RequiresAFeature: Story = {
  play: async ({ canvasElement, args }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await userEvent.click(await screen.findByRole('button', { name: /create entitlement/i }))
    await expect(await screen.findByText('Choose a feature')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** A boolean feature submits its on/off flag. */
export const SubmitsABoolean: Story = {
  play: async ({ canvasElement, args }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await userEvent.click(await screen.findByRole('combobox'))
    await userEvent.click(await screen.findByRole('option', { name: 'Single sign-on' }))
    await userEvent.click(await screen.findByRole('button', { name: /create entitlement/i }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ featureId: 'feat_sso', isEnabled: true }),
    )
  },
}

export const EditMetered: Story = {
  args: {
    mode: 'edit',
    editing: { feature: features[0]!, defaultValue: { usageLimit: 1000, isSoftLimit: false } },
    onEditSubmit: fn(),
  },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('heading', { name: 'Edit entitlement' })).toBeInTheDocument()
    await expect(await screen.findByDisplayValue('1000')).toBeInTheDocument()
  },
}

export const SubmitError: Story = {
  args: { submitError: 'That feature is already entitled on this plan.' },
}
