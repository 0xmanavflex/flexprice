import type { Meta, StoryObj } from '@storybook/react-vite'
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

const meta = {
  title: 'Surfaces/FeatureForm',
  component: FeatureForm,
  parameters: { layout: 'padded' },
  args: { onSubmit: fn(), onCancel: fn() },
} satisfies Meta<typeof FeatureForm>

export default meta
type Story = StoryObj<typeof meta>

/** Opens metered, the type that needs the most explanation. */
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

/** Validation is the domain schema's, reached through the form. */
export const ValidationFromDomain: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: /create feature/i }))

    await expect(await canvas.findByText('Enter a name')).toBeInTheDocument()
    await expect(canvas.getByText('Enter the event name')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/**
 * The meter disappears when the type no longer has one.
 *
 * V1 keeps meter data in a separate state slice, so it survives a type switch
 * and can be submitted invisibly. Here it is not in the value at all.
 */
export const SwitchingTypeDropsTheMeter: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByLabelText('Event name')).toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: 'Boolean' }))
    await expect(canvas.queryByLabelText('Event name')).not.toBeInTheDocument()

    await userEvent.type(canvas.getByLabelText('Name'), 'SSO')
    await userEvent.click(canvas.getByRole('button', { name: /create feature/i }))

    await expect(args.onSubmit).toHaveBeenCalledWith({
      name: 'SSO',
      type: FeatureType.Boolean,
      lookupKey: '',
      description: '',
    })
  },
}

/** COUNT is the only aggregation with nothing per event to add up. */
export const CountHidesTheAggregationTarget: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.queryByLabelText('Event field')).not.toBeInTheDocument()

    await chooseOption('Aggregation', 'Sum of a field')
    await expect(await canvas.findByLabelText('Event field')).toBeInTheDocument()

    await chooseOption('Aggregation', 'Count of events')
    await expect(canvas.queryByLabelText('Event field')).not.toBeInTheDocument()
  },
}

/** The multiplier appears only for the aggregation that uses it. */
export const MultiplierOnlyForSumWithMultiplier: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.queryByLabelText('Multiplier')).not.toBeInTheDocument()

    await chooseOption('Aggregation', 'Sum, multiplied')

    await expect(await canvas.findByLabelText('Multiplier')).toBeInTheDocument()
  },
}

/**
 * A zero multiplier is rejected.
 *
 * V1 compares `multiplier <= 0` against a *string*, which is always false, so a
 * zero multiplier passes there and the feature silently bills nothing.
 */
export const ZeroMultiplierRejected: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByLabelText('Name'), 'Weighted tokens')
    await userEvent.type(canvas.getByLabelText('Event name'), 'llm_completion')
    await chooseOption('Aggregation', 'Sum, multiplied')
    await userEvent.type(await canvas.findByLabelText('Event field'), 'tokens')
    await userEvent.type(await canvas.findByLabelText('Multiplier'), '0')

    await userEvent.click(canvas.getByRole('button', { name: /create feature/i }))

    await expect(await canvas.findByText('Must be greater than zero')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** A valid metered feature submits a parsed domain value. */
export const SubmitsAValidatedDomainValue: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByLabelText('Name'), 'API calls')
    await userEvent.type(canvas.getByLabelText('Lookup key'), 'api_calls')
    await userEvent.type(canvas.getByLabelText('Event name'), 'api_call')

    await userEvent.click(canvas.getByRole('button', { name: /create feature/i }))

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
