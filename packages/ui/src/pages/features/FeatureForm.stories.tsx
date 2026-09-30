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

async function next(canvas: ReturnType<typeof within>) {
  await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
}

const trail: { label: string }[] = [{ label: 'Features' }, { label: 'Create feature' }]

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

/** Opens on the first step of a metered feature. */
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

export const Submitting: Story = {
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

/** Next is gated by the domain schema, and the message lands on the step the person is on. */
export const ValidationFromDomain: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await next(canvas)

    await expect(await canvas.findByText('Enter a name')).toBeInTheDocument()
    await expect(canvas.getByLabelText(/^Name/)).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** Values entered on one step survive Previous and Next. */
export const StepsKeepValues: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByLabelText(/^Name/), 'API calls')
    await next(canvas)
    await expect(await canvas.findByRole('combobox', { name: 'Type' })).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Previous' }))

    await expect(await canvas.findByLabelText(/^Name/)).toHaveValue('API calls')
  },
}

/**
 * The meter steps disappear when the type no longer has a meter.
 *
 * V1 keeps meter data in a separate state slice, so it survives a type switch
 * and can be submitted invisibly. Here it is not in the value at all.
 */
export const SwitchingTypeDropsTheMeter: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByLabelText(/^Name/), 'SSO')
    await next(canvas)
    await expect(await canvas.findByRole('button', { name: /Event/ })).toBeInTheDocument()

    await chooseOption('Type', 'Boolean')
    await expect(canvas.queryByRole('button', { name: /Aggregation/ })).not.toBeInTheDocument()

    await next(canvas)
    await userEvent.click(await canvas.findByRole('button', { name: /create feature/i }))

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

    await next(canvas)
    await next(canvas)
    await next(canvas)

    await expect(await canvas.findByRole('combobox', { name: 'Aggregation' })).toBeInTheDocument()
    await expect(canvas.queryByLabelText(/^Event field/)).not.toBeInTheDocument()

    await chooseOption('Aggregation', 'Sum of a field')
    await expect(await canvas.findByLabelText(/^Event field/)).toBeInTheDocument()

    await chooseOption('Aggregation', 'Count of events')
    await expect(canvas.queryByLabelText(/^Event field/)).not.toBeInTheDocument()
  },
}

/** A zero multiplier is rejected, on the step it belongs to. */
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

    await next(canvas)
    await next(canvas)
    await next(canvas)
    await next(canvas)

    await expect(await canvas.findByText('Must be greater than zero')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** A valid metered feature walks the steps and submits a parsed domain value. */
export const SubmitsAValidatedDomainValue: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByLabelText(/^Name/), 'API calls')
    await userEvent.clear(canvas.getByLabelText(/^Lookup key/))
    await userEvent.type(canvas.getByLabelText(/^Lookup key/), 'api_calls')
    await next(canvas)
    await next(canvas)
    await userEvent.type(await canvas.findByLabelText(/^Event name/), 'api_call')
    await next(canvas)
    await next(canvas)
    await userEvent.click(await canvas.findByRole('button', { name: /create feature/i }))

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
