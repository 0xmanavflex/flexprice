import type { ComponentProps } from 'react'
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
  title: 'App/Product catalog/Plans/Plan form',
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
    trail: [{ label: 'Plans' }, { label: 'Plan details' }, { label: 'Edit' }],
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
    const lookupKey = canvas.getByLabelText('Lookup key')
    await userEvent.clear(lookupKey)
    await userEvent.type(lookupKey, 'Pro Plan')
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))

    await expect(
      await canvas.findByText('Use lowercase letters, numbers, hyphens and underscores'),
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

/** A staged item can be edited before the plan exists: the change replaces it, not adds a second. */
export const EditsAStagedCreditGrant: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole('textbox', { name: /^Name/ }), 'Pro')
    for (let i = 0; i < 3; i++) {
      await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    }
    await userEvent.click(await canvas.findByRole('button', { name: 'Add credit grant' }))
    await userEvent.type(canvas.getByRole('textbox', { name: /^Credits/ }), '100')
    await userEvent.click(canvas.getByRole('button', { name: 'Add credit grant' }))
    await expect(await canvas.findByText('100 credits')).toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: 'Edit Free credits' }))
    const credits = canvas.getByRole('textbox', { name: /^Credits/ })
    await expect(credits).toHaveValue('100')
    await userEvent.clear(credits)
    await userEvent.type(credits, '250')
    await userEvent.click(canvas.getByRole('button', { name: 'Save credit grant' }))
    await expect(await canvas.findByText('250 credits')).toBeInTheDocument()
    await expect(canvas.queryByText('100 credits')).toBeNull()

    await userEvent.click(canvas.getByRole('button', { name: 'Create plan' }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        creditGrants: [expect.objectContaining({ credits: '250' })],
      }),
    )
  },
}

/** The lookup key is filled from the name until the person types their own. */
export const LookupKeyFollowsName: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const field = canvas.getByRole('textbox', { name: /^lookup key/i })

    await userEvent.type(canvas.getByRole('textbox', { name: /^Name/ }), 'Acme Pro')
    await expect(field).toHaveValue('plan-acme-pro')

    await userEvent.clear(field)
    await userEvent.type(field, 'mine')
    await userEvent.type(canvas.getByRole('textbox', { name: /^Name/ }), ' Plus')
    await expect(field).toHaveValue('mine')
  },
}

type PlaygroundArgs = Omit<ComponentProps<typeof PlanForm>, 'defaultValue' | 'trail'> & {
  name: string
  lookupKey: string
  description: string
}

/** Switch create (stepped) and edit (details only); flip submitting or a server error. */
export const Playground: StoryObj<PlaygroundArgs> = {
  parameters: {
    controls: { exclude: /^(features|meters|priceUnits|step|on[A-Z].*)$/ },
  },
  args: {
    mode: 'create',
    planName: 'Pro',
    name: 'Pro',
    lookupKey: 'pro',
    description: 'For growing teams',
    isSubmitting: false,
    submitError: '',
  },
  argTypes: {
    mode: { control: 'inline-radio', options: ['create', 'edit'] },
    planName: { control: 'text', description: 'Shown in the edit title only.' },
    name: { control: 'text' },
    lookupKey: { control: 'text' },
    description: { control: 'text' },
    isSubmitting: { control: 'boolean' },
    submitError: { control: 'text', description: 'Empty means no server error.' },
  },
  render: ({ name, lookupKey, description, submitError, mode, planName, ...rest }) => (
    <PlanForm
      key={`${mode}|${name}|${lookupKey}|${description}`}
      {...rest}
      mode={mode}
      trail={
        mode === 'edit'
          ? [{ label: 'Plans' }, { label: 'Plan details' }, { label: 'Edit' }]
          : [{ label: 'Plans' }, { label: 'Create plan' }]
      }
      {...(mode === 'edit' && planName ? { planName } : {})}
      defaultValue={{ name, lookupKey, description }}
      submitError={submitError || null}
    />
  ),
}
