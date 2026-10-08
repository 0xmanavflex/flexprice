import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { FeatureType } from '@fp/domain'
import { PlanForm } from './PlanForm'

/**
 * The plan create/edit page — same proof as every form here: fixtures in, a
 * validated `PlanFormValue` out, no provider, no network. Create is stepped
 * (details, then staged charges, entitlements and credit grants); edit is the
 * details step prepopulated.
 */
const withHeight: Decorator = (Story) => (
  <div className="flex h-[720px] flex-col">
    <Story />
  </div>
)

const meta = {
  title: 'Surfaces/PlanForm',
  component: PlanForm,
  parameters: { layout: 'fullscreen' },
  decorators: [withHeight],
  args: {
    mode: 'create',
    trail: [{ label: 'Plans' }, { label: 'Create plan' }],
    features: [{ id: 'feat_1', name: 'SSO', type: FeatureType.Boolean }],
    onSubmit: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof PlanForm>

export default meta
type Story = StoryObj<typeof meta>

export const Create: Story = {}

export const Edit: Story = {
  args: {
    mode: 'edit',
    planName: 'Pro',
    trail: [{ label: 'Plans' }, { label: 'Pro' }, { label: 'Edit' }],
    defaultValue: { name: 'Pro', lookupKey: 'pro', description: 'For growing teams' },
  },
}

export const Submitting: Story = {
  args: { isSubmitting: true, defaultValue: { name: 'Pro', lookupKey: 'pro', description: '' } },
}

export const SubmitError: Story = {
  args: {
    mode: 'edit',
    submitError: 'A plan with that lookup key already exists.',
    defaultValue: { name: 'Pro', lookupKey: 'pro', description: '' },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeInTheDocument()
  },
}

/** Only the name is required, and Next is gated on it. */
export const NameIsTheOnlyRequirement: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    await expect(await canvas.findByText('Enter a name')).toBeInTheDocument()

    await userEvent.type(canvas.getByRole('textbox', { name: /^Name/ }), 'Pro')
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    await expect(await canvas.findByRole('heading', { name: 'Charges' })).toBeInTheDocument()
  },
}

/** A malformed lookup key is rejected even though the field is optional. */
export const RejectsAMalformedLookupKey: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByRole('textbox', { name: /^Name/ }), 'Pro')
    await userEvent.type(canvas.getByLabelText('Lookup key'), 'Pro Plan')
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))

    await expect(
      await canvas.findByText('Use lowercase letters, numbers and underscores'),
    ).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** Every step is optional after the details; the last step creates the plan. */
export const CreatesWithDetailsOnly: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByRole('textbox', { name: /^Name/ }), 'Pro')
    for (let i = 0; i < 3; i++) {
      await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    }
    await userEvent.click(await canvas.findByRole('button', { name: 'Create plan' }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: expect.objectContaining({ name: 'Pro' }),
        charges: [],
        entitlements: [],
        creditGrants: [],
      }),
    )
  },
}
