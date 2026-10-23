import type { ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import { BillingModel, type PriceOverride, TierMode } from '@fp/domain'
import { PriceOverrideForm } from './PriceOverrideForm'

/**
 * The form proof, run the same way as the grid: fixture -> UI -> story -> test.
 *
 * Again there is no provider here and no network. The pressure this applies is
 * different from the grid's, though: the question is whether RHF plus the
 * domain schema actually removes V1's state machine, or merely relocates it.
 * The interaction stories below are the evidence: switching billing model, the
 * tier rules, and a valid submit all behave without this component owning a
 * single piece of state.
 */
const meta = {
  title: 'App/Product catalog/Charges/Price override form',
  component: PriceOverrideForm,
  parameters: { layout: 'padded' },
  args: { priceId: 'price_01', onSubmit: fn(), onCancel: fn() },
  argTypes: {
    priceId: { control: 'text' },
    isSubmitting: { control: 'boolean' },
    submitError: { control: 'text', description: 'Server-side failure; empty means none.' },
    hideActions: { control: 'boolean' },
    formId: { control: 'text' },
    defaultValue: { control: false },
    onSubmit: { control: false },
    onCancel: { control: false },
    onStartedChange: { control: false },
  },
} satisfies Meta<typeof PriceOverrideForm>

export default meta
type Story = StoryObj<typeof meta>

const seeds: Record<string, PriceOverride | undefined> = {
  blank: undefined,
  flat: { priceId: 'price_01', billingModel: BillingModel.FlatFee, amount: '49.00' },
  package: {
    priceId: 'price_01',
    billingModel: BillingModel.Package,
    amount: '10.00',
    divideBy: 1000,
  },
  tiered: {
    priceId: 'price_01',
    billingModel: BillingModel.Tiered,
    tierMode: TierMode.Volume,
    tiers: [
      { upTo: 1000, unitAmount: '0.10' },
      { upTo: 10000, unitAmount: '0.08' },
      { upTo: null, unitAmount: '0.05' },
    ],
  },
}

/** Pick the starting model, then flip submitting, a server error and the hidden actions. */
export const Playground: StoryObj<ComponentProps<typeof PriceOverrideForm> & { seed: string }> = {
  args: { seed: 'blank', isSubmitting: false, submitError: '', hideActions: false },
  argTypes: { seed: { control: 'select', options: Object.keys(seeds) } },
  render: ({ seed, submitError, ...args }) => {
    const defaultValue = seeds[seed]
    return (
      <PriceOverrideForm
        key={seed}
        {...args}
        submitError={submitError || null}
        {...(defaultValue ? { defaultValue } : {})}
      />
    )
  },
}

/** Opens on a flat fee: the simplest model, and the most common. */
export const Default: Story = {}

export const FlatFee: Story = {
  args: {
    defaultValue: { priceId: 'price_01', billingModel: BillingModel.FlatFee, amount: '49.00' },
  },
}

export const Package: Story = {
  args: {
    defaultValue: {
      priceId: 'price_01',
      billingModel: BillingModel.Package,
      amount: '10.00',
      divideBy: 1000,
    },
  },
}

export const Tiered: Story = {
  args: {
    defaultValue: {
      priceId: 'price_01',
      billingModel: BillingModel.Tiered,
      tierMode: TierMode.Volume,
      tiers: [
        { upTo: 1000, unitAmount: '0.10' },
        { upTo: 10000, unitAmount: '0.08' },
        { upTo: null, unitAmount: '0.05' },
      ],
    },
  },
}

export const Submitting: Story = {
  args: {
    isSubmitting: true,
    defaultValue: { priceId: 'price_01', billingModel: BillingModel.FlatFee, amount: '49.00' },
  },
}

/** A server-side failure, already a sentence. The form never sees an ApiError. */
export const SubmitError: Story = {
  args: {
    submitError: 'This price belongs to a plan you cannot edit.',
    defaultValue: { priceId: 'price_01', billingModel: BillingModel.FlatFee, amount: '49.00' },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeInTheDocument()
  },
}

/**
 * Validation comes from the domain schema, not from the form.
 *
 * The message asserted here is the same string `priceOverride.test.ts` asserts
 * against the schema directly: one rule, one wording, whether it is reached
 * through this form or through an action.
 */
export const ValidationFromDomain: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: /save override/i }))

    await expect(await canvas.findByText('Enter an amount')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/**
 * Switching model replaces the value rather than merging it.
 *
 * This is the behaviour V1's twelve `useState`s get wrong: a tiers array left
 * over from a previous selection stays in scope and can be submitted
 * invisibly. Here the tier table is simply gone.
 */
export const SwitchingModelResets: Story = {
  args: {
    defaultValue: {
      priceId: 'price_01',
      billingModel: BillingModel.Tiered,
      tierMode: TierMode.Volume,
      tiers: [{ upTo: null, unitAmount: '0.05' }],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('table')).toBeInTheDocument()

    await userEvent.click(canvas.getByRole('radio', { name: /Flat fee/ }))

    await expect(canvas.queryByRole('table')).not.toBeInTheDocument()
    await expect(canvas.getByLabelText('Amount')).toHaveValue('')
  },
}

/**
 * The unbounded final band cannot be removed.
 *
 * Remove it and usage above the last ceiling is not billed: revenue lost
 * silently, which is why this is a disabled control rather than a validation
 * message after the fact.
 */
export const FinalTierIsProtected: Story = {
  args: {
    defaultValue: {
      priceId: 'price_01',
      billingModel: BillingModel.Tiered,
      tierMode: TierMode.Volume,
      tiers: [
        { upTo: 1000, unitAmount: '0.10' },
        { upTo: null, unitAmount: '0.05' },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('button', { name: 'Remove tier 1' })).toBeEnabled()
    await expect(canvas.getByRole('button', { name: 'Remove tier 2' })).toBeDisabled()
    // The open-ended band's ceiling is not editable either.
    await expect(canvas.getByLabelText('Tier 2 upper limit')).toBeDisabled()
  },
}

/** Tier bands must climb; the error lands on the offending row. */
export const OverlappingTiersRejected: Story = {
  args: {
    defaultValue: {
      priceId: 'price_01',
      billingModel: BillingModel.Tiered,
      tierMode: TierMode.Volume,
      tiers: [
        { upTo: 1000, unitAmount: '0.10' },
        { upTo: 500, unitAmount: '0.08' },
        { upTo: null, unitAmount: '0.05' },
      ],
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: /save override/i }))

    await expect(await canvas.findByText('Must be greater than 1000')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** A new band is inserted before the unbounded one, never after it. */
export const AddingATierKeepsTheOpenBandLast: Story = {
  args: {
    defaultValue: {
      priceId: 'price_01',
      billingModel: BillingModel.Tiered,
      tierMode: TierMode.Volume,
      tiers: [{ upTo: null, unitAmount: '0.05' }],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: /add tier/i }))

    // Two rows now, and it is still the last one that is open-ended.
    await expect(canvas.getByLabelText('Tier 1 upper limit')).toBeEnabled()
    await expect(canvas.getByLabelText('Tier 2 upper limit')).toBeDisabled()
  },
}

/**
 * A valid submit hands back a parsed domain value.
 *
 * `divideBy` arrives as a number and `amount` as an exact decimal string:
 * the form does the coercion so no caller has to, and nothing downstream has
 * to guess which fields are strings.
 */
export const SubmitsAValidatedDomainValue: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('radio', { name: /Package/ }))
    await userEvent.type(canvas.getByLabelText('Price per package'), '12.50')
    const units = canvas.getByLabelText('Units per package')
    await userEvent.clear(units)
    await userEvent.type(units, '1000')

    await userEvent.click(canvas.getByRole('button', { name: /save override/i }))

    await expect(args.onSubmit).toHaveBeenCalledWith({
      priceId: 'price_01',
      billingModel: BillingModel.Package,
      amount: '12.50',
      divideBy: 1000,
    })
  },
}

/** A usage charge on a SUM meter offers an optional bucket size, sent with the override. */
export const UsageBucketSize: Story = {
  args: { meter: { name: 'API calls', aggregationType: 'SUM' } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText(/^Amount/), '0.01')
    const bucket = canvas.getByRole('combobox', { name: /Bucket size/ })
    // Closed, the default reads as what it does, not as an empty picker.
    await expect(bucket).toHaveTextContent("The charge's own")
    await userEvent.click(bucket)
    await userEvent.click(await screen.findByRole('option', { name: 'Hour' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Save override' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ amount: '0.01', bucketSize: 'HOUR' }),
      ),
    )
  },
}

/** A COUNT meter cannot be windowed: the API refuses it, so no bucket is offered. */
export const UsageCountMeterNoBucket: Story = {
  args: { meter: { name: 'Seats', aggregationType: 'COUNT' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText('Bucket size')).toBeNull()
  },
}

/** A meter with its own bucket: shown locked, since the price may not set a second one. */
export const UsageMeterOwnsBucket: Story = {
  args: { meter: { name: 'GPU time', aggregationType: 'SUM', bucketSize: 'HOUR' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const bucket = canvas.getByLabelText(/Bucket size/)
    await expect(bucket).toBeDisabled()
    await expect(bucket).toHaveValue('Hour')
    await expect(canvas.queryByRole('combobox', { name: /Bucket size/ })).toBeNull()
  },
}

/** Replacing a package band's size keeps the rounding it came with. */
export const TieredPackageOverride: Story = {
  args: {
    defaultValue: {
      priceId: 'price_01',
      billingModel: BillingModel.Tiered,
      tierMode: TierMode.Slab,
      tiers: [
        { upTo: 1000, unitAmount: '0', flatAmount: '0' },
        {
          upTo: null,
          unitAmount: '1000',
          flatAmount: '0',
          transformQuantity: { divideBy: 100, round: 'down' },
        },
      ],
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const size = canvas.getByRole('textbox', { name: /tier 2 package size/i })
    await expect(size).toHaveValue('100')
    await userEvent.tripleClick(size)
    await userEvent.keyboard('200')

    await userEvent.click(canvas.getByRole('button', { name: /save override/i }))

    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        tiers: [
          expect.objectContaining({ upTo: 1000, unitAmount: '0' }),
          expect.objectContaining({ transformQuantity: { divideBy: 200, round: 'down' } }),
        ],
      }),
    )
  },
}
