import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import { BillingPeriod, type CreateSubscription } from '@fp/domain'
import type { Option } from '@ui/compositions/forms/OptionSelect'
import { makeCharges, makeEntitlements } from '../product-catalog/plans/planDetailFixtures'
import { SubscriptionForm, type SubscriptionPlanContext } from './SubscriptionForm'

const STEPS = ['plan', 'benefits', 'review'] as const
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

const makeCustomers = (count: number): Option[] =>
  Array.from({ length: count }, (_, i) => ({
    value: `cus_${i}`,
    label: withName(CUSTOMER_NAMES, i),
    hint: `cus_${i}`,
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
        : makeCharges(Math.ceil(chargeCount / 2), Math.floor(chargeCount / 2)),
      entitlements: planLoading ? [] : makeEntitlements(entitlementCount),
    }
  }, [planId, planLoading, chargeCount, entitlementCount])

  return (
    <SubscriptionForm
      // A different seed is a different form, so react-hook-form's defaults reset.
      key={`${prefilled}-${customerLocked}`}
      {...(prefilled ? { defaultValue: PREFILLED } : {})}
      customers={customers}
      plans={plans}
      plan={plan}
      onPlanChange={handlePlanChange}
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

/** Start a contract in three steps: customer & plan, benefits (entitlements, credit grants, commitments) and review. */
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

/** The Plan & charges step lists the chosen plan's charges under the billing card; drag chargeCount to see none or many. */
export const PlanCharges: Story = {
  args: { prefilled: true, step: 'plan', chargeCount: 6 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Charges')).toBeVisible()
  },
}

export const PlanNoCharges: Story = {
  args: { prefilled: true, step: 'plan', chargeCount: 0 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('This plan has no charges')).toBeVisible()
  },
}

export const PlanLoading: Story = {
  args: { prefilled: true, step: 'plan', planLoading: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/Loading the plan's charges/)).toBeVisible()
  },
}

/** The Benefits step: the plan's entitlements, then credit grants and commitments. */
export const BenefitsStep: Story = {
  args: { prefilled: true, step: 'benefits', entitlementCount: 12 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Entitlements')).toBeVisible()
    await expect(canvas.getByText('Credit grants')).toBeVisible()
  },
}

/** Entitlements come from the plan, so with none chosen the step says so. */
export const BenefitsNoPlan: Story = {
  args: { step: 'benefits' },
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
