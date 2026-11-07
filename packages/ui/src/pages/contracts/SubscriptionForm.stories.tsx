import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import {
  BillingModel,
  BillingPeriod,
  type CreateSubscription,
  CreditGrantCadence,
  CreditGrantExpiryType,
  type Entitlement,
  FeatureType,
  EntitlementGrantDurationUnit,
  EntitlementGrantMeasure,
  UsageResetPeriod,
  InheritanceBlock,
  PriceType,
  type SubscriptionPhase,
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
  type SubscriptionAddonOption,
  type SubscriptionCouponOption,
  type SubscriptionCustomerOption,
  type SubscriptionParentOption,
  type SubscriptionPlanContext,
} from './SubscriptionForm'

const STEPS = ['plan', 'phases', 'commitments', 'billing', 'review'] as const

const COUPONS: SubscriptionCouponOption[] = [
  { value: 'cpn_launch', label: 'Launch', discount: '20%', code: 'LAUNCH20' },
  { value: 'cpn_loyal', label: 'Loyalty', discount: '$50', code: 'LOYAL50' },
]
const ADDONS: SubscriptionAddonOption[] = [
  { value: 'addon_support', label: 'Premium support', type: 'Fixed' },
  { value: 'addon_storage', label: 'Extra storage', type: 'Usage' },
]
const TAX_RATES = [{ code: 'GST18', name: 'GST', percentage: '18' }]
/** Extra storage's charges: a fixed base and a usage charge, each repriceable; the usage one can carry a commitment. */
const STORAGE_CHARGES = [
  {
    ...makeCharge(2, { type: PriceType.Usage, billingModel: BillingModel.FlatFee }),
    entityId: 'addon_storage',
    displayName: 'Storage (GB)',
  },
  // Quarterly: a monthly contract does not attach it, so it takes no commitment.
  {
    ...makeCharge(3, {
      type: PriceType.Usage,
      billingModel: BillingModel.FlatFee,
      billingPeriod: BillingPeriod.Quarterly,
    }),
    entityId: 'addon_storage',
    displayName: 'Storage archive (GB)',
  },
  {
    ...makeCharge(4, { type: PriceType.Fixed, billingModel: BillingModel.FlatFee }),
    entityId: 'addon_storage',
    displayName: 'Storage base',
  },
]
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
  /** Adds this many more quarterly charges, so the other-cadence list runs long. */
  extraCadences?: number
  /** Gives the plan a credit grant of its own. */
  planGrant?: boolean
  /** Opens with this contract end date (`YYYY-MM-DD`). */
  endDate?: string
  /** Gives the plan's first charge a free trial of this many days. */
  planTrial?: number
  /** Opens without the prefilled 14-day trial (a trialing contract takes no added charges). */
  noTrial?: boolean
  /** Opens with this contract start date (`YYYY-MM-DD`). */
  startDate?: string
  /** Opens with these changes on the contract's (single) phase. */
  phase?: Partial<SubscriptionPhase>
  /** The first customer's billing currency (lower-case), when it invoices in another. */
  billingCurrency?: string
  /** The global exchange rates; undefined leaves them unknown. */
  fxGlobalRates?: { fromCurrency: string; toCurrency: string; rate: string }[]
  /** The custom currencies and their factors; defaults to none. `null`: not loaded. */
  fxCustomCurrencies?: Record<string, Record<string, string>> | null
  /** With `fxCustomCurrencies: null`: the settings failed, rather than still loading. */
  fxSettingsFailed?: boolean
  /** Opens with this contract currency instead of USD. */
  currency?: string
  /** Changes to the plan's entitlements, by id (`ent_0`…). */
  entitlementPatch?: Record<string, Partial<Entitlement>>
  /** Gives the plan's first charge dates of its own (`YYYY-MM-DD`, from and to). */
  datedCharge?: { start: string; end?: string }
  /** Opens with these add-ons (and their commitments) already chosen. */
  seededAddons?: CreateSubscription['addons']
  /** Customers (by id) that cannot inherit, as the page loads them. */
  inheritanceBlocks?: Record<string, InheritanceBlock>
  /** Contracts the new one can sit under, as the page loads them. */
  parentContracts?: SubscriptionParentOption[]
  onSubmit: (subscription: CreateSubscription) => void
  onCancel: () => void
  onStepChange: (step: string) => void
}

/** Stands in for the page: serves customers, plans and, once one is chosen, that plan's charges and entitlements. */
function SubscriptionFormPlayground({
  step: stepArg,
  prefilled,
  noTrial = false,
  startDate,
  customerLocked,
  isSubmitting,
  submitError,
  customerCount,
  planCount,
  chargeCount,
  entitlementCount,
  planLoading,
  otherCadences = false,
  extraCadences = 0,
  planGrant = false,
  endDate,
  planTrial,
  phase,
  datedCharge,
  entitlementPatch,
  billingCurrency,
  fxGlobalRates,
  fxCustomCurrencies = {},
  fxSettingsFailed = false,
  currency,
  seededAddons,
  inheritanceBlocks,
  parentContracts,
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

  const customers = useMemo(
    () =>
      makeCustomers(customerCount).map((c, i) =>
        i === 0 && billingCurrency ? { ...c, billingCurrency } : c,
      ),
    [customerCount, billingCurrency],
  )
  const plans = useMemo(() => makePlans(planCount), [planCount])
  const plan = useMemo<SubscriptionPlanContext | undefined>(() => {
    if (!planId) return undefined
    return {
      isLoading: planLoading,
      charges: planLoading
        ? []
        : [
            ...makeCharges(
              Math.ceil(chargeCount / 2),
              Math.floor(chargeCount / 2),
              currency ? { currency: currency.toLowerCase() } : {},
            ).map((charge, index) => ({
              ...charge,
              ...(index === 0 && planTrial ? { trialPeriodDays: planTrial } : {}),
              ...(index === 0 && datedCharge
                ? {
                    startDate: new Date(`${datedCharge.start}T00:00:00Z`),
                    ...(datedCharge.end
                      ? { endDate: new Date(`${datedCharge.end}T00:00:00Z`) }
                      : {}),
                  }
                : {}),
            })),
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
            ...Array.from({ length: extraCadences }, (_, index) => ({
              ...makeCharge(100 + index, {
                type: PriceType.Fixed,
                billingPeriod: BillingPeriod.Quarterly,
              }),
              id: `price_extra_${index + 1}`,
              displayName: `Quarterly add-on ${index + 1}`,
            })),
          ],
      entitlements: planLoading
        ? []
        : makeEntitlements(entitlementCount).map((e) => ({ ...e, ...entitlementPatch?.[e.id] })),
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
  }, [
    planId,
    planLoading,
    chargeCount,
    entitlementCount,
    otherCadences,
    extraCadences,
    planGrant,
    planTrial,
    datedCharge,
    entitlementPatch,
    currency,
  ])

  return (
    <SubscriptionForm
      // A fixed day, so the timeline and the first invoice read the same every run.
      today="2026-10-20"
      // A different seed is a different form, so react-hook-form's defaults reset.
      key={`${prefilled}-${customerLocked}`}
      {...(prefilled
        ? {
            defaultValue: {
              ...PREFILLED,
              ...(noTrial ? { trialPeriodDays: 0 } : {}),
              ...(startDate ? { startDate } : {}),
              ...(currency ? { currency } : {}),
              ...(seededAddons ? { addons: seededAddons } : {}),
              ...(endDate || phase
                ? { phases: [{ ...emptyPhase(), endDate: endDate ?? '', ...phase }] }
                : {}),
            },
          }
        : {})}
      features={[{ id: 'feat_extra', name: 'Priority support', type: FeatureType.Boolean }]}
      customers={customers}
      {...(fxGlobalRates ? { fxGlobalRates } : {})}
      {...(fxCustomCurrencies ? { fxCustomCurrencies } : {})}
      fxSettingsFailed={fxSettingsFailed}
      plans={plans}
      plan={plan}
      onPlanChange={handlePlanChange}
      coupons={COUPONS}
      addons={ADDONS}
      addonCharges={(addonId) => (addonId === 'addon_storage' ? STORAGE_CHARGES : [])}
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
      {...(inheritanceBlocks ? { inheritanceBlocks } : {})}
      {...(parentContracts ? { parentContracts } : {})}
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

/** Start a contract: the contract, charges & add-ons, commitments & benefits, billing, review. */
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
 * a customer: the step grows into itself rather than opening as a wall of
 * fields for a decision that has not been made yet.
 */
export const PlanAppearsAfterTheCustomer: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('combobox', { name: /^Customer/ })).toBeVisible()
    await expect(canvas.queryByRole('heading', { name: 'Plan' })).toBeNull()

    await userEvent.click(canvas.getByRole('combobox', { name: /^Customer/ }))
    // The combobox portals its listbox, so the option is on `screen`, not in the canvas.
    await userEvent.click(await screen.findByRole('option', { name: /Acme Robotics/ }))

    await expect(await canvas.findByRole('heading', { name: 'Plan' })).toBeVisible()
    // What the plan fills in waits for a plan.
    await expect(canvas.queryByText('Billing period')).toBeNull()
    await expect(canvas.queryByRole('heading', { name: 'Dates and billing' })).toBeNull()
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
    await expect(canvas.getByRole('heading', { name: 'Plan' })).toBeVisible()
    await expect(canvas.queryByRole('combobox', { name: /^Customer/ })).toBeNull()
  },
}

/**
 * The plan fills in the free trial: choosing a plan whose charges carry a
 * trial sets it, and the note says when billing starts.
 */
export const PlanFillsInTheTrial: Story = {
  args: { planTrial: 30 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('combobox', { name: /^Customer/ }))
    await userEvent.click(await screen.findByRole('option', { name: /Acme Robotics/ }))
    await userEvent.click(await canvas.findByRole('combobox', { name: /^Plan/ }))
    await userEvent.click(await screen.findByRole('option', { name: /Pro/ }))
    await expect(await canvas.findByRole('heading', { name: 'Dates and billing' })).toBeVisible()
    await waitFor(() =>
      expect(canvas.getByRole('spinbutton', { name: /Free trial/ })).toHaveValue(30),
    )
    await expect(
      canvas.getByText('The trial ends and billing starts on Nov 19, 2026.'),
    ).toBeVisible()
  },
}

/** The contract's dates: an end date can be cleared back to running until cancelled. */
export const ClearsTheEndDate: Story = {
  args: { prefilled: true, step: 'plan', endDate: '2027-10-20' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /^Ends/ })).toHaveTextContent('Oct 20, 2027')
    await userEvent.click(canvas.getByRole('button', { name: 'Clear end date' }))
    await expect(canvas.getByRole('button', { name: /^Ends/ })).toHaveTextContent(
      'Runs until cancelled',
    )
    await expect(canvas.queryByRole('button', { name: 'Clear end date' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Save as draft' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ phases: [expect.objectContaining({ endDate: '' })] }),
      ),
    )
  },
}

export const Prefilled: Story = {
  args: { prefilled: true, step: 'plan' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('spinbutton', { name: /Free trial/ })).toHaveValue(14)
    await expect(
      canvas.getByText('The trial ends and billing starts on Nov 3, 2026.'),
    ).toBeVisible()
  },
}

/** Proration sits in Dates and billing, off until someone turns it on. */
export const ProrationIsOffUntilTurnedOn: Story = {
  args: { prefilled: true, step: 'plan' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const proration = canvas.getByRole('switch', { name: /^Proration/ })
    await expect(proration).not.toBeChecked()
    await userEvent.click(proration)
    await expect(proration).toBeChecked()
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
    await userEvent.click(canvas.getByRole('radio', { name: /Custom date/ }))
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
    await userEvent.click(canvas.getByRole('radio', { name: /Custom date/ }))
    await expect(canvas.getByRole('button', { name: /Billing date/ })).toBeVisible()
    await userEvent.click(canvas.getByRole('radio', { name: /Contract start date/ }))
    await expect(canvas.queryByRole('button', { name: /Billing date/ })).toBeNull()
  },
}

/** Opens the first usage charge's commitment dialog from its row menu. */
async function openCommitment(canvas: ReturnType<typeof within>) {
  for (const menu of canvas.getAllByRole('button', { name: /^More for / })) {
    await userEvent.click(menu)
    // Wait for the menu itself, so a slow render does not read as "no such item".
    const opened = await screen.findByRole('menu', {}, { timeout: 3000 })
    const item = within(opened).queryByRole('menuitem', { name: 'Add commitment' })
    if (item) {
      await userEvent.click(item)
      return within(await screen.findByRole('dialog', {}, { timeout: 3000 }))
    }
    await userEvent.keyboard('{Escape}')
  }
  throw new Error('No usage charge to commit on')
}

/** Whether the charges table scrolls sideways. */
const scrollsSideways = (canvasElement: HTMLElement) => {
  // The list table's scroller carries its minimum width.
  const scroller = canvasElement.querySelector<HTMLElement>('[style*="--table-min"]')
  if (!scroller) throw new Error('No table scroller')
  return scroller.scrollWidth > scroller.clientWidth + 1
}

/**
 * The charges table fits the wizard without scrolling sideways, and the price
 * stays on one line. A charge's own dates read under its name, not in a column.
 */
export const ChargesFitWithoutScrolling: Story = {
  args: {
    prefilled: true,
    step: 'phases',
    chargeCount: 6,
    datedCharge: { start: '2026-10-01', end: '2027-01-01' },
  },
  decorators: [
    // The room the console gives the wizard on a 1280px screen, beside its sidebar.
    (Story) => (
      <div className="w-[960px]">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/· Oct 1, 2026 → Jan 1, 2027$/)).toBeVisible()
    expect(canvas.queryByRole('columnheader', { name: 'In effect' })).toBeNull()
    // In effect on the contract's first day, so there is nothing to note.
    expect(canvas.queryByText(/outside the contract start/)).toBeNull()
    await waitFor(() => expect(scrollsSideways(canvasElement)).toBe(false))
  },
}

/**
 * A plan charge that starts after the contract does: one short note under the
 * table, and no extra column.
 */
export const ChargeOutsideContractStart: Story = {
  args: {
    prefilled: true,
    step: 'phases',
    chargeCount: 6,
    datedCharge: { start: '2026-11-01' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText(
        /^One charge sits outside the contract start \(Oct 20, 2026\): Platform base, from Nov 1, 2026\. It bills only while its own dates are in effect\.$/,
        {},
        { timeout: 5000 },
      ),
    ).toBeVisible()
    expect(canvas.queryByRole('columnheader', { name: 'In effect' })).toBeNull()
  },
}

/**
 * A contract of one phase lists the plan's charges in one Charges card, with
 * no phase chrome; proration is not here (it is a billing term, in Dates and
 * billing). A usage charge's commitment opens in a dialog.
 */
export const PhaseCharges: Story = {
  args: { prefilled: true, step: 'phases', chargeCount: 6 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('heading', { name: 'Phase 1' })).toBeNull()
    await expect(canvas.getByRole('heading', { name: 'Charges' })).toBeVisible()
    await expect(canvas.queryByRole('switch', { name: /^Proration/ })).toBeNull()
    await expect(canvas.getByRole('heading', { name: 'Add-ons' })).toBeVisible()
    await expect(canvas.getByRole('columnheader', { name: 'Quantity' })).toBeVisible()
    await expect(canvas.getByRole('columnheader', { name: 'Billing timing' })).toBeVisible()
    // Every charge runs with the phase, so there is no "In effect" column.
    await expect(canvas.queryByRole('columnheader', { name: 'In effect' })).toBeNull()
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
    // A second phase needs an explicit boundary first.
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
    // The review counts the charge among those this contract changes.
    await expect(await canvas.findByText(/· 1 changed from the plan$/)).toBeVisible()
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
 * fits and can be opted in; a weekly one never bills here: and the phase's
 * charge list says only what will bill.
 */
export const ChargesAtOtherCadences: Story = {
  args: { prefilled: true, step: 'phases', chargeCount: 2, otherCadences: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Charges at other cadences')).toBeVisible()
    await expect(canvas.getByText(/Not billed on this contract: Weekly report/)).toBeVisible()
    // Not opted in: the charges table does not list it as billed.
    await expect(canvas.queryByRole('button', { name: 'More for Quarterly review' })).toBeNull()
    await userEvent.click(canvas.getByRole('switch', { name: 'Also bill Quarterly review' }))
    await expect(
      await canvas.findByRole('button', { name: 'More for Quarterly review' }),
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

/**
 * A long other-cadence list shows five prices, below the charges, with the rest
 * behind "Show all"; the header's "Add all" opts every one in, "Clear all" none.
 */
export const ManyChargesAtOtherCadences: Story = {
  args: { prefilled: true, step: 'phases', chargeCount: 2, otherCadences: true, extraCadences: 6 },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const heading = canvas.getByRole('heading', { name: 'Charges at other cadences' })
    const card = within(heading.closest('section') as HTMLElement)
    // Below the charges, not above them.
    const charges = canvas.getByRole('heading', { name: 'Charges' })
    await expect(
      charges.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    await expect(card.getAllByRole('switch')).toHaveLength(5)
    await userEvent.click(card.getByRole('button', { name: 'Show all (7)' }))
    await expect(card.getAllByRole('switch')).toHaveLength(7)
    await userEvent.click(card.getByRole('button', { name: 'Show less' }))
    await expect(card.getAllByRole('switch')).toHaveLength(5)

    await userEvent.click(card.getByRole('button', { name: 'Add all' }))
    for (const toggle of card.getAllByRole('switch')) await expect(toggle).toBeChecked()
    await expect(
      await canvas.findByRole('button', { name: 'More for Quarterly add-on 6' }),
    ).toBeVisible()
    await userEvent.click(card.getByRole('button', { name: 'Clear all' }))
    for (const toggle of card.getAllByRole('switch')) await expect(toggle).not.toBeChecked()
    await userEvent.click(card.getByRole('button', { name: 'Add all' }))

    for (const step of ['commitments', 'billing', 'review']) {
      await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
      await expect(args.onStepChange).toHaveBeenLastCalledWith(step)
    }
    await userEvent.click(canvas.getByRole('button', { name: 'Create contract' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          includePriceIds: expect.arrayContaining(['price_quarterly', 'price_extra_6']),
        }),
      ),
    )
  },
}

/** A fixed charge can be billed at another quantity: 25 seats: and the review says so. */
export const SetsAFixedChargeQuantity: Story = {
  args: { prefilled: true, step: 'phases', chargeCount: 2 },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const [quantity] = canvas.getAllByLabelText(/^Quantity of /)
    // A fixed charge bills one until the contract says otherwise.
    await expect(quantity).toHaveValue('1')
    await userEvent.clear(quantity!)
    await userEvent.type(quantity!, '25')
    for (const step of ['commitments', 'billing', 'review']) {
      await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
      await expect(args.onStepChange).toHaveBeenLastCalledWith(step)
    }
    await expect(await canvas.findByText(/· 1 changed from the plan$/)).toBeVisible()
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
  args: { prefilled: true, noTrial: true, step: 'phases', chargeCount: 2 },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Add charge' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Add a charge' }))
    await expect(
      dialog.getByText("It bills on this contract only, on top of the plan's charges."),
    ).toBeVisible()
    await userEvent.click(dialog.getByRole('button', { name: 'Continue' }))
    await userEvent.type(await dialog.findByLabelText('Display name'), 'Onboarding')
    await userEvent.type(dialog.getByLabelText(/^Amount/), '250')
    await userEvent.click(dialog.getByRole('button', { name: 'Add charge' }))
    // Added charges lead the table, marked Added, and can be removed from their menu.
    await expect(await canvas.findByText('Onboarding')).toBeVisible()
    await expect(canvas.getByText('Added')).toBeVisible()
    const [firstRow] = canvas.getAllByRole('row').slice(1)
    await expect(firstRow).toHaveTextContent(/Onboarding/)
    await expect(canvas.getByText(/1 changed on this contract/)).toBeVisible()

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

/** A charge added on this contract can be reopened and changed; the change replaces it. */
export const EditsAChargeAddedToThisContract: Story = {
  args: { prefilled: true, noTrial: true, step: 'phases', chargeCount: 2 },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Add charge' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Add a charge' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Continue' }))
    await userEvent.type(await dialog.findByLabelText('Display name'), 'Onboarding')
    await userEvent.type(dialog.getByLabelText(/^Amount/), '250')
    await userEvent.click(dialog.getByRole('button', { name: 'Add charge' }))
    await expect(await canvas.findByText('Onboarding')).toBeVisible()

    await userEvent.click(canvas.getByRole('button', { name: 'More for Onboarding' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit charge' }))
    const edit = within(await screen.findByRole('dialog', { name: 'Edit charge' }))
    const amount = edit.getByLabelText(/^Amount/)
    await expect(amount).toHaveValue('250')
    await userEvent.clear(amount)
    await userEvent.type(amount, '300')
    await userEvent.click(edit.getByRole('button', { name: 'Save charge' }))

    for (const step of ['commitments', 'billing', 'review']) {
      await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
      await expect(args.onStepChange).toHaveBeenLastCalledWith(step)
    }
    await userEvent.click(canvas.getByRole('button', { name: 'Create contract' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          phases: [
            expect.objectContaining({
              extraCharges: [
                expect.objectContaining({
                  charge: expect.objectContaining({ displayName: 'Onboarding', amount: '300' }),
                }),
              ],
            }),
          ],
        }),
      ),
    )
  },
}

/** A contract that would end before it starts is stopped on the first step, where the end date is. */
export const EndDateCheckedOnTheFirstStep: Story = {
  args: { prefilled: true, step: 'plan', endDate: '2000-01-01' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    await expect(await canvas.findByText('The end has to come after the start')).toBeVisible()
    await expect(args.onStepChange).not.toHaveBeenCalledWith('phases')
  },
}

/**
 * The charges table as the reference has it: how many charges and how many
 * changed, search and filters, a fixed charge billing one by default and a
 * usage charge no quantity at all. Override price opens in a dialog; the row
 * then shows the new price over the plan's struck-through one and a "Price
 * changed" chip, and Reset to plan puts it back.
 */
export const OverridesAndResetsACharge: Story = {
  args: { prefilled: true, step: 'phases', chargeCount: 6 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByText(
        /^6 charges from the Pro plan\. Search for one to override its price, set a commitment or apply a coupon\.$/,
      ),
    ).toBeVisible()
    await expect(canvas.getByLabelText('Quantity of Platform base')).toHaveValue('1')
    await expect(canvas.queryByLabelText('Quantity of API calls')).toBeNull()
    await expect(canvas.queryByText('Pay as you go')).toBeNull()

    const search = canvas.getByPlaceholderText('Search charges…')
    await userEvent.type(search, 'Seat')
    await waitFor(() => expect(canvas.queryByText('Platform base')).toBeNull())
    await expect(canvas.getByText('Seat licence')).toBeVisible()
    await userEvent.clear(search)

    await userEvent.click(canvas.getByRole('button', { name: 'More for Platform base' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Override price' }))
    const dialog = within(
      await screen.findByRole('dialog', { name: 'Override price · Platform base' }),
    )
    // The dialog opens on the charge's own price.
    await userEvent.clear(dialog.getByLabelText(/^Amount/))
    await userEvent.type(dialog.getByLabelText(/^Amount/), '7')
    await userEvent.click(dialog.getByRole('button', { name: 'Save override' }))

    await expect(
      await canvas.findByRole('button', { name: 'Price changed: edit on Platform base' }),
    ).toBeVisible()
    await expect(canvas.getByText('$9.00')).toHaveClass('line-through')
    await expect(canvas.getByText(/1 changed on this contract/)).toBeVisible()

    await userEvent.click(canvas.getByRole('button', { name: 'More for Platform base' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Reset to plan' }))
    await waitFor(() =>
      expect(
        canvas.queryByRole('button', { name: 'Price changed: edit on Platform base' }),
      ).toBeNull(),
    )
    await expect(canvas.queryByText(/changed on this contract/)).toBeNull()
  },
}

/**
 * A coupon on one charge, from its menu: one coupon per charge, shown as a
 * "20% off" chip that reopens the dialog to change or remove it.
 */
export const AppliesACouponToOneCharge: Story = {
  args: { prefilled: true, step: 'phases', chargeCount: 2 },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'More for Platform base' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Apply coupon' }))
    const dialog = within(
      await screen.findByRole('dialog', { name: 'Apply coupon · Platform base' }),
    )
    await userEvent.click(dialog.getByRole('combobox', { name: 'Coupon' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Launch · 20% off' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Apply coupon' }))

    const chip = await canvas.findByRole('button', { name: '20% off: edit on Platform base' })
    await userEvent.click(chip)
    const change = within(
      await screen.findByRole('dialog', { name: 'Change coupon · Platform base' }),
    )
    await userEvent.click(change.getByRole('button', { name: 'Cancel' }))
    await userEvent.click(canvas.getByRole('button', { name: 'More for Platform base' }))
    await expect(await screen.findByRole('menuitem', { name: 'Change coupon' })).toBeVisible()
    await userEvent.keyboard('{Escape}')

    await userEvent.click(canvas.getByRole('button', { name: 'Save as draft' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          phases: [
            expect.objectContaining({
              discounts: [{ couponId: 'cpn_launch', priceId: 'price_fixed_0' }],
            }),
          ],
        }),
      ),
    )
  },
}

/** The contract's own discount: No discount by default, or one coupon on the whole contract. */
export const DiscountsTheWholeContract: Story = {
  args: { prefilled: true, step: 'phases', chargeCount: 2 },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Discount' })).toBeVisible()
    const coupon = canvas.getByRole('combobox', { name: /^Coupon/ })
    await expect(coupon).toHaveTextContent('No discount')
    await userEvent.click(coupon)
    await userEvent.click(await screen.findByRole('option', { name: 'Loyalty · $50 off' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Save as draft' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          phases: [expect.objectContaining({ discounts: [{ couponId: 'cpn_loyal' }] })],
        }),
      ),
    )
  },
}

/** Add-ons sit under the charges: picked one at a time into a table, and removed from it. */
export const AddsAnAddon: Story = {
  args: { prefilled: true, step: 'phases', chargeCount: 2 },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const picker = canvas.getByRole('combobox', { name: /^Add-on/ })
    await expect(
      canvas.getByText('An add-on brings its own charges and entitlements onto the contract.'),
    ).toBeVisible()
    await userEvent.click(picker)
    await userEvent.click(await screen.findByRole('option', { name: /Premium support/ }))
    const dialog = within(
      await screen.findByRole('dialog', { name: 'Add add-on · Premium support' }),
    )
    await expect(
      dialog.getByText(
        "This add-on has no charges in this contract's currency and billing period.",
      ),
    ).toBeVisible()
    await userEvent.click(dialog.getByRole('button', { name: 'Add add-on' }))
    await expect(await canvas.findByRole('columnheader', { name: 'Add-on' })).toBeVisible()
    await expect(canvas.getByRole('columnheader', { name: 'Charges' })).toBeVisible()
    // One rule, under the card's title: none runs into the table or under the picker.
    const card = canvas.getByRole('heading', { name: 'Add-ons' }).closest('section')!
    await expect(card.querySelectorAll('[data-slot="separator"]')).toHaveLength(1)
    await expect(canvas.getByRole('combobox', { name: /^Add another/ })).toBeVisible()
    await userEvent.click(canvas.getByRole('combobox', { name: /^Add another/ }))
    await userEvent.click(await screen.findByRole('option', { name: /Extra storage/ }))
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Add add-on' }),
    )
    await userEvent.click(await canvas.findByRole('button', { name: 'Actions for Extra storage' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Remove add-on' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Save as draft' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          addons: [{ addonId: 'addon_support', name: 'Premium support' }],
        }),
      ),
    )
  },
}

/**
 * Picking an add-on lists all its charges that bill on this contract, fixed and
 * usage (not the quarterly one on a monthly contract). Each can be repriced
 * before the add-on is added; the new price is sent on the add-on.
 */
export const AddonPriceOverride: Story = {
  args: { prefilled: true, step: 'phases', chargeCount: 2 },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('combobox', { name: /^Add-on/ }))
    await userEvent.click(await screen.findByRole('option', { name: /Extra storage/ }))
    let dialog = within(await screen.findByRole('dialog', { name: 'Add add-on · Extra storage' }))
    await expect(dialog.getByText('Storage base')).toBeVisible()
    await expect(dialog.getByText('Storage (GB)')).toBeVisible()
    expect(dialog.queryByText('Storage archive (GB)')).toBeNull()
    await userEvent.click(dialog.getByRole('button', { name: 'Actions for Storage base' }))
    const override = await screen.findByRole('menuitem', { name: 'Override price' })
    await expect(screen.getByRole('menuitem', { name: 'Add commitment' })).toBeVisible()
    await expect(screen.getByRole('menuitem', { name: 'Copy ID' })).toBeVisible()
    await userEvent.click(override)
    const price = within(
      await screen.findByRole('dialog', { name: 'Override price · Storage base' }),
    )
    // The dialog opens on the charge's own price.
    await userEvent.clear(price.getByLabelText(/^Amount/))
    await userEvent.type(price.getByLabelText(/^Amount/), '20')
    await userEvent.click(price.getByRole('button', { name: 'Save override' }))
    dialog = within(await screen.findByRole('dialog', { name: 'Add add-on · Extra storage' }))
    await expect(await dialog.findByText('$20.00')).toBeVisible()
    await userEvent.click(dialog.getByRole('button', { name: 'Add add-on' }))
    await expect(await canvas.findByText(/\$20\.00 \(changed\)/)).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Save as draft' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          addons: [
            {
              addonId: 'addon_storage',
              name: 'Extra storage',
              priceOverrides: [
                expect.objectContaining({
                  priceId: STORAGE_CHARGES[2]!.id,
                  billingModel: BillingModel.FlatFee,
                  amount: '20',
                }),
              ],
            },
          ],
        }),
      ),
    )
  },
}

/** As V1's add-on card: an add-on's usage charge can carry a commitment, sent with the add-on. */
export const AddonCommitment: Story = {
  args: { prefilled: true, step: 'phases', chargeCount: 2 },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('combobox', { name: /^Add-on/ }))
    await userEvent.click(await screen.findByRole('option', { name: /Extra storage/ }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Add add-on · Extra storage' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Actions for Storage (GB)' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Add commitment' }))
    const commitment = within(await screen.findByRole('dialog'))
    await userEvent.type(await commitment.findByRole('textbox', { name: /^Commitment \(/ }), '250')
    await userEvent.click(commitment.getByRole('button', { name: 'Save commitment' }))
    await userEvent.click(
      within(await screen.findByRole('dialog', { name: 'Add add-on · Extra storage' })).getByRole(
        'button',
        { name: 'Add add-on' },
      ),
    )
    await expect(await canvas.findByText('Storage (GB)')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Save as draft' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          addons: [
            expect.objectContaining({
              addonId: 'addon_storage',
              commitments: [
                expect.objectContaining({ priceId: STORAGE_CHARGES[0]!.id, value: '250' }),
              ],
            }),
          ],
        }),
      ),
    )
  },
}

/**
 * Commitments saved on both of the add-on's usage charges, then the contract
 * moved to monthly: the quarterly price no longer attaches, so its commitment
 * is neither listed nor sent (the API would refuse it). The monthly one stays,
 * and Edit reopens the add-on's charges with it.
 */
export const AddonCommitmentAfterPeriodChange: Story = {
  args: {
    prefilled: true,
    step: 'phases',
    chargeCount: 2,
    seededAddons: [
      {
        addonId: 'addon_storage',
        name: 'Extra storage',
        commitments: STORAGE_CHARGES.slice(0, 2).map((charge) => ({
          priceId: charge.id,
          type: 'amount' as const,
          value: '250',
          duration: '' as const,
          overageFactor: '',
          trueUp: false,
          bucketSize: '' as const,
          windowed: false,
          windows: [],
        })),
      },
    ],
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Storage (GB)')).toBeVisible()
    expect(canvas.queryByText('Storage archive (GB)')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for Extra storage' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    const dialog = within(
      await screen.findByRole('dialog', { name: 'Edit add-on · Extra storage' }),
    )
    expect(dialog.queryByText('Storage archive (GB)')).toBeNull()
    await userEvent.click(dialog.getByRole('button', { name: 'Actions for Storage (GB)' }))
    await expect(await screen.findByRole('menuitem', { name: 'Edit commitment' })).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await userEvent.click(dialog.getByRole('button', { name: 'Save add-on' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Save as draft' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          addons: [
            expect.objectContaining({
              addonId: 'addon_storage',
              commitments: [expect.objectContaining({ priceId: STORAGE_CHARGES[0]!.id })],
            }),
          ],
        }),
      ),
    )
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

/**
 * The plan's entitlements can be changed for this contract alone, the way the
 * entitlement form edits them: a grant with its value type and value, an older
 * usage limit as a limit, a static value. A config entitlement keeps the plan's.
 */
export const EditsEntitlements: Story = {
  args: {
    prefilled: true,
    step: 'commitments',
    chargeCount: 2,
    entitlementCount: 5,
    // Custom domain carries grant config: 100 a day.
    entitlementPatch: {
      ent_3: {
        usageLimit: null,
        usageResetPeriod: null,
        grantQuota: '100',
        grantMeasure: EntitlementGrantMeasure.Quantity,
        grantDurationUnit: EntitlementGrantDurationUnit.Day,
        grantDurationValue: 1,
      },
    },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('AI Tokens')).toBeVisible()
    expect(canvas.queryByRole('button', { name: 'Actions for Video minutes' })).toBeNull()

    await userEvent.click(canvas.getByRole('button', { name: 'Actions for Custom domain' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    let dialog = within(
      await screen.findByRole('dialog', { name: 'Edit entitlement · Custom domain' }),
    )
    await expect(dialog.getByRole('textbox', { name: /^Value/ })).toHaveValue('100')
    await userEvent.click(dialog.getByRole('combobox', { name: /^Value type/ }))
    await userEvent.click(await screen.findByRole('option', { name: 'Amount' }))
    const value = dialog.getByRole('textbox', { name: /^Value/ })
    await userEvent.clear(value)
    await userEvent.type(value, '500')
    await userEvent.click(dialog.getByRole('button', { name: 'Save entitlement' }))
    await expect(await canvas.findByText('500 of usage value')).toBeVisible()

    await userEvent.click(canvas.getByRole('button', { name: 'Actions for AI Tokens' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    dialog = within(await screen.findByRole('dialog', { name: 'Edit entitlement · AI Tokens' }))
    // An older usage limit stays a limit: no value type to turn it into a grant.
    expect(dialog.queryByRole('combobox', { name: /^Value type/ })).toBeNull()
    const tokens = dialog.getByRole('textbox', { name: /^Usage limit/ })
    await expect(tokens).toHaveValue('10000')
    await userEvent.clear(tokens)
    await userEvent.type(tokens, '20000')
    await userEvent.click(dialog.getByRole('button', { name: 'Save entitlement' }))
    await expect(await canvas.findByText('20,000')).toBeVisible()

    await userEvent.click(canvas.getByRole('button', { name: 'Actions for Seats' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    dialog = within(await screen.findByRole('dialog', { name: 'Edit entitlement · Seats' }))
    const seats = dialog.getByRole('textbox', { name: /^Value/ })
    await userEvent.clear(seats)
    await userEvent.type(seats, '25')
    await userEvent.click(dialog.getByRole('button', { name: 'Save entitlement' }))
    await expect(await canvas.findByText('25')).toBeVisible()

    await userEvent.click(canvas.getByRole('button', { name: 'Save as draft' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          entitlementOverrides: [
            {
              entitlementId: 'ent_3',
              grant: expect.objectContaining({ measure: 'amount', quota: '500', unit: 'day' }),
            },
            { entitlementId: 'ent_0', usageLimit: 20_000 },
            { entitlementId: 'ent_2', staticValue: '25' },
          ],
        }),
      ),
    )
  },
}

/**
 * A lifetime usage limit (resets never) stays a lifetime limit: only the
 * number changes, and no recurring grant is sent in its place.
 */
export const EntitlementNeverResetKeepsItsLimit: Story = {
  args: {
    prefilled: true,
    step: 'commitments',
    chargeCount: 2,
    entitlementCount: 5,
    entitlementPatch: { ent_0: { usageResetPeriod: UsageResetPeriod.Never } },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Actions for AI Tokens' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    const dialog = within(
      await screen.findByRole('dialog', { name: 'Edit entitlement · AI Tokens' }),
    )
    expect(dialog.queryByRole('combobox', { name: /^Usage resets/ })).toBeNull()
    const limit = dialog.getByRole('textbox', { name: /^Usage limit/ })
    await userEvent.clear(limit)
    await userEvent.type(limit, '500')
    await userEvent.click(dialog.getByRole('button', { name: 'Save entitlement' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Save as draft' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          entitlementOverrides: [{ entitlementId: 'ent_0', usageLimit: 500 }],
        }),
      ),
    )
  },
}

/**
 * An unlimited usage limit opens blank; saving it unchanged is no change, and
 * a limit past what the API can hold is refused.
 */
export const EntitlementUnlimitedLimitUnchanged: Story = {
  args: { prefilled: true, step: 'commitments', chargeCount: 2, entitlementCount: 5 },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Actions for Custom domain' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    const dialog = within(
      await screen.findByRole('dialog', { name: 'Edit entitlement · Custom domain' }),
    )
    await expect(dialog.getByRole('textbox', { name: /^Usage limit/ })).toHaveValue('')
    await userEvent.type(dialog.getByRole('textbox', { name: /^Usage limit/ }), '99999999999999999')
    await userEvent.click(dialog.getByRole('button', { name: 'Save entitlement' }))
    await expect(await dialog.findByText('Enter a smaller number')).toBeVisible()
    await userEvent.clear(dialog.getByRole('textbox', { name: /^Usage limit/ }))
    await userEvent.click(dialog.getByRole('button', { name: 'Save entitlement' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(canvas.queryByText('Changed')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Save as draft' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ entitlementOverrides: [] }),
      ),
    )
  },
}

/** Entitlement changes belong to the plan: choosing another plan drops them. */
export const EntitlementChangesClearOnPlanSwitch: Story = {
  args: { prefilled: true, step: 'commitments', chargeCount: 2, entitlementCount: 5 },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Actions for SSO' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Edit entitlement · SSO' }))
    await userEvent.click(dialog.getByRole('switch'))
    await userEvent.click(dialog.getByRole('button', { name: 'Save entitlement' }))
    await expect(await canvas.findByText('Changed')).toBeVisible()
    const steps = within(canvas.getByRole('group', { name: 'Contract steps' }))
    await userEvent.click(steps.getByRole('button', { name: /Contract/ }))
    await userEvent.click(await canvas.findByRole('combobox', { name: /^Plan/ }))
    await userEvent.click(await screen.findByRole('option', { name: /Starter/ }))
    await userEvent.click(canvas.getByRole('button', { name: 'Save as draft' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ planId: 'plan_0', entitlementOverrides: [] }),
      ),
    )
  },
}

/** Saving a change back to the plan's values, or Reset to plan, sends nothing for it. */
export const EntitlementResetToPlan: Story = {
  args: { prefilled: true, step: 'commitments', chargeCount: 2, entitlementCount: 5 },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Actions for SSO' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Edit entitlement · SSO' }))
    await userEvent.click(dialog.getByRole('switch'))
    await userEvent.click(dialog.getByRole('button', { name: 'Save entitlement' }))
    await expect(await canvas.findByText('Changed')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for SSO' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Reset to plan' }))
    await waitFor(() => expect(canvas.queryByText('Changed')).toBeNull())
    await userEvent.click(canvas.getByRole('button', { name: 'Save as draft' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ entitlementOverrides: [] }),
      ),
    )
  },
}

/**
 * The customer is invoiced in INR while the contract bills in USD: Billing
 * offers the contract's own exchange rate over the global one, with a window,
 * and sends it as `fx_rates`.
 */
export const FxOverrideWhenCurrenciesDiffer: Story = {
  args: {
    prefilled: true,
    step: 'billing',
    chargeCount: 2,
    billingCurrency: 'inr',
    fxGlobalRates: [{ fromCurrency: 'usd', toCurrency: 'inr', rate: '83.00' }],
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('heading', { name: 'Currency conversion' })).toBeVisible()
    await expect(
      canvas.getByText(
        "This contract bills in USD; its invoices go out in INR, the billing customer's currency.",
      ),
    ).toBeVisible()
    const rate = canvas.getByRole('textbox', { name: /^Exchange rate/ })
    await expect(rate).toHaveAttribute('placeholder', '83.00 (global rate)')
    // Blank is allowed: the global rate applies, and nothing is sent.
    await userEvent.type(rate, '0')
    await userEvent.click(canvas.getByRole('button', { name: 'Save as draft' }))
    await expect(await canvas.findByText('Enter a rate above zero')).toBeVisible()
    await userEvent.clear(rate)
    await userEvent.type(rate, '84.5')
    await expect(canvas.getByText('Valid from')).toBeVisible()
    await expect(canvas.getByText('Valid until')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Save as draft' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          fxRates: [{ rate: '84.5', startDate: '', endDate: '' }],
        }),
      ),
    )
  },
}

/**
 * A rate typed while the currencies differed is dropped once the contract
 * moves to the invoicing currency: a hidden, half-typed rate never blocks submit.
 */
export const FxRateDroppedWhenCurrenciesMatch: Story = {
  args: {
    prefilled: true,
    step: 'billing',
    chargeCount: 2,
    billingCurrency: 'inr',
    fxGlobalRates: [{ fromCurrency: 'usd', toCurrency: 'inr', rate: '83.00' }],
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(await canvas.findByRole('textbox', { name: /^Exchange rate/ }), '0')
    // Invoiced to another customer, who has no billing currency of their own.
    await userEvent.click(canvas.getByRole('radio', { name: /Another customer/ }))
    await userEvent.click(canvas.getByRole('combobox', { name: /^Invoiced to/ }))
    await userEvent.click(await screen.findByRole('option', { name: 'Globex' }))
    await waitFor(() =>
      expect(canvas.queryByRole('heading', { name: 'Currency conversion' })).toBeNull(),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Save as draft' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ fxRates: [] })),
    )
  },
}

/**
 * A contract in a custom currency converts at that currency's own factor, as
 * the API does: no global rate is needed, nothing blocks, and no contract rate
 * is offered (the API refuses fx_rates for a custom currency).
 */
export const FxCustomCurrencyConverts: Story = {
  args: {
    prefilled: true,
    step: 'billing',
    chargeCount: 2,
    currency: 'CRD',
    billingCurrency: 'usd',
    fxGlobalRates: [],
    fxCustomCurrencies: { crd: { usd: '0.01' } },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('heading', { name: 'Currency conversion' })).toBeVisible()
    await expect(canvas.getByText('1 CRD = 0.01 USD')).toBeVisible()
    expect(canvas.queryByRole('textbox', { name: /^Exchange rate/ })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Save as draft' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'CRD', fxRates: [] }),
      ),
    )
    expect(canvas.queryByText(/No conversion factor|No exchange rate/)).toBeNull()
  },
}

/**
 * The custom currency config failed to load, so the wizard cannot tell
 * whether USD → INR is converted: with no global rate it warns, never blocks,
 * and the API stays the final check.
 */
export const FxConfigFailedWarnsOnly: Story = {
  args: {
    prefilled: true,
    step: 'billing',
    chargeCount: 2,
    billingCurrency: 'inr',
    fxGlobalRates: [],
    fxCustomCurrencies: null,
    fxSettingsFailed: true,
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText(
        'Could not load currency settings. If USD → INR has no global rate, the API will refuse this contract.',
      ),
    ).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Save as draft' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ fxRates: [] })),
    )
  },
}

/** While the currency settings are still loading: no warning, and nothing blocks. */
export const FxSettingsLoadingSaysNothing: Story = {
  args: {
    prefilled: true,
    step: 'billing',
    chargeCount: 2,
    billingCurrency: 'inr',
    fxGlobalRates: [],
    fxCustomCurrencies: null,
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('heading', { name: 'Currency conversion' })).toBeVisible()
    expect(canvas.queryByText(/Could not load currency settings/)).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Save as draft' }))
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalled())
  },
}

/** With no global rate for the pair, the API refuses the contract: the wizard says so first. */
export const FxMissingGlobalRate: Story = {
  args: {
    prefilled: true,
    step: 'billing',
    chargeCount: 2,
    billingCurrency: 'inr',
    fxGlobalRates: [],
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(await canvas.findByRole('textbox', { name: /^Exchange rate/ }), '84.5')
    await userEvent.click(canvas.getByRole('button', { name: 'Save as draft' }))
    await expect(
      await canvas.findByText(/^No exchange rate for USD → INR\. Add a global rate/),
    ).toBeVisible()
    expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** Invoiced in the contract's own currency: no conversion card, and no `fx_rates`. */
export const NoFxWhenCurrenciesMatch: Story = {
  args: {
    prefilled: true,
    step: 'billing',
    chargeCount: 2,
    billingCurrency: 'usd',
    fxGlobalRates: [],
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('heading', { name: 'Payment' })).toBeVisible()
    expect(canvas.queryByRole('heading', { name: 'Currency conversion' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Save as draft' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ fxRates: [] })),
    )
  },
}

/** Commitments & benefits: the contract's commitment first, then entitlements, grants and taxes. */
export const CommitmentsStep: Story = {
  args: { prefilled: true, step: 'commitments', chargeCount: 4, entitlementCount: 12 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const titles = ['Contract commitment', 'Entitlements', 'Credit grants', 'Taxes']
    for (const title of titles) {
      await expect(await canvas.findByRole('heading', { name: title })).toBeVisible()
    }
    // In that order, the commitment leading; add-ons moved to the charges step.
    const headings = canvas
      .getAllByRole('heading')
      .map((h) => h.textContent ?? '')
      .filter((text) => titles.includes(text))
    await expect(headings).toEqual(titles)
    await expect(canvas.queryByRole('heading', { name: 'Add-ons' })).toBeNull()
    await expect(canvas.queryByText('Charge commitments')).toBeNull()
    // Period, overage, and true-up are visible before an amount is entered.
    await expect(canvas.getByText('Commitment period')).toBeVisible()
    await expect(canvas.getByText('True-up')).toBeVisible()
    // True-up needs a commitment: off and disabled until an amount is entered.
    await expect(canvas.getByRole('switch', { name: /True-up/ })).toHaveAttribute('data-disabled')
    // The customer's tax rate is applied for them, in a table with its code.
    await expect(canvas.getByRole('columnheader', { name: 'Code' })).toBeVisible()
    await expect(canvas.getByText('VAT20')).toBeVisible()
    await expect(canvas.getByText('20%')).toBeVisible()
    await expect(canvas.getByRole('combobox', { name: /^Add another/ })).toHaveAttribute(
      'placeholder',
      'Add another tax rate…',
    )
    await expect(canvas.getByRole('columnheader', { name: 'Allowance' })).toBeVisible()
    await userEvent.type(canvas.getByLabelText(/^Commitment amount/), '1000')
  },
}

/**
 * True-up bills a shortfall against the commitment, so it needs a positive amount:
 * clearing the amount turns it off for good (a new amount starts with it off),
 * and zero, which the API reads as no commitment, keeps it disabled.
 */
export const TrueUpNeedsCommitment: Story = {
  args: { prefilled: true, step: 'commitments' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const amount = canvas.getByLabelText(/^Commitment amount/)
    const trueUp = canvas.getByRole('switch', { name: /True-up/ })
    await userEvent.type(amount, '1000')
    await expect(trueUp).not.toHaveAttribute('data-disabled')
    await userEvent.click(trueUp)
    await expect(trueUp).toBeChecked()
    // Clearing the amount turns true-up off; a new amount does not bring it back.
    await userEvent.clear(amount)
    await expect(trueUp).toHaveAttribute('data-disabled')
    await expect(trueUp).not.toBeChecked()
    await userEvent.type(amount, '500')
    await expect(trueUp).not.toHaveAttribute('data-disabled')
    await expect(trueUp).not.toBeChecked()
    await userEvent.click(canvas.getByRole('button', { name: 'Save as draft' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenLastCalledWith(
        expect.objectContaining({ commitmentAmount: '500', enableTrueUp: false }),
      ),
    )
    // Zero is no commitment: true-up stays disabled and is not submitted on.
    await userEvent.click(trueUp)
    await expect(trueUp).toBeChecked()
    await userEvent.clear(amount)
    await userEvent.type(amount, '0')
    await expect(trueUp).toHaveAttribute('data-disabled')
    await expect(trueUp).not.toBeChecked()
    await userEvent.click(canvas.getByRole('button', { name: 'Save as draft' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenLastCalledWith(
        expect.objectContaining({ commitmentAmount: '0', enableTrueUp: false }),
      ),
    )
  },
}

export const BillingStep: Story = {
  args: { prefilled: true, step: 'billing' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const title of ['Payment', 'Customer hierarchy', 'Other settings']) {
      await expect(canvas.getByRole('heading', { name: title })).toBeVisible()
    }
    for (const label of [
      'Payment terms',
      'Billing customer',
      'Inherited customers',
      'Auto-invoice threshold',
    ]) {
      await expect(canvas.getByText(label, { exact: true })).toBeVisible()
    }
    // The plan has fixed charges, so there is no early invoice to set.
    const threshold = canvas.getByLabelText(/^Auto-invoice threshold/)
    await expect(threshold).toBeDisabled()
    await expect(threshold).toHaveAttribute(
      'placeholder',
      'Not available: the plan has fixed charges',
    )
    // Proration is in Dates and billing; draft is the header's Save as draft.
    await expect(canvas.queryByText('Prorate changes')).toBeNull()
    await expect(canvas.queryByText('Create as draft')).toBeNull()
  },
}

/** Another customer pays: Next waits until one is chosen, or the choice goes back to the same customer. */
export const ChoosesWhoPays: Story = {
  args: { prefilled: true, step: 'billing' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('radio', { name: /Another customer/ }))
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    await expect(
      await canvas.findByText('Choose who pays, or switch back to the same customer.'),
    ).toBeVisible()
    await expect(args.onStepChange).not.toHaveBeenCalledWith('review')
    await userEvent.click(canvas.getByRole('combobox', { name: /^Invoiced to/ }))
    await userEvent.click(await screen.findByRole('option', { name: /Globex/ }))
    await expect(
      canvas.queryByText('Choose who pays, or switch back to the same customer.'),
    ).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(args.onStepChange).toHaveBeenLastCalledWith('review'))
  },
}

/**
 * Customers inherit the contract: picked by name, shown as chips, and sent by
 * external id. A customer with a contract of its own is listed but cannot be
 * picked, and says why: the API would refuse it.
 */
export const InheritsCustomers: Story = {
  args: {
    prefilled: true,
    step: 'billing',
    inheritanceBlocks: { cus_3: InheritanceBlock.OwnContract },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const picker = canvas.getByRole('combobox', { name: /^Inherited customers/ })
    await expect(picker).toHaveAttribute('placeholder', 'Search and select customers…')
    await userEvent.click(picker)
    await expect(await screen.findByRole('option', { name: /Umbrella/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await expect(screen.getByRole('option', { name: /Umbrella/ })).toHaveTextContent(
      'Has its own contract',
    )
    await userEvent.click(screen.getByRole('option', { name: /Globex/ }))
    await userEvent.keyboard('{Escape}')
    await expect(canvas.getByRole('button', { name: 'Remove Globex' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(args.onStepChange).toHaveBeenLastCalledWith('review'))
    await userEvent.click(canvas.getByRole('button', { name: 'Create contract' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          inheritedCustomerExternalIds: ['ext_1'],
          invoicingCustomerExternalId: '',
        }),
      ),
    )
  },
}

/**
 * Inherited customers are billed to the contract's own customer, so another
 * billing customer beside them is stopped here, not by the API.
 */
export const InheritedCustomersKeepTheSamePayer: Story = {
  args: { prefilled: true, step: 'billing' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('combobox', { name: /^Inherited customers/ }))
    await userEvent.click(await screen.findByRole('option', { name: /Globex/ }))
    await userEvent.keyboard('{Escape}')
    await userEvent.click(canvas.getByRole('radio', { name: /Another customer/ }))
    await userEvent.click(canvas.getByRole('combobox', { name: /^Invoiced to/ }))
    await userEvent.click(await screen.findByRole('option', { name: /Initech/ }))
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    await expect(
      await canvas.findByText(/Inherited customers are billed to this contract's customer/),
    ).toBeVisible()
    await expect(args.onStepChange).not.toHaveBeenCalledWith('review')
    await userEvent.click(canvas.getByRole('radio', { name: /Same customer/ }))
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(args.onStepChange).toHaveBeenLastCalledWith('review'))
  },
}

const PARENT_CONTRACTS: SubscriptionParentOption[] = [
  {
    value: 'subs_parent',
    label: 'GobbleCube · Enterprise',
    hint: 'subs_parent',
    customerId: 'cus_1',
  },
  // The contract's own customer's contract: never offered as its parent.
  { value: 'subs_own', label: 'Own customer · Starter', hint: 'subs_own', customerId: 'cus_0' },
]

/**
 * A contract created under a parent contract, for a customer hierarchy: picked
 * by customer and plan, sent as `parent_subscription_id`. A child is invoiced
 * through its parent, so the billing customer and inherited customers step
 * aside while a parent is chosen.
 */
export const ChoosesAParentContract: Story = {
  args: { prefilled: true, step: 'billing', parentContracts: PARENT_CONTRACTS },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const picker = canvas.getByRole('combobox', { name: /^Parent contract/ })
    await userEvent.click(picker)
    await expect(screen.queryByRole('option', { name: /Own customer/ })).toBeNull()
    await userEvent.click(await screen.findByRole('option', { name: /GobbleCube/ }))
    await expect(canvas.queryByText('Billing customer', { exact: true })).toBeNull()
    await expect(canvas.queryByText('Inherited customers', { exact: true })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(args.onStepChange).toHaveBeenLastCalledWith('review'))
    await userEvent.click(canvas.getByRole('button', { name: 'Create contract' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          parentSubscriptionId: 'subs_parent',
          invoicingCustomerExternalId: '',
          inheritedCustomerExternalIds: [],
        }),
      ),
    )
  },
}

/** A plan without entitlements says so. */
export const NoEntitlements: Story = {
  args: { prefilled: true, step: 'commitments', entitlementCount: 0 },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText('This plan includes no entitlements.'),
    ).toBeVisible()
  },
}

/** Save as draft sits in the header on every step and creates the contract as a draft. */
export const SavesAsDraft: Story = {
  args: { prefilled: true, step: 'plan' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Save as draft' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ draft: true })),
    )
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

/**
 * The review counts the charges this deal changes rather than listing them:
 * a contract can change dozens; the charges step shows each one.
 */
export const ReviewCountsChangedCharges: Story = {
  args: {
    prefilled: true,
    step: 'review',
    chargeCount: 20,
    phase: {
      priceOverrides: [
        { priceId: 'price_fixed_0', billingModel: BillingModel.FlatFee, amount: '7' },
      ],
      quantities: Array.from({ length: 9 }, (_, i) => ({
        priceId: `price_fixed_${i + 1}`,
        quantity: String(i + 2),
      })),
      discounts: [{ couponId: 'cpn_launch', priceId: 'price_fixed_0' }, { couponId: 'cpn_loyal' }],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('20 charges · 10 changed from the plan')).toBeVisible()
    await expect(canvas.queryByText('and 2 more')).not.toBeInTheDocument()
    await expect(canvas.getByText('Loyalty ($50 off) · 1 on single charges')).toBeVisible()
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
 * The review is one card per step, each with its Edit: the reference's
 * summary, not a second copy of each step. There is no first-invoice estimate:
 * nothing in the API can make one.
 */
export const ReviewByStep: Story = {
  args: { prefilled: true, step: 'review', chargeCount: 4, entitlementCount: 3 },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    for (const title of ['Contract', 'Charges & add-ons', 'Commitments & benefits', 'Billing']) {
      await expect(canvas.getByRole('heading', { name: title })).toBeVisible()
    }
    // The name, then the email (here the fixture's id) the picker shows under it.
    await expect(canvas.getByText(/^Acme Robotics · /)).toBeVisible()
    await expect(canvas.getByText('Oct 20, 2026, 12:00 AM → until cancelled')).toBeVisible()
    await expect(canvas.getByText("4 charges · all at the plan's prices")).toBeVisible()
    await expect(canvas.getByText('No proration')).toBeVisible()
    await expect(canvas.getByText('VAT 20%')).toBeVisible()
    await expect(canvas.getByText('Each period')).toBeVisible()
    await expect(canvas.getByText('14 days')).toBeVisible()
    await expect(canvas.getByText(/^3, from the plan/)).toBeVisible()
    await expect(canvas.queryByText('First invoice')).toBeNull()
    await expect(canvas.queryByRole('complementary', { name: 'Summary' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Edit billing' }))
    await expect(args.onStepChange).toHaveBeenLastCalledWith('billing')
  },
}

/**
 * A free trial makes the contract start trialing, and the API takes added
 * charges only on an active one: the form says so instead of sending a request
 * that would fail.
 */
export const TrialWithAddedChargeIsStopped: Story = {
  args: { prefilled: true, step: 'phases', chargeCount: 2 },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Add charge' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Add a charge' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Continue' }))
    await userEvent.type(await dialog.findByLabelText('Display name'), 'Onboarding')
    await userEvent.type(dialog.getByLabelText(/^Amount/), '250')
    await userEvent.click(dialog.getByRole('button', { name: 'Add charge' }))
    await expect(await canvas.findByText('Onboarding')).toBeVisible()
    for (let i = 0; i < 3; i++) {
      await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    }
    await userEvent.click(canvas.getByRole('button', { name: 'Create contract' }))
    await expect(await canvas.findByText(/free trial starts as trialing/)).toBeVisible()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** Closing a configured contract asks before losing it; keeping it preserves the choice. */
export const ProtectsUnsavedConfiguration: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('combobox', { name: /^Customer/ }))
    await userEvent.click(await screen.findByRole('option', { name: /Acme Robotics/ }))
    await userEvent.click(canvas.getByRole('button', { name: 'Close form' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Discard this contract?' }))
    await expect(args.onCancel).not.toHaveBeenCalled()
    await userEvent.click(dialog.getByRole('button', { name: 'Keep editing' }))
    await expect(canvas.getByRole('heading', { name: /^Plan$/ })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Close form' }))
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Discard changes' }),
    )
    await expect(args.onCancel).toHaveBeenCalledTimes(1)
  },
}

export const AddsSecondPhase: Story = {
  args: { prefilled: true, noTrial: true, step: 'phases', endDate: '2027-01-01' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Add phase' }))
    await expect(canvas.getByRole('heading', { name: 'Phase 2' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Save as draft' }))
    await expect(
      canvas.getByText(
        'A draft contract cannot have phases. Create the contract instead, or keep a single phase.',
      ),
    ).toBeVisible()
  },
}

export const AddsContractEntitlement: Story = {
  args: { prefilled: true, step: 'commitments', entitlementCount: 0 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Add entitlement' }))
    let dialog = within(await screen.findByRole('dialog', { name: 'Add entitlement' }))
    await userEvent.click(dialog.getByRole('combobox', { name: /Feature/ }))
    await userEvent.click(await screen.findByRole('option', { name: /Priority support/ }))
    await userEvent.click(dialog.getByRole('button', { name: 'Add entitlement' }))
    await expect(await canvas.findByText('Priority support')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Add entitlement' })).toBeDisabled()
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for Priority support' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    dialog = within(await screen.findByRole('dialog', { name: 'Edit entitlement' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Save entitlement' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Save as draft' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          additionalEntitlements: [
            expect.objectContaining({ featureId: 'feat_extra', featureType: FeatureType.Boolean }),
          ],
        }),
      ),
    )
  },
}

export const RemovesStagedEntitlement: Story = {
  args: { prefilled: true, step: 'commitments', entitlementCount: 1 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Add entitlement' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Add entitlement' }))
    await userEvent.click(dialog.getByRole('combobox', { name: /Feature/ }))
    await userEvent.click(await screen.findByRole('option', { name: /Priority support/ }))
    await userEvent.click(dialog.getByRole('button', { name: 'Add entitlement' }))
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Actions for Priority support' }),
    )
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Remove' }))
    await expect(canvas.queryByText('Priority support')).not.toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Add entitlement' })).toBeEnabled()
  },
}
