import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import { AggregationType, FeatureType, ResetUsage } from '@fp/domain'
import { FeatureForm } from './FeatureForm'

/**
 * The replacement for `AddFeature.tsx` — 1,106 lines and four state slices —
 * proved the same way everything else in this package is: fixtures in, props
 * out, no provider, no network.
 */
/**
 * Drives the ReUI Select, which is a combobox rather than a native `<select>`.
 *
 * `userEvent.selectOptions` only works on a real `<select>`, and the options
 * render in a portal outside the story root — so they are found on `screen`.
 */
async function chooseOption(label: string, optionName: string) {
  await userEvent.click(screen.getByRole('combobox', { name: label }))
  await userEvent.click(await screen.findByRole('option', { name: optionName }))
}

async function submit(canvas: ReturnType<typeof within>) {
  await userEvent.click(canvas.getByRole('button', { name: /create product/i }))
}

const trail: { label: string }[] = [{ label: 'Products' }, { label: 'Create product' }]

const withHeight: Decorator = (Story) => (
  <div className="flex h-[720px] flex-col">
    <Story />
  </div>
)

const meta = {
  title: 'Surfaces/FeatureForm',
  component: FeatureForm,
  parameters: { layout: 'fullscreen' },
  decorators: [withHeight],
  args: { mode: 'create', trail, onSubmit: fn(), onCancel: fn() },
} satisfies Meta<typeof FeatureForm>

export default meta
type Story = StoryObj<typeof meta>

/** Metered by default, with the preview rail beside it. */
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

/** The preview rail follows the draft as it is typed. */
export const PreviewFollowsTheDraft: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByLabelText(/^Name/), 'API calls')
    const rail = within(canvas.getByRole('complementary', { name: 'Product preview' }))
    await expect(rail.getByText('API calls')).toBeInTheDocument()
    await expect(rail.getByText('feat-api-calls')).toBeInTheDocument()
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

    await chooseOption('Aggregation', 'Sum')
    await expect(await canvas.findByLabelText(/^Event field/)).toBeInTheDocument()

    await chooseOption('Aggregation', 'Count of events')
    await expect(canvas.queryByLabelText(/^Event field/)).not.toBeInTheDocument()
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
    await userEvent.clear(canvas.getByLabelText(/^Lookup key/))
    await userEvent.type(canvas.getByLabelText(/^Lookup key/), 'api_calls')
    await userEvent.type(await canvas.findByLabelText(/^Event name/), 'api_call')
    await submit(canvas)

    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'API calls',
        lookupKey: 'api_calls',
        type: FeatureType.Metered,
        meter: expect.objectContaining({
          eventName: 'api_call',
          aggregationType: AggregationType.Count,
        }),
      }),
    )
  },
}

/** The lookup key follows the name until the person types a key of their own. */
export const LookupKeyFollowsName: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText(/^Name/), 'API calls')
    await expect(canvas.getByLabelText(/^Lookup key/)).toHaveValue('feat-api-calls')

    await userEvent.clear(canvas.getByLabelText(/^Lookup key/))
    await userEvent.type(canvas.getByLabelText(/^Lookup key/), 'mine')
    await userEvent.type(canvas.getByLabelText(/^Name/), ' more')
    await expect(canvas.getByLabelText(/^Lookup key/)).toHaveValue('mine')
  },
}
