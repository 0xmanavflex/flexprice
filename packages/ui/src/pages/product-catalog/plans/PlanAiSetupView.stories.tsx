import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { type PricingSchema, normalisePricingSchema } from '@fp/domain'
import { type PlanAiCreateStep, PlanAiSetupView } from './PlanAiSetupView'

/** What the parser answers for the description in `TYPED`, normalised. */
const PARSED: PricingSchema = normalisePricingSchema({
  features: [
    {
      name: 'API Calls',
      key: 'api_calls',
      type: 'metered',
      unit_singular: 'call',
      unit_plural: 'calls',
      meter_event_name: 'api.calls',
      aggregation: 'count',
    },
    { name: 'Seats', key: 'seats', type: 'static', unit_singular: 'seat', unit_plural: 'seats' },
  ],
  plans: [
    {
      name: 'Starter',
      description: 'Entry tier, monthly',
      prices: [{ amount: 29, currency: 'USD', billing_period: 'monthly' }],
      entitlements: [
        { feature_key: 'api_calls', is_unlimited: false, value: 10000 },
        { feature_key: 'seats', is_unlimited: false, value: 3 },
      ],
      usage_charges: [{ feature_key: 'api_calls', amount_per_unit: 0.01, currency: 'USD' }],
    },
  ],
  credit_grants: [
    { plan_name: 'Starter', name: 'Welcome credits', credits: 5000, cadence: 'onetime' },
  ],
})

/** A schema the screen must refuse to create: a SUM feature with no field. */
const BROKEN: PricingSchema = normalisePricingSchema({
  features: [{ name: 'Minutes', key: 'minutes', type: 'metered', aggregation: 'sum' }],
  plans: [{ name: 'Basic', prices: [], entitlements: [] }],
})

const TYPED = 'Starter is $29 a month with 10,000 API calls, then a cent per call.'

/** Holds the description the way the page does, so typing works in a story. */
function Harness({
  initialDescription = '',
  ...rest
}: {
  initialDescription?: string
  schema?: PricingSchema | null
  isParsing?: boolean
  isApplying?: boolean
  parseError?: string | null
  applyError?: string | null
  createStep?: PlanAiCreateStep | null
  created?: boolean
  onParse?: (description: string, templateId?: string) => void
  onApply?: () => void
  onDiscard?: () => void
  onCancel?: () => void
}) {
  const [description, setDescription] = useState(initialDescription)
  return (
    <div className="flex h-svh flex-col">
      <PlanAiSetupView
        description={description}
        onDescriptionChange={setDescription}
        onParse={rest.onParse ?? fn()}
        isParsing={rest.isParsing ?? false}
        parseError={rest.parseError ?? null}
        schema={rest.schema ?? null}
        onDiscard={rest.onDiscard ?? fn()}
        onApply={rest.onApply ?? fn()}
        isApplying={rest.isApplying ?? false}
        applyError={rest.applyError ?? null}
        createStep={rest.createStep ?? null}
        created={rest.created ?? false}
        onCancel={rest.onCancel ?? fn()}
      />
    </div>
  )
}

const meta = {
  title: 'App/Product catalog/Plans/Create with AI',
  component: Harness,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Harness>

export default meta
type Story = StoryObj<typeof meta>

/** The prompt: "Set up your pricing", the composer, and five templates. */
export const Prompt: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Set up your pricing' })).toBeVisible()
    await expect(canvas.getByLabelText('Describe your pricing')).toBeVisible()
    for (const name of ['Railway', 'Cursor', 'Gemini', 'Apollo', 'Vapi']) {
      await expect(canvas.getByRole('radio', { name: new RegExp(name) })).toBeVisible()
    }
  },
}

/** A template fills the box and sits in it as a chip; clearing it empties the box. */
export const PickATemplate: Story = {
  args: { onParse: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('radio', { name: /Railway/ }))
    const box = canvas.getByLabelText('Describe your pricing') as HTMLTextAreaElement
    await expect(box.value).toContain("Railway's pricing")
    await expect(canvas.getByText('Railway template')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Generate pricing' }))
    // Sent as written, the template is named: its own schema is used, not the model.
    await expect(args.onParse).toHaveBeenCalledWith(
      expect.stringContaining("Railway's pricing"),
      'railway',
    )
  },
}

/** An edited template is a description of its own: it goes to the model, unnamed. */
export const EditedTemplateGoesToTheModel: Story = {
  args: { onParse: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('radio', { name: /Cursor/ }))
    await userEvent.type(canvas.getByLabelText('Describe your pricing'), ' Add a team plan.')
    await userEvent.click(canvas.getByRole('button', { name: 'Generate pricing' }))
    await expect(args.onParse).toHaveBeenLastCalledWith(expect.stringContaining('team plan'))
    await expect((args.onParse as ReturnType<typeof fn>).mock.lastCall).toHaveLength(1)
  },
}

/** An empty send generates from the example, as the reference does. */
export const EmptySendUsesTheExample: Story = {
  args: { onParse: fn() },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Generate pricing' }))
    await expect(args.onParse).toHaveBeenCalledWith(
      expect.stringContaining('free plan and a pro plan'),
    )
  },
}

/** Drafting: the review header, a skeleton, and the progress card. */
export const Drafting: Story = {
  args: { initialDescription: TYPED, isParsing: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Drafting your pricing')).toBeVisible()
    await expect(canvas.getByText('Reading the description')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Create all of this' })).toBeDisabled()
  },
}

/**
 * The review. Nothing has been created at this point, which is the whole
 * reason this screen exists: a model reading a pricing page will sometimes
 * invent a tier, and the cost of finding out afterwards is a catalogue
 * someone unpicks by hand.
 */
export const Reviewing: Story = {
  args: { initialDescription: TYPED, schema: PARSED, onApply: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Review your pricing' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Starter' })).toBeVisible()
    await expect(canvas.getByText('+ usage')).toBeVisible()
    await expect(canvas.getByText('5,000 credits once')).toBeVisible()
    await expect(canvas.getByText('Features and meters')).toBeVisible()
    await expect(canvas.getByText('api_calls')).toBeVisible()
    await expect(canvas.getByText('Credit grants')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Create all of this' }))
    await expect(args.onApply).toHaveBeenCalled()
  },
}

export const HasProblems: Story = {
  args: { initialDescription: TYPED, schema: BROKEN },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('These have to be fixed first')).toBeVisible()
    await expect(canvas.getByText('"Minutes" sums usage but names no field to sum.')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Create all of this' })).toBeDisabled()
  },
}

/** Creating: the canvas blurs under a card that follows the real write. */
export const Creating: Story = {
  args: { initialDescription: TYPED, schema: PARSED, isApplying: true, createStep: 'prices' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Creating your pricing')).toBeVisible()
    await expect(canvas.getByText('Adding prices')).toBeVisible()
    await expect(canvas.getByRole('button', { name: /creating…/i })).toBeDisabled()
  },
}

export const Created: Story = {
  args: { initialDescription: TYPED, schema: PARSED, created: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Your pricing has been created')).toBeVisible()
    await expect(canvas.getByText('2 features · 1 plan · 1 credit grant')).toBeVisible()
  },
}

export const ApplyFailed: Story = {
  args: {
    initialDescription: TYPED,
    schema: PARSED,
    applyError: 'The plan "Starter" already exists.',
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Some of that could not be created')).toBeVisible()
  },
}

export const ParseFailed: Story = {
  args: { initialDescription: TYPED, parseError: 'The description could not be read.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('That could not be read')).toBeVisible()
  },
}
