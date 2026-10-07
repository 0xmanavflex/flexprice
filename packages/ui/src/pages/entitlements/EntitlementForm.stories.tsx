import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import { FeatureType } from '@fp/domain'
import { EntitlementCreateForm, EntitlementEditForm } from './EntitlementForm'

/**
 * The entitlement form, as it renders inside a plan's Entitlements section (in
 * place) or a plan create step. Create picks a feature and shapes the form to
 * its type; edit opens on the entitlement's own fields.
 */
const features = [
  { id: 'feat_api', name: 'API calls', type: FeatureType.Metered, unit: 'calls' },
  { id: 'feat_sso', name: 'Single sign-on', type: FeatureType.Boolean },
  { id: 'feat_seats', name: 'Seats', type: FeatureType.Static },
  { id: 'feat_config', name: 'Retention window', type: FeatureType.Config },
]

const inSection: Decorator = (Story) => (
  <div className="bg-card max-w-2xl rounded-xl border p-5">
    <Story />
  </div>
)

const meta = {
  title: 'Surfaces/EntitlementForm',
  component: EntitlementCreateForm,
  parameters: { layout: 'padded' },
  decorators: [inSection],
  args: { features, onSubmit: fn(), onCancel: fn() },
} satisfies Meta<typeof EntitlementCreateForm>

export default meta
type Story = StoryObj<typeof meta>

export const Create: Story = {}

/** Picks a feature in the combobox, then waits for its portalled list to close. */
async function chooseFeature(canvas: ReturnType<typeof within>, name: string) {
  await userEvent.click(canvas.getByRole('combobox'))
  // An option also carries its unit hint, so match the start of its name.
  const option = new RegExp(`^${name}`)
  await userEvent.click(await screen.findByRole('option', { name: option }))
  await waitFor(() => expect(screen.queryByRole('option', { name: option })).toBeNull())
}

/** Choosing a metered feature reveals the limit and reset fields. */
export const MeteredRevealsLimit: Story = {
  play: async ({ canvasElement }) => {
    await chooseFeature(within(canvasElement), 'API calls')
    await expect(await screen.findByText('Value type')).toBeInTheDocument()
    await expect(await screen.findByText(/Customers get .* resetting/)).toBeInTheDocument()
  },
}

/** Submitting without a feature is rejected by the schema. */
export const RequiresAFeature: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /create entitlement/i }))
    await expect(await canvas.findByText('Choose a feature')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** A boolean feature submits its on/off flag. */
export const SubmitsABoolean: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await chooseFeature(canvas, 'Single sign-on')
    await userEvent.click(canvas.getByRole('button', { name: /create entitlement/i }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ featureId: 'feat_sso', isEnabled: true }),
    )
  },
}

export const EditMetered: Story = {
  render: () => (
    <EntitlementEditForm
      feature={features[0]!}
      defaultValue={{ usageLimit: 1000, isSoftLimit: false }}
      onSubmit={fn()}
      onCancel={fn()}
    />
  ),
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByDisplayValue('1000')).toBeInTheDocument()
  },
}

export const SubmitError: Story = {
  args: { submitError: 'That feature is already entitled on this plan.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeInTheDocument()
  },
}
