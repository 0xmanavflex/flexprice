import type { ComponentProps } from 'react'
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import { type EditEntitlement, FeatureType } from '@fp/domain'
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
  title: 'App/Product catalog/Entitlements/Entitlement form',
  component: EntitlementCreateForm,
  parameters: { layout: 'padded' },
  decorators: [inSection],
  args: { features, onSubmit: fn(), onCancel: fn() },
  argTypes: {
    features: { control: false },
    isSubmitting: { control: 'boolean' },
    submitError: { control: 'text', description: 'Server-side failure; empty means none.' },
    submitLabel: { control: 'text' },
    usagePrice: {
      control: 'text',
      description: "The plan's usage price, shown in the billing note.",
    },
    onSubmit: { control: false },
    onCancel: { control: false },
  },
} satisfies Meta<typeof EntitlementCreateForm>

export default meta
type Story = StoryObj<typeof meta>

const editDefaults: Record<FeatureType, EditEntitlement> = {
  [FeatureType.Metered]: { usageLimit: 1000, isSoftLimit: false },
  [FeatureType.Boolean]: { isEnabled: true },
  [FeatureType.Static]: { staticValue: '25' },
  [FeatureType.Config]: { configValue: { days: 90 } },
}

/** Switch create/edit and the edited feature's type; flip submitting, a server error and the usage price. */
export const Playground: StoryObj<
  ComponentProps<typeof EntitlementCreateForm> & {
    mode: 'create' | 'edit'
    featureType: FeatureType
  }
> = {
  args: {
    mode: 'create',
    featureType: FeatureType.Metered,
    isSubmitting: false,
    submitError: '',
    submitLabel: '',
    usagePrice: '',
  },
  argTypes: {
    mode: { control: 'inline-radio', options: ['create', 'edit'] },
    featureType: {
      control: 'select',
      options: Object.values(FeatureType),
      description: 'Edit mode only: which feature is being edited.',
    },
  },
  render: ({ mode, featureType, submitError, submitLabel, usagePrice, ...args }) => {
    const shared = {
      ...(submitLabel ? { submitLabel } : {}),
      ...(usagePrice ? { usagePrice } : {}),
      submitError: submitError || null,
    }
    if (mode === 'edit') {
      const feature = features.find((f) => f.type === featureType) ?? features[0]!
      return (
        <EntitlementEditForm
          key={`edit-${featureType}`}
          feature={feature}
          defaultValue={editDefaults[featureType]}
          onSubmit={fn()}
          {...(args.onCancel ? { onCancel: args.onCancel } : {})}
          isSubmitting={args.isSubmitting ?? false}
          {...shared}
        />
      )
    }
    return <EntitlementCreateForm key="create" {...args} {...shared} />
  },
}

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

/** On a plan or add-on, a metered feature is granted as V1 grants it: a quota per window. */
export const GrantModel: Story = {
  args: { grantModel: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await chooseFeature(canvas, 'API calls')
    await expect(await screen.findByText('Usage resets')).toBeInTheDocument()
    const value = canvas.getByRole('textbox', { name: /^Value/ })
    await userEvent.type(value, '500')
    await userEvent.click(canvas.getByRole('button', { name: /create entitlement/i }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        featureId: 'feat_api',
        // Usage resets every billing period unless another window is chosen.
        grant: expect.objectContaining({ quota: '500', unit: 'subscription_period' }),
      }),
    )
  },
}

/** A grant with no value is rejected: a quota or Unlimited is required. */
export const GrantRequiresAValue: Story = {
  args: { grantModel: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await chooseFeature(canvas, 'API calls')
    await userEvent.click(canvas.getByRole('button', { name: /create entitlement/i }))
    await expect(await canvas.findByText('Enter a value above zero')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** An entitlement with grant config opens as a grant. */
export const EditGrant: Story = {
  render: () => (
    <EntitlementEditForm
      feature={features[0]!}
      defaultValue={{
        grant: {
          measure: 'quantity',
          quota: '2500',
          unit: 'week',
          allocation: 'first_usage',
          aggregation: 'additive',
        },
      }}
      onSubmit={fn()}
      onCancel={fn()}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByDisplayValue('2500')).toBeInTheDocument()
    await expect(canvas.getByText('2500 calls each week.')).toBeInTheDocument()
  },
}

export const SubmitError: Story = {
  args: { submitError: 'That feature is already entitled on this plan.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeInTheDocument()
  },
}
