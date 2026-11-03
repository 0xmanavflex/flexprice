import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import { AggregationType, FeatureType, ResetUsage, type CreateFeature } from '@fp/domain'
import { featureFixtures } from './featureFixtures'
import { FeatureForm } from './FeatureForm'

/**
 * The replacement for `AddFeature.tsx`: 1,106 lines and four state slices:
 * proved the same way everything else in this package is: fixtures in, props
 * out, no provider, no network.
 */
/**
 * Drives the ReUI Select, which is a combobox rather than a native `<select>`.
 *
 * `userEvent.selectOptions` only works on a real `<select>`, and the options
 * render in a portal outside the story root: so they are found on `screen`.
 */
async function chooseOption(label: string, optionName: string | RegExp) {
  await userEvent.click(screen.getByRole('combobox', { name: label }))
  await userEvent.click(await screen.findByRole('option', { name: optionName }))
}

async function submit(canvas: ReturnType<typeof within>) {
  await userEvent.click(canvas.getByRole('button', { name: /create feature/i }))
}

const trail: { label: string }[] = [{ label: 'Features' }, { label: 'Create feature' }]

const withHeight: Decorator = (Story) => (
  <div className="flex h-[720px] flex-col">
    <Story />
  </div>
)

const meta = {
  title: 'App/Product catalog/Features/Feature form',
  component: FeatureForm,
  parameters: { layout: 'fullscreen' },
  decorators: [withHeight],
  args: { mode: 'create', trail, onSubmit: fn(), onCancel: fn() },
  argTypes: {
    mode: { control: 'inline-radio', options: ['create', 'edit'] },
    isSubmitting: { control: 'boolean' },
    submitError: { control: 'text', description: 'Server-side failure; empty means none.' },
    groups: { control: false },
    trail: { control: false },
    defaultValue: { control: false },
    feature: { control: false },
    onSubmit: { control: false },
    onCancel: { control: false },
  },
} satisfies Meta<typeof FeatureForm>

export default meta
type Story = StoryObj<typeof meta>

const groups = [
  { value: 'grp_core', label: 'Core platform' },
  { value: 'grp_ai', label: 'AI usage' },
]

function createSeed(type: FeatureType): CreateFeature {
  if (type === FeatureType.Metered) {
    return {
      name: 'Tokens',
      lookupKey: 'tokens',
      type: FeatureType.Metered,
      meter: {
        eventName: 'llm_completion',
        aggregationType: AggregationType.Sum,
        field: 'tokens',
        resetUsage: ResetUsage.BillingPeriod,
      },
    }
  }
  if (type === FeatureType.Boolean) return { name: 'SSO', lookupKey: 'sso', type }
  return { name: 'Support tier', lookupKey: 'support-tier', type: FeatureType.Static }
}

const PLAYGROUND_TYPES = [FeatureType.Metered, FeatureType.Boolean, FeatureType.Static]

interface PlaygroundArgs {
  mode: 'create' | 'edit'
  type: FeatureType
  isSubmitting: boolean
  submitError: string
  showGroups: boolean
}

/** Switch create/edit and the feature type; flip submitting, a server error and the groups field. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    mode: 'create',
    type: FeatureType.Metered,
    isSubmitting: false,
    submitError: '',
    showGroups: true,
  },
  argTypes: {
    mode: { control: 'inline-radio', options: ['create', 'edit'] },
    type: { control: 'select', options: PLAYGROUND_TYPES },
    isSubmitting: { control: 'boolean' },
    submitError: { control: 'text' },
    showGroups: { control: 'boolean' },
  },
  parameters: {
    a11y: { config: { rules: [{ id: 'scrollable-region-focusable', enabled: false }] } },
  },
  render: ({ mode, type, isSubmitting, submitError, showGroups }) => {
    const shared = {
      trail: mode === 'edit' ? [{ label: 'Features' }, { label: 'Edit feature' }] : trail,
      isSubmitting,
      submitError: submitError || null,
      onCancel: fn(),
      ...(showGroups ? { groups } : {}),
    }
    if (mode === 'edit') {
      const feature = featureFixtures.find((f) => f.type === type) ?? featureFixtures[0]!
      return (
        <FeatureForm
          key={`edit-${feature.id}`}
          {...shared}
          mode="edit"
          feature={feature}
          onSubmit={fn()}
        />
      )
    }
    return (
      <FeatureForm
        key={`create-${type}`}
        {...shared}
        mode="create"
        defaultValue={createSeed(type)}
        onSubmit={fn()}
      />
    )
  },
}

/** Metered by default: Details, then Metering, centred with no preview rail. */
export const Default: Story = {}

export const Boolean: Story = {
  args: { defaultValue: { name: 'SSO', lookupKey: 'sso', type: FeatureType.Boolean } },
}

export const MeteredWithSum: Story = {
  args: {
    defaultValue: {
      name: 'Tokens',
      lookupKey: 'tokens',
      type: FeatureType.Metered,
      meter: {
        eventName: 'llm_completion',
        aggregationType: AggregationType.Sum,
        field: 'tokens',
        resetUsage: ResetUsage.BillingPeriod,
      },
    },
  },
}

/** Every field is disabled while saving, so the scroll region briefly has nothing focusable in it. */
export const Submitting: Story = {
  parameters: {
    a11y: { config: { rules: [{ id: 'scrollable-region-focusable', enabled: false }] } },
  },
  args: { isSubmitting: true, defaultValue: { name: 'SSO', type: FeatureType.Boolean } },
}

export const SubmitError: Story = {
  args: {
    submitError: 'A feature with that lookup key already exists.',
    defaultValue: { name: 'SSO', lookupKey: 'sso', type: FeatureType.Boolean },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeInTheDocument()
  },
}

/** Submitting is gated by the domain schema, and the message lands inline. */
export const ValidationFromDomain: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await submit(canvas)

    await expect(await canvas.findByText('Enter a name')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/**
 * Name, then event, then aggregation: the three a metered feature needs. Units
 * are optional and come last, folded, with one singular field each (the plural
 * follows it).
 */
export const DetailsThenMetering: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    const headings = canvas.getAllByRole('heading').map((h) => h.textContent?.trim())
    await expect(headings).toEqual(['Feature', 'Event', 'Aggregation'])
    const disclosures = canvas
      .getAllByRole('button', { expanded: false })
      .map((b) => b.textContent ?? '')
    await expect(disclosures.at(-1)).toMatch(/^Units/)
    await expect(canvas.queryByLabelText(/^Unit \(plural\)/)).not.toBeInTheDocument()
    await expect(canvas.queryByRole('complementary')).not.toBeInTheDocument()
    // No feature-level alerts on the form.
    await expect(canvas.queryByText(/usage alerts/i)).not.toBeInTheDocument()

    // Units are optional; a singular alone sends the plural that follows it.
    await userEvent.type(canvas.getByLabelText(/^Name/), 'Calls')
    await userEvent.type(canvas.getByLabelText(/^Event name/), 'api_call')
    await userEvent.type(canvas.getByLabelText(/^Event field/), 'count')
    await userEvent.click(canvas.getByRole('button', { name: /^Units/ }))
    await userEvent.type(await canvas.findByLabelText(/^Unit$/), 'call')
    await submit(canvas)
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ unitSingular: 'call', unitPlural: 'calls' }),
    )
  },
}

/** Units are optional: a metered feature saves without them. */
export const UnitsAreOptional: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText(/^Name/), 'Calls')
    await userEvent.type(canvas.getByLabelText(/^Event name/), 'api_call')
    await userEvent.type(canvas.getByLabelText(/^Event field/), 'count')
    await submit(canvas)
    // Blank (or absent), so the request leaves the units out.
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.not.objectContaining({ unitSingular: expect.stringMatching(/\S/) }),
    )
  },
}

/** A boolean is on or off: no unit, no reporting unit, and no second section. */
export const BooleanHasNoUnits: Story = {
  args: { defaultValue: { name: 'SSO', lookupKey: 'sso', type: FeatureType.Boolean } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.queryByLabelText(/^Unit/)).not.toBeInTheDocument()
    await expect(canvas.queryByLabelText(/^Reporting unit/)).not.toBeInTheDocument()
    await expect(canvas.queryByLabelText(/^Event name/)).not.toBeInTheDocument()
    // No metering cards for a feature that is not metered.
    for (const name of ['Event', 'Aggregation']) {
      await expect(canvas.queryByRole('heading', { name })).not.toBeInTheDocument()
    }
    await expect(canvas.queryByRole('button', { name: /^Units/ })).not.toBeInTheDocument()
  },
}

/** A static feature is a fixed quantity on the plan: nothing is counted, so no usage section or units. */
export const StaticHasNoUsage: Story = {
  args: {
    defaultValue: { name: 'Support tier', lookupKey: 'support-tier', type: FeatureType.Static },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.queryByRole('heading', { name: 'Usage' })).not.toBeInTheDocument()
    // No metering cards for a feature that is not metered.
    for (const name of ['Event', 'Aggregation']) {
      await expect(canvas.queryByRole('heading', { name })).not.toBeInTheDocument()
    }
    await expect(canvas.queryByRole('button', { name: /^Units/ })).not.toBeInTheDocument()
    await expect(canvas.queryByLabelText(/^Unit/)).not.toBeInTheDocument()
    await expect(canvas.queryByLabelText(/^Reporting unit/)).not.toBeInTheDocument()

    // Units belong to metered features, where usage is counted.
    await userEvent.click(canvas.getByRole('radio', { name: /Metered/ }))
    await expect(await canvas.findByRole('button', { name: /^Units/ })).toBeInTheDocument()
  },
}

/** Tags are the name for the groups a feature is filed under. */
export const TagField: Story = {
  args: {
    groups: [
      { value: 'grp_ai', label: 'AI' },
      { value: 'grp_core', label: 'Core' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The tag sits under Optional details, closed until asked for.
    await userEvent.click(canvas.getByRole('button', { name: /Optional details/ }))
    await expect(await canvas.findByRole('combobox', { name: 'Tag' })).toBeInTheDocument()
    await expect(canvas.queryByRole('combobox', { name: 'Group' })).not.toBeInTheDocument()
  },
}

/**
 * The meter fields disappear when the type no longer has a meter.
 *
 * V1 keeps meter data in a separate state slice, so it survives a type switch
 * and can be submitted invisibly. Here it is not in the value at all.
 */
export const SwitchingTypeDropsTheMeter: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByLabelText(/^Name/), 'SSO')
    await expect(canvas.getByRole('combobox', { name: 'Aggregation' })).toBeInTheDocument()

    await userEvent.click(canvas.getByRole('radio', { name: /Boolean/ }))
    await expect(canvas.queryByRole('combobox', { name: 'Aggregation' })).not.toBeInTheDocument()

    await submit(canvas)

    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'SSO', type: FeatureType.Boolean, lookupKey: 'feat-sso' }),
    )
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.not.objectContaining({ meter: expect.anything() }),
    )
  },
}

/** COUNT is the only aggregation with nothing per event to add up. */
export const CountHidesTheAggregationTarget: Story = {
  // The Aggregation select is still animating closed when the checks run, and
  // base-ui's open popup carries its own focus guards and an unnamed listbox.
  parameters: {
    a11y: {
      config: {
        rules: [
          { id: 'aria-hidden-focus', enabled: false },
          { id: 'aria-input-field-name', enabled: false },
        ],
      },
    },
  },
  args: {
    defaultValue: {
      name: 'Calls',
      lookupKey: 'calls',
      type: FeatureType.Metered,
      meter: {
        eventName: 'call',
        aggregationType: AggregationType.Count,
        resetUsage: ResetUsage.BillingPeriod,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(await canvas.findByRole('combobox', { name: 'Aggregation' })).toBeInTheDocument()
    await expect(canvas.queryByLabelText(/^Event field/)).not.toBeInTheDocument()

    await chooseOption('Aggregation', /^Sum$/)
    await expect(await canvas.findByLabelText(/^Event field/)).toBeInTheDocument()

    await chooseOption('Aggregation', /^Count$/)
    await expect(canvas.queryByLabelText(/^Event field/)).not.toBeInTheDocument()
  },
}

/**
 * Ticking "Use a custom expression" only turns the field into the expression
 * box: no examples block, just a faint placeholder expression.
 */
export const CustomExpressionPlaceholder: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const before = canvasElement.querySelectorAll('textarea, input').length
    await userEvent.click(await canvas.findByRole('checkbox', { name: 'Use a custom expression' }))
    const expression = await canvas.findByLabelText(/^Custom expression(?! docs)/)
    await expect(expression.tagName).toBe('TEXTAREA')
    await expect(expression).toHaveValue('')
    await expect(expression).toHaveAttribute('placeholder', 'duration_seconds / 60 / 100')
    // The field replaced the event field in place; nothing else appeared.
    await expect(canvasElement.querySelectorAll('textarea, input').length).toBe(before)
  },
}

/**
 * The aggregation inputs show a faint example where the label alone is not
 * enough; Count has no inputs at all.
 */
export const AggregationPlaceholders: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByLabelText(/^Event field/)).toHaveAttribute(
      'placeholder',
      'tokens',
    )

    await chooseOption('Aggregation', /^Sum with Multiplier$/)
    const multiplier = await canvas.findByLabelText(/^Multiplier/)
    await expect(multiplier).toHaveAttribute('type', 'number')
    await expect(multiplier).toHaveAttribute('placeholder', '0.001')

    await chooseOption('Aggregation', /^Max$/)
    await expect(await canvas.findByLabelText(/^Group by/)).toHaveAttribute('placeholder', 'region')

    await chooseOption('Aggregation', /^Count Unique$/)
    await expect(await canvas.findByLabelText(/^Event field/)).toHaveAttribute(
      'placeholder',
      'user_id',
    )

    await chooseOption('Aggregation', /^Count$/)
    await expect(canvas.queryByLabelText(/^Event field/)).not.toBeInTheDocument()
    await expect(canvas.queryByLabelText(/^Multiplier/)).not.toBeInTheDocument()
    await expect(canvas.queryByLabelText(/^Group by/)).not.toBeInTheDocument()
  },
}

/** A zero multiplier is rejected inline. */
export const ZeroMultiplierRejected: Story = {
  args: {
    defaultValue: {
      name: 'Weighted tokens',
      lookupKey: 'weighted',
      type: FeatureType.Metered,
      meter: {
        eventName: 'llm_completion',
        aggregationType: AggregationType.SumWithMultiplier,
        field: 'tokens',
        multiplier: '0',
        resetUsage: ResetUsage.BillingPeriod,
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await submit(canvas)

    await expect(await canvas.findByText('Must be greater than zero')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** A valid metered feature submits a parsed domain value. */
export const SubmitsAValidatedDomainValue: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByLabelText(/^Name/), 'API calls')
    await userEvent.click(canvas.getByRole('button', { name: /Optional details/ }))
    await userEvent.clear(canvas.getByLabelText(/^Lookup key/))
    await userEvent.type(canvas.getByLabelText(/^Lookup key/), 'api_calls')
    await userEvent.type(await canvas.findByLabelText(/^Event name/), 'api_call')
    await userEvent.type(canvas.getByLabelText(/^Event field/), 'calls')
    await submit(canvas)

    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'API calls',
        lookupKey: 'api_calls',
        type: FeatureType.Metered,
        meter: expect.objectContaining({
          eventName: 'api_call',
          aggregationType: AggregationType.Sum,
          field: 'calls',
        }),
      }),
    )
  },
}

/** The lookup key follows the name until the person types a key of their own. */
export const LookupKeyFollowsName: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /Optional details/ }))
    await userEvent.type(canvas.getByLabelText(/^Name/), 'API calls')
    await expect(canvas.getByLabelText(/^Lookup key/)).toHaveValue('feat-api-calls')

    await userEvent.clear(canvas.getByLabelText(/^Lookup key/))
    await userEvent.type(canvas.getByLabelText(/^Lookup key/), 'mine')
    await userEvent.type(canvas.getByLabelText(/^Name/), ' more')
    await expect(canvas.getByLabelText(/^Lookup key/)).toHaveValue('mine')
  },
}

/**
 * No tags yet: the field is still there, saying so.
 *
 * It used to be hidden when the environment had no groups, so the question
 * was never asked and the dropdown was reported as missing. An empty picker
 * is information; an absent one is not.
 */
export const NoTagsYet: Story = {
  args: { groups: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /Optional details/ }))
    await expect(canvas.getByText('Tag')).toBeVisible()
    await expect(canvas.getByText(/none exist yet/i)).toBeVisible()
    await expect(canvas.getByRole('combobox', { name: /tag/i })).toBeDisabled()
  },
}
