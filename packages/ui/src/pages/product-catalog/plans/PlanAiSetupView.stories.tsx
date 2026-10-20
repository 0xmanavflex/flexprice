import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { type PricingSchema, normalisePricingSchema } from '@fp/domain'
import { PlanAiSetupView } from './PlanAiSetupView'

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
  applyStep?: string | null
  onParse?: () => void
  onApply?: () => void
  onDiscard?: () => void
  onCancel?: () => void
}) {
  const [description, setDescription] = useState(initialDescription)
  return (
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
      applyStep={rest.applyStep ?? null}
      onCancel={rest.onCancel ?? fn()}
    />
  )
}

const meta = {
  title: 'App/Product catalog/Plans/Create with AI',
  component: Harness,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Harness>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Nothing typed yet: sending does nothing but put the caret in the box, as the
 * ai-chat-5 composer does, and a starter chip offers an example to begin from.
 */
export const Empty: Story = {
  args: { onParse: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Create with AI' })).toBeVisible()
    const send = canvas.getByRole('button', { name: /read my pricing/i })
    await expect(send).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(send)
    await expect(args.onParse).not.toHaveBeenCalled()
    await expect(canvas.getByLabelText('Describe your pricing')).toHaveFocus()

    await userEvent.click(canvas.getByText('Per seat'))
    await userEvent.click(canvas.getByRole('button', { name: /use this example/i }))
    await expect(
      (canvas.getByLabelText('Describe your pricing') as HTMLTextAreaElement).value,
    ).toContain('per seat')
  },
}

export const Typed: Story = {
  // The spy has to be an arg, not a Harness default, for `args.onParse` to be it.
  args: { initialDescription: TYPED, onParse: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const read = canvas.getByRole('button', { name: /read my pricing/i })
    await expect(read).toBeEnabled()
    await userEvent.click(read)
    await expect(args.onParse).toHaveBeenCalled()
  },
}

export const Parsing: Story = {
  args: { initialDescription: TYPED, isParsing: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Reading your pricing')).toBeVisible()
    // The review must not be on screen while it is still being produced.
    await expect(canvas.queryByText('What this will create')).toBeNull()
  },
}

/**
 * The review. Nothing has been created at this point, which is the whole
 * reason this screen exists — a model reading a pricing page will sometimes
 * invent a tier, and the cost of finding out afterwards is a catalogue
 * someone unpicks by hand.
 */
export const Reviewing: Story = {
  args: { initialDescription: TYPED, schema: PARSED },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('What this will create')).toBeVisible()
    // The counts say how much is about to happen, before it happens.
    await expect(
      canvas.getByText('2 features · 1 plan · 2 prices · 2 entitlements · 1 credit grant'),
    ).toBeVisible()
    await expect(canvas.getByText('API Calls')).toBeVisible()
    await expect(canvas.getByText('Starter')).toBeVisible()
    await expect(canvas.getByText('Welcome credits')).toBeVisible()
    await expect(canvas.getByRole('button', { name: /create all of this/i })).toBeEnabled()
  },
}

/** A schema that cannot be created says why, and the create button is off. */
export const HasProblems: Story = {
  args: { initialDescription: 'Charge per minute.', schema: BROKEN },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('These have to be fixed first')).toBeVisible()
    await expect(canvas.getByText('"Minutes" sums usage but names no field to sum.')).toBeVisible()
    await expect(canvas.getByRole('button', { name: /create all of this/i })).toBeDisabled()
  },
}

export const Applying: Story = {
  args: {
    initialDescription: TYPED,
    schema: PARSED,
    isApplying: true,
    applyStep: 'Creating features',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Creating features…')).toBeVisible()
    await expect(canvas.getByRole('button', { name: /creating…/i })).toBeDisabled()
  },
}

/** A half-finished apply says what survived, rather than implying a clean failure. */
export const ApplyFailed: Story = {
  args: {
    initialDescription: TYPED,
    schema: PARSED,
    applyError:
      'Some of that could not be created. What was created is kept; read the pricing again to see what is left.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Some of that could not be created')).toBeVisible()
  },
}

export const ParseFailed: Story = {
  args: {
    initialDescription: 'asdf',
    parseError: 'Could not read that pricing. Try rewording it.',
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('That could not be read')).toBeVisible()
  },
}
