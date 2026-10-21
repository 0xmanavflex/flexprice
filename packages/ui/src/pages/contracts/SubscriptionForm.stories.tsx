import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import {
  BillingPeriod,
  type CreateSubscription,
  CreditGrantCadence,
  CreditGrantExpiryType,
  PriceType,
  emptyPhase,
} from '@fp/domain'
import type { Option } from '@ui/compositions/forms/OptionSelect'
import {
  makeCharge,
  makeCharges,
  makeEntitlements,
} from '../product-catalog/plans/planDetailFixtures'
import {
  SubscriptionForm,
  type SubscriptionCustomerOption,
  type SubscriptionPlanContext,
} from './SubscriptionForm'

const STEPS = ['plan', 'phases', 'commitments', 'billing', 'review'] as const

const COUPONS: Option[] = [
  { value: 'cpn_launch', label: 'Launch 20%' },
  { value: 'cpn_loyal', label: 'Loyalty $50' },
]
const ADDONS: Option[] = [{ value: 'addon_support', label: 'Premium support' }]
const TAX_RATES = [{ code: 'GST18', name: 'GST', percentage: '18' }]
const PLAN_NAMES = ['Starter', 'Pro', 'Business', 'Scale', 'Enterprise']
const CUSTOMER_NAMES = [
  'Acme Robotics',
  'Globex',
  'Initech',
  'Umbrella',
  'Hooli',
  'Stark Industries',
]

const withName = (names: string[], index: number) =>
  `${names[index % names.length]}${index >= names.length ? ` ${index}` : ''}`

const makeCustomers = (count: number): SubscriptionCustomerOption[] =>
  Array.from({ length: count }, (_, i) => ({
    value: `cus_${i}`,
    label: withName(CUSTOMER_NAMES, i),
    hint: `cus_${i}`,
    externalId: `ext_${i}`,
  }))

const makePlans = (count: number): Option[] =>
  Array.from({ length: count }, (_, i) => ({
    value: `plan_${i}`,
    label: withName(PLAN_NAMES, i),
    hint: `plan_${withName(PLAN_NAMES, i).toLowerCase().replace(/\s+/g, '_')}`,
  }))

const PREFILLED: Partial<CreateSubscription> = {
  customerId: 'cus_0',
  planId: 'plan_1',
  currency: 'USD',
  billingPeriod: BillingPeriod.Monthly as CreateSubscription['billingPeriod'],
  billingPeriodCount: 1,
  trialPeriodDays: 14,
}

interface PlaygroundProps {
  step: (typeof STEPS)[number]
  prefilled: boolean
  customerLocked: boolean
  isSubmitting: boolean
  submitError: string
  customerCount: number
  planCount: number
  /** The chosen plan's charges, split between fixed and usage. */
  chargeCount: number
  entitlementCount: number
  /** The chosen plan's charges and entitlements are still loading. */
  planLoading: boolean
  /** Adds a quarterly and a weekly charge, which a monthly contract does not bill by default. */
  otherCadences?: boolean
  /** Gives the plan a credit grant of its own. */
  planGrant?: boolean
  /** Opens with this contract end date (`YYYY-MM-DD`). */
  endDate?: string
  onSubmit: (subscription: CreateSubscription) => void
  onCancel: () => void
  onStepChange: (step: string) => void
}

/** Stands in for the page: serves customers, plans and, once one is chosen, that plan's charges and entitlements. */
function SubscriptionFormPlayground({
  step: stepArg,
  prefilled,
  customerLocked,
  isSubmitting,
  submitError,
  customerCount,
  planCount,
  chargeCount,
  entitlementCount,
  planLoading,
  otherCadences = false,
  planGrant = false,
  endDate,
  onSubmit,
  onCancel,
  onStepChange,
}: PlaygroundProps) {
  const [step, setStep] = useState<string>(stepArg)
  const [planId, setPlanId] = useState<string>(prefilled ? (PREFILLED.planId ?? '') : '')
  useEffect(() => setStep(stepArg), [stepArg])

  const handlePlanChange = useCallback((next: string) => setPlanId(next), [])
  const handleStepChange = useCallback(
    (next: string) => {
      setStep(next)
      onStepChange(next)
    },
    [onStepChange],
  )

  const customers = useMemo(() => makeCustomers(customerCount), [customerCount])
  const plans = useMemo(() => makePlans(planCount), [planCount])
  const plan = useMemo<SubscriptionPlanContext | undefined>(() => {
    if (!planId) return undefined
    return {
      isLoading: planLoading,
      charges: planLoading
        ? []
        : [
            ...makeCharges(Math.ceil(chargeCount / 2), Math.floor(chargeCount / 2)),
            ...(otherCadences
              ? [
                  {
                    ...makeCharge(90, {
                      type: PriceType.Fixed,
                      billingPeriod: BillingPeriod.Quarterly,
                    }),
                    id: 'price_quarterly',
                    displayName: 'Quarterly review',
                  },
                  {
                    ...makeCharge(91, {
                      type: PriceType.Fixed,
                      billingPeriod: BillingPeriod.Weekly,
                    }),
                    id: 'price_weekly',
                    displayName: 'Weekly report',
                  },
                ]
              : []),
          ],
      entitlements: planLoading ? [] : makeEntitlements(entitlementCount),
      creditGrants: planGrant
        ? [
            {
              name: 'Welcome credits',
              credits: '500',
              cadence: CreditGrantCadence.OneTime,
              expirationType: CreditGrantExpiryType.Never,
              priority: 0,
            },
          ]
        : [],
    }
  }, [planId, planLoading, chargeCount, entitlementCount, otherCadences, planGrant])

  return (
    <SubscriptionForm
      // A fixed day, so the timeline and the first invoice read the same every run.
      today="2026-10-20"
      // A different seed is a different form, so react-hook-form's defaults reset.
      key={`${prefilled}-${customerLocked}`}
      {...(prefilled
        ? {
            defaultValue: endDate
              ? { ...PREFILLED, phases: [{ ...emptyPhase(), endDate }] }
              : PREFILLED,
          }
        : {})}
      customers={customers}
      plans={plans}
      plan={plan}
      onPlanChange={handlePlanChange}
      coupons={COUPONS}
      addons={ADDONS}
      taxRates={TAX_RATES}
      customerTaxes={[
        {
          taxRateCode: 'VAT20',
          name: 'VAT',
          percentage: '20',
          taxBehavior: 'exclusive',
          priority: 1,
          autoApply: true,
        },
      ]}
      customerLocked={customerLocked}
      isSubmitting={isSubmitting}
      submitError={submitError || null}
      trail={[{ label: 'Contracts' }, { label: 'Create contract' }]}
      step={step}
      onStepChange={handleStepChange}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  )
}

const withHeight: Decorator = (Story) => (
  <div className="flex h-[720px] flex-col">
    <Story />
  </div>
)

/** Start a contract in V1's order: customer & plan, phases (charges then discounts), commitments & benefits, billing, review. */
const meta = {
  title: 'App/Contracts/Contract form',
  component: SubscriptionFormPlayground,
  parameters: { layout: 'fullscreen' },
  decorators: [withHeight],
  args: {
    step: 'plan',
    prefilled: false,
    customerLocked: false,
    isSubmitting: false,
    submitError: '',
    customerCount: 6,
    planCount: 4,
    chargeCount: 4,
    entitlementCount: 5,
    planLoading: false,
    onSubmit: fn(),
    onCancel: fn(),
    onStepChange: fn(),
  },
  argTypes: {
    step: { control: 'select', options: STEPS },
    prefilled: { control: 'boolean' },
    customerLocked: { control: 'boolean' },
    isSubmitting: { control: 'boolean' },
    submitError: { control: 'text' },
    customerCount: { control: { type: 'number', min: 0, max: 50, step: 1 } },
    planCount: { control: { type: 'number', min: 0, max: 50, step: 1 } },
    chargeCount: { control: { type: 'number', min: 0, max: 20, step: 1 } },
    entitlementCount: { control: { type: 'number', min: 0, max: 30, step: 1 } },
    planLoading: { control: 'boolean' },
    onSubmit: { control: false },
    onCancel: { control: false },
    onStepChange: { control: false },
  },
} satisfies Meta<typeof SubscriptionFormPlayground>

export default meta
type Story = StoryObj<typeof meta>

/** Jump to any step, prefill the draft, lock the customer, resize the lists, or flip submitting and a server error. */
export const Playground: Story = {}

export const Create: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('combobox', { name: /^Customer/ })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Next' })).toBeVisible()
  },
}

/**
 * The first step opens as one question.
 *
 * Customer and plan are one step, but the plan half is withheld until there is
 * a customer — the step grows into itself rather than opening as a wall of
 * fields for a decision that has not been made yet.
 */
export const PlanAppearsAfterTheCustomer: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('combobox', { name: /^Customer/ })).toBeVisible()
    await expect(canvas.queryByText('Plan and billing')).toBeNull()

    await userEvent.click(canvas.getByRole('combobox', { name: /^Customer/ }))
    // The combobox portals its listbox, so the option is on `screen`, not in the canvas.
    await userEvent.click(await screen.findByRole('option', { name: /Acme Robotics/ }))

    await expect(await canvas.findByText('Plan and billing')).toBeVisible()
  },
}

/** Next is gated on the step's fields: no customer, no progress. */
export const CustomerIsRequired: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    await expect(await canvas.findByText('Choose a customer')).toBeVisible()
  },
}

/**
 * Opened from a customer's own page: the customer card is dropped, not the
 * step. The plan shows immediately, since the question it waits on is answered.
 */
export const CustomerLocked: Story = {
  args: { customerLocked: true, step: 'plan' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Plan and billing')).toBeVisible()
    await expect(canvas.queryByRole('combobox', { name: /^Customer/ })).toBeNull()
  },
}

export const Prefilled: Story = {
  args: { prefilled: true, step: 'plan' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('spinbutton', { name: /Free trial/ })).toHaveValue(14)
  },
}

/**
 * Bill on a date you choose: the third card opens a date picker, Next asks for
 * a date until there is one, and the draft carries it as the billing anchor.
 */
export const BillOnACustomDate: Story = {
  args: { prefilled: true, step: 'plan' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('radio', { name: /A date you choose/ }))
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    await expect(await canvas.findByText('Choose the billing date')).toBeVisible()
    await expect(args.onStepChange).not.toHaveBeenCalledWith('phases')

    // Any day after today, so it is on or after a contract that starts now.
    await userEvent.click(canvas.getByRole('button', { name: /Billing date/ }))
    await userEvent.click(await screen.findByRole('button', { name: /next month/i }))
    const days = await screen.findAllByRole('gridcell')
    await userEvent.click(within(days[15]!).getByRole('button'))
    await userEvent.keyboard('{Escape}')
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(args.onStepChange).toHaveBeenLastCalledWith('phases'))
  },
}

/** Back to the start date: the chosen date is dropped, so nothing anchors on it. */
export const BillOnLeavesTheDateBehind: Story = {
  args: { prefilled: true, step: 'plan' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('radio', { name: /A date you choose/ }))
    await expect(canvas.getByRole('button', { name: /Billing date/ })).toBeVisible()
    await userEvent.click(canvas.getByRole('radio', { name: /The contract start date/ }))
    await expect(canvas.queryByRole('button', { name: /Billing date/ })).toBeNull()
  },
}

/** Opens the first usage charge's commitment dialog from its row menu. */
async function openCommitment(canvas: ReturnType<typeof within>) {
  for (const menu of canvas.getAllByRole('button', { name: /^Actions for / })) {
    await userEvent.click(menu)
    const item = screen.queryByRole('menuitem', { name: 'Add commitment' })
    if (item) {
      await userEvent.click(item)
      return within(await screen.findByRole('dialog'))
    }
    await userEvent.keyboard('{Escape}')
  }
  throw new Error('No usage charge to commit on')
}

/** The phases step lists the plan's charges. A usage charge's commitment opens in a dialog. */
export const PhaseCharges: Story = {
  args: { prefilled: true, step: 'phases', chargeCount: 6 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Phase 1' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Charges' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Discounts' })).toBeVisible()
    await expect(canvas.getByText('No discounts on Phase 1.')).toBeVisible()
    await expect(canvas.getByRole('columnheader', { name: 'Quantity' })).toBeVisible()
    const dialog = await openCommitment(canvas)
    await expect(dialog.getByRole('heading', { name: 'Configure commitment' })).toBeVisible()
    await expect(dialog.getByText('True-up')).toBeVisible()
    await expect(dialog.getByLabelText(/^Overage factor/)).toHaveValue('1')
    // Per bucket waits for a bucket size.
    await expect(dialog.getByRole('switch', { name: /Apply to each bucket/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await expect(dialog.getByText('Set a bucket size above first.')).toBeVisible()
    await userEvent.click(dialog.getByRole('button', { name: 'Save commitment' }))
    await expect(await dialog.findByText('Enter a commitment greater than zero.')).toBeVisible()
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }))
    await expect(canvas.getByRole('button', { name: 'Add phase' })).toBeDisabled()
  },
}

/**
 * A usage charge commits to 10,000 units a month, per minute bucket, with one
 * business-hours window at its own price; the row and the review say so, and
 * the contract carries all of it.
 */
export const ConfiguresAChargeCommitment: Story = {
  args: { prefilled: true, step: 'phases', chargeCount: 6 },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const dialog = await openCommitment(canvas)
    await userEvent.click(dialog.getByRole('combobox', { name: /^Committed/ }))
    await userEvent.click(await screen.findByRole('option', { name: 'Usage (a number of units)' }))
    await userEvent.type(dialog.getByLabelText(/^Commitment \(units\)/), '10000')
    await userEvent.click(dialog.getByRole('combobox', { name: /^Commitment period/ }))
    await userEvent.click(await screen.findByRole('option', { name: 'Monthly' }))
    await userEvent.click(dialog.getByRole('combobox', { name: /^Bucket size/ }))
    await userEvent.click(await screen.findByRole('option', { name: 'Minute' }))
    await userEvent.click(dialog.getByRole('switch', { name: /Apply to each bucket/ }))
    await expect(dialog.getByText('No time windows yet.')).toBeVisible()
    await userEvent.click(dialog.getByRole('button', { name: 'Add window' }))
    const window1 = within(dialog.getByRole('region', { name: 'Window 1' }))
    await userEvent.type(window1.getByLabelText(/^Commitment \(units\)/), '500')
    await userEvent.clear(window1.getByLabelText(/^Price \(/))
    await userEvent.type(window1.getByLabelText(/^Price \(/), '0.05')
    await userEvent.click(dialog.getByRole('button', { name: 'Save commitment' }))

    await expect(
      await canvas.findByText('Commits 10,000 units monthly · per minute, 1 window'),
    ).toBeVisible()
    await expect(canvas.getByRole('button', { name: /^Commitment: edit on / })).toBeVisible()

    for (const step of ['commitments', 'billing', 'review']) {
      await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
      await expect(args.onStepChange).toHaveBeenLastCalledWith(step)
    }
    await expect(
      await canvas.findByText('Commits 10,000 units monthly · per minute, 1 window'),
    ).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Create contract' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          chargeCommitments: [
            expect.objectContaining({
              type: 'quantity',
              value: '10000',
              duration: 'MONTHLY',
              overageFactor: '1',
              bucketSize: 'MINUTE',
              windowed: true,
              windows: [
                expect.objectContaining({
                  value: '500',
                  price: '0.05',
                  start: '00:00',
                  end: '20:00',
                }),
              ],
            }),
          ],
        }),
      ),
    )
  },
}

/**
 * A monthly contract bills monthly and one-time charges. A quarterly charge
 * fits and can be opted in; a weekly one never bills here — and the phase's
 * charge list says only what will bill.
 */
export const ChargesAtOtherCadences: Story = {
  args: { prefilled: true, step: 'phases', chargeCount: 2, otherCadences: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Charges at other cadences')).toBeVisible()
    await expect(canvas.getByText(/Not billed on this contract: Weekly report/)).toBeVisible()
    // Not opted in: the phase does not list it as billed.
    await expect(canvas.queryByRole('button', { name: /Override Quarterly review/ })).toBeNull()
    await userEvent.click(canvas.getByRole('switch', { name: 'Also bill Quarterly review' }))
    await expect(
      await canvas.findByRole('button', { name: /Override Quarterly review/ }),
    ).toBeVisible()

    for (const step of ['commitments', 'billing', 'review']) {
      await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
      await expect(args.onStepChange).toHaveBeenLastCalledWith(step)
    }
    await userEvent.click(canvas.getByRole('button', { name: 'Create contract' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          includePriceIds: expect.arrayContaining(['price_quarterly']),
        }),
      ),
    )
  },
}

/** A fixed charge can be billed at another quantity — 25 seats — and the review says so. */
export const SetsAFixedChargeQuantity: Story = {
  args: { prefilled: true, step: 'phases', chargeCount: 2 },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const [quantity] = canvas.getAllByLabelText(/^Quantity of .* in Phase 1$/)
    await userEvent.type(quantity!, '25')
    for (const step of ['commitments', 'billing', 'review']) {
      await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
      await expect(args.onStepChange).toHaveBeenLastCalledWith(step)
    }
    await expect(await canvas.findByText(/Phase 1/)).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Create contract' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          phases: [
            expect.objectContaining({ quantities: [expect.objectContaining({ quantity: '25' })] }),
          ],
        }),
      ),
    )
  },
}

/**
 * The plan's credit grants open on the contract and can be removed for it
 * alone; the card then says they replace the plan's, and the draft says so.
 */
export const PlanCreditGrants: Story = {
  args: { prefilled: true, step: 'commitments', planGrant: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Welcome credits')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for Welcome credits' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Remove Welcome credits' }))
    await expect(
      await canvas.findByText("All of the plan's grants are removed from this contract."),
    ).toBeVisible()
    await expect(canvas.getByRole('button', { name: "Use the plan's grants" })).toBeVisible()
    for (const step of ['billing', 'review']) {
      await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
      await expect(args.onStepChange).toHaveBeenLastCalledWith(step)
    }
    await userEvent.click(canvas.getByRole('button', { name: 'Create contract' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ creditGrants: [], creditGrantsChanged: true }),
      ),
    )
  },
}

/** A charge for this contract alone is added to the phase with the running contract's own dialog. */
export const AddsAChargeForThisContract: Story = {
  args: { prefilled: true, step: 'phases', chargeCount: 2 },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Add a charge to Phase 1' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    const dialog = within(await screen.findByRole('dialog'))
    await userEvent.type(await dialog.findByLabelText('Display name'), 'Onboarding')
    await userEvent.type(dialog.getByLabelText(/^Amount/), '250')
    await userEvent.click(dialog.getByRole('button', { name: 'Add charge' }))
    await expect(await canvas.findByText('Onboarding')).toBeVisible()

    for (const step of ['commitments', 'billing', 'review']) {
      await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
      await expect(args.onStepChange).toHaveBeenLastCalledWith(step)
    }
    await expect(await canvas.findByText(/1 added/)).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Create contract' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          phases: [
            expect.objectContaining({
              extraCharges: [
                expect.objectContaining({
                  charge: expect.objectContaining({ displayName: 'Onboarding', amount: '250' }),
                }),
              ],
            }),
          ],
        }),
      ),
    )
  },
}

/** A contract that would end before it starts is stopped on the timeline step, where the end date is. */
export const EndDateCheckedOnTheTimeline: Story = {
  args: { prefilled: true, step: 'phases', endDate: '2000-01-01' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    await expect(
      await canvas.findByText('The contract starts today, so it must end after today'),
    ).toBeVisible()
    await expect(args.onStepChange).not.toHaveBeenCalledWith('commitments')
  },
}

export const PhaseNoCharges: Story = {
  args: { prefilled: true, step: 'phases', chargeCount: 0 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('This plan has no charges.')).toBeVisible()
  },
}
export const PhaseLoading: Story = {
  args: { prefilled: true, step: 'phases', planLoading: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/Loading the plan's charges/)).toBeVisible()
  },
}

/** A phase gets an end date, then a second phase starts where it ends, with its own discounts. */
export const AddsAPhaseWithItsOwnDiscount: Story = {
  args: { prefilled: true, step: 'phases', chargeCount: 2 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /^Ends/ }))
    const days = await screen.findAllByRole('gridcell')
    await userEvent.click(within(days[20]!).getByRole('button'))
    await userEvent.keyboard('{Escape}')
    await userEvent.click(canvas.getByRole('button', { name: 'Add phase' }))
    await expect(await canvas.findByRole('heading', { name: 'Phase 2' })).toBeVisible()
    // The phase just left is folded, so the form stays on the new one.
    await expect(canvas.queryByRole('combobox', { name: 'Coupon for Phase 1' })).toBeNull()
    await expect(canvas.getByRole('button', { name: /Phase 1/ })).toBeVisible()

    await userEvent.click(canvas.getByRole('button', { name: 'Add a coupon to Phase 2' }))
    await userEvent.click(canvas.getByRole('combobox', { name: 'Coupon for Phase 2' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Launch 20%' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Add discount' }))
    await expect(canvas.getByText('On all of Phase 2')).toBeVisible()
  },
}
/** Add-ons & benefits: add-ons, the contract's commitment, then entitlements, grants and taxes. */
export const CommitmentsStep: Story = {
  args: { prefilled: true, step: 'commitments', chargeCount: 4, entitlementCount: 12 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const title of [
      'Add-ons',
      'Contract commitment',
      'Entitlements',
      'Credit grants',
      'Taxes',
    ]) {
      await expect(await canvas.findByRole('heading', { name: title })).toBeVisible()
    }
    await expect(canvas.queryByText('Charge commitments')).toBeNull()
    // Period, overage, and true-up are visible before an amount is entered.
    await expect(canvas.getByText('Commitment period')).toBeVisible()
    await expect(canvas.getByText('True-up')).toBeVisible()
    // The customer's tax rate is applied for them.
    await expect(canvas.getByText('VAT · 20%')).toBeVisible()
    await expect(canvas.getByRole('columnheader', { name: 'Allowance' })).toBeVisible()
    await userEvent.type(canvas.getByLabelText(/^Commitment amount/), '1000')
  },
}

export const BillingStep: Story = {
  args: { prefilled: true, step: 'billing' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const title of ['Payment', 'Who pays', 'Other settings']) {
      await expect(canvas.getByRole('heading', { name: title })).toBeVisible()
    }
    for (const label of [
      'Payment terms',
      'Billing customer',
      'Inherited customers',
      'Prorate changes',
      'Auto-invoice threshold',
      'Create as draft',
    ]) {
      await expect(canvas.getByText(label, { exact: true })).toBeVisible()
    }
  },
}
/** Entitlements come from the plan, so with none chosen the step says so. */
export const PhasesNoPlan: Story = {
  args: { step: 'phases' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No plan chosen yet')).toBeVisible()
  },
}
/** The last step swaps Next for the submit, which hands the validated draft over. */
export const ReviewAndSubmit: Story = {
  args: { prefilled: true, step: 'review' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Create contract' }))
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalledOnce())
  },
}

export const Submitting: Story = {
  // While submitting every field is disabled, so the scrollable page body has nothing focusable.
  parameters: {
    a11y: { config: { rules: [{ id: 'scrollable-region-focusable', enabled: false }] } },
  },
  args: { prefilled: true, step: 'review', isSubmitting: true },
}

export const SubmitError: Story = {
  args: {
    prefilled: true,
    step: 'review',
    submitError: 'This customer already has an active subscription to that plan.',
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeInTheDocument()
  },
}

/**
 * The review is one card per step, each with its Edit, and closes on the
 * first invoice — the reference's summary, not a second copy of each step.
 */
export const ReviewByStep: Story = {
  args: { prefilled: true, step: 'review', chargeCount: 4, entitlementCount: 3 },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    for (const title of [
      'Customer & plan',
      'Phases & charges (1)',
      'Add-ons & benefits',
      'Billing',
    ]) {
      await expect(canvas.getByRole('heading', { name: title })).toBeVisible()
    }
    await expect(canvas.getByText('14 days')).toBeVisible()
    await expect(canvas.getByText(/^3, from the plan/)).toBeVisible()
    await expect(canvas.getByText('First invoice')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Edit billing' }))
    await expect(args.onStepChange).toHaveBeenLastCalledWith('billing')
  },
}
