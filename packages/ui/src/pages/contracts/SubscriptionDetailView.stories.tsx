import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import {
  CreditGrantCadence,
  CreditGrantExpiryType,
  CreditGrantPeriod,
  CreditGrantScope,
  InvoiceStatus,
  SubscriptionScheduleType,
  SubscriptionStatus,
  money,
  type CreditGrant,
  type Invoice,
  type SubscriptionDetail,
  type SubscriptionEntitlement,
  type SubscriptionLine,
  type SubscriptionSchedule,
  type SubscriptionUsage,
} from '@fp/domain'
import {
  SubscriptionDetailView,
  type SubscriptionActivity,
  type SubscriptionDetailViewProps,
  type SubscriptionPart,
} from './SubscriptionDetailView'

/** The menu is portalled; Base UI's focus guards trip this rule (see AppShell.stories.tsx). */
const menuA11y = { a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } } }

const date = (iso: string) => new Date(`${iso}T00:00:00Z`)
const ready = <T,>(data: T): SubscriptionPart<T> => ({ data })

const SUBSCRIPTION: SubscriptionDetail = {
  id: 'subs_01JK3M8Q4T',
  customerId: 'cust_acme',
  customerName: 'Acme Robotics',
  planId: 'plan_scale',
  planName: 'Scale',
  status: SubscriptionStatus.Active,
  currency: 'USD',
  billingPeriodLabel: 'Monthly',
  currentPeriodStart: date('2026-10-01'),
  currentPeriodEnd: date('2026-11-01'),
  startDate: date('2026-03-01'),
  createdAt: date('2026-02-27'),
  billingPeriod: 'MONTHLY',
  billingPeriodCount: 1,
  cancelAt: null,
  cancelAtPeriodEnd: false,
  cancelledAt: null,
  endDate: null,
  trialStart: null,
  trialEnd: null,
  paymentTerms: 'NET_30',
  collectionMethod: 'send_invoice',
  metadata: { account_manager: 'Priya N', region: 'eu-west' },
  timezone: 'UTC',
  lookupKey: 'acme-scale-2026',
  commitmentAmount: money('2500', 'USD'),
  latestInvoice: { id: 'inv_0922', number: 'INV-0922' },
}

const LINES: SubscriptionLine[] = [
  {
    id: 'line_1',
    name: 'Platform fee',
    kind: 'fixed',
    quantity: '1',
    billingPeriodLabel: 'Monthly',
    amount: money('1500', 'USD'),
    startDate: null,
    endDate: null,
    source: 'plan',
    priceId: 'price_platform',
    amountEditable: true,
  },
  {
    id: 'line_2',
    name: 'API requests',
    kind: 'usage',
    quantity: '',
    billingPeriodLabel: 'Monthly',
    amount: money('0.002', 'USD'),
    startDate: null,
    endDate: null,
    source: 'plan',
    priceId: 'price_api',
    amountEditable: false,
  },
  {
    id: 'line_3',
    name: 'Onboarding',
    kind: 'fixed',
    quantity: '1',
    billingPeriodLabel: 'Monthly',
    amount: money('250', 'USD'),
    startDate: null,
    endDate: null,
    source: 'contract',
    priceId: 'price_onboarding',
    amountEditable: true,
  },
]

const ENTITLEMENTS: SubscriptionEntitlement[] = [
  {
    featureId: 'feat_api',
    name: 'API requests',
    enabled: true,
    usageLimit: 1_000_000,
    softLimit: true,
    resetPeriodLabel: 'Monthly',
  },
  {
    featureId: 'feat_sso',
    name: 'SAML SSO',
    enabled: true,
    usageLimit: null,
    softLimit: false,
    resetPeriodLabel: '',
  },
]

const GRANTS: CreditGrant[] = [
  {
    id: 'cg_1',
    name: 'Onboarding credits',
    scope: CreditGrantScope.Plan,
    credits: '5000',
    cadence: CreditGrantCadence.OneTime,
    period: null,
    periodCount: null,
    expirationType: CreditGrantExpiryType.Never,
    expirationDuration: null,
    expirationDurationUnit: null,
    conversionRate: null,
    priority: 1,
    createdAt: date('2026-03-01'),
  },
  {
    id: 'cg_2',
    name: 'Monthly top-up',
    scope: CreditGrantScope.Plan,
    credits: '1000',
    cadence: CreditGrantCadence.Recurring,
    period: CreditGrantPeriod.Monthly,
    periodCount: 1,
    expirationType: CreditGrantExpiryType.BillingCycle,
    expirationDuration: null,
    expirationDurationUnit: null,
    conversionRate: null,
    priority: 2,
    createdAt: date('2026-03-01'),
  },
]

const USAGE: SubscriptionUsage = {
  periodStart: date('2026-10-01'),
  periodEnd: date('2026-11-01'),
  total: money('1840.5', 'USD'),
  commitment: money('2500', 'USD'),
  commitmentUtilized: money('1840.5', 'USD'),
  overage: null,
  hasOverage: false,
  charges: [
    {
      id: 'uc_1',
      name: 'API requests',
      quantity: 920_250,
      amount: money('1840.5', 'USD'),
      isOverage: false,
    },
  ],
}

const INVOICES: Invoice[] = [
  {
    id: 'inv_0922',
    number: 'INV-0922',
    customerId: 'cust_acme',
    customerName: 'Acme Robotics',
    status: InvoiceStatus.Paid,
    paymentStatus: null,
    total: money('3340.5', 'USD'),
    amountDue: money('0', 'USD'),
    amountRemaining: money('0', 'USD'),
    dueDate: date('2026-10-31'),
    issuedAt: date('2026-10-01'),
    periodStart: date('2026-09-01'),
    periodEnd: date('2026-10-01'),
  },
  {
    id: 'inv_0871',
    number: 'INV-0871',
    customerId: 'cust_acme',
    customerName: 'Acme Robotics',
    status: InvoiceStatus.Open,
    paymentStatus: null,
    total: money('3012', 'USD'),
    amountDue: money('3012', 'USD'),
    amountRemaining: money('3012', 'USD'),
    dueDate: date('2026-10-01'),
    issuedAt: date('2026-09-01'),
    periodStart: date('2026-08-01'),
    periodEnd: date('2026-09-01'),
  },
]

const ACTIVITY: SubscriptionActivity[] = [
  {
    id: 3,
    title: 'Renews',
    at: 'Nov 1, 2026',
    status: 'pending',
    summary: 'The next billing period starts.',
  },
  {
    id: 2,
    title: 'Contract started',
    at: 'Mar 1, 2026',
    status: 'completed',
    summary: 'Billing began.',
  },
  {
    id: 1,
    title: 'Contract created',
    at: 'Feb 27, 2026',
    status: 'completed',
    summary: 'The contract was created.',
  },
]

const SCHEDULE: SubscriptionSchedule = {
  id: 'sched_1',
  type: SubscriptionScheduleType.PlanChange,
  scheduledAt: date('2026-11-01'),
  daysUntilExecution: 23,
  canBeCancelled: true,
}

const BASE: SubscriptionDetailViewProps = {
  subscription: SUBSCRIPTION,
  lines: ready(LINES),
  entitlements: ready(ENTITLEMENTS),
  creditGrants: ready(GRANTS),
  usage: ready(USAGE),
  invoices: ready(INVOICES),
  schedules: ready([]),
  activity: ACTIVITY,
  onBack: fn(),
  onOpenCustomer: fn(),
  onOpenPlan: fn(),
  onOpenInvoice: fn(),
  onActivate: fn(),
  onCancel: fn(),
  onAddCharge: fn(),
  onEditCharge: fn(),
  onEndCharge: fn(),
  onPreviewQuantity: fn(async () => ({
    lines: [
      {
        id: 'line_1',
        action: 'ended',
        quantity: '1',
        startDate: null,
        endDate: date('2026-10-15'),
      },
      {
        id: 'line_1b',
        action: 'created',
        quantity: '5',
        startDate: date('2026-10-15'),
        endDate: null,
      },
    ],
    invoices: [{ action: 'created', status: 'draft', amountDue: money('600', 'USD') }],
  })),
  onChangeQuantity: fn(),
}

const withSubscription = (patch: Partial<SubscriptionDetail>): SubscriptionDetailViewProps => ({
  ...BASE,
  subscription: { ...SUBSCRIPTION, ...patch },
})

/** One contract, read-only: lifecycle banners, a summary row, five tabs and an Activity, Metadata, Related rail. */
const meta = {
  title: 'App/Contracts/Contract detail',
  component: SubscriptionDetailView,
  parameters: { layout: 'fullscreen' },
  args: BASE,
} satisfies Meta<typeof SubscriptionDetailView>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Acme Robotics on Scale' }),
    ).toBeVisible()
    const header = within(canvas.getByRole('banner'))
    await expect(header.getByText('Active')).toBeVisible()
    await expect(header.getByText('USD')).toBeVisible()
    // The header holds only the badges, the ID and More.
    await expect(header.queryByRole('button', { name: 'Cancel contract' })).toBeNull()
    await expect(canvas.getAllByRole('tab')).toHaveLength(5)
    await expect(canvas.getByRole('tab', { name: /Entitlements & credits/ })).toBeVisible()
    await expect(canvas.queryByRole('tab', { name: 'Schedule' })).toBeNull()
    await expect(canvas.queryByRole('tab', { name: 'Activity' })).toBeNull()
    await expect(canvas.getByRole('heading', { name: 'Activity' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Metadata' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Related' })).toBeVisible()
    await expect(canvas.queryByRole('alert')).toBeNull()
  },
}

/** Every action is in More, destructive last. No Pause: the backend has none. */
export const MoreMenu: Story = {
  parameters: menuA11y,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Contract actions' }))
    await expect(await screen.findByRole('menuitem', { name: 'Cancel contract' })).toBeVisible()
    await expect(screen.queryByRole('menuitem', { name: /Pause/ })).toBeNull()
    await expect(screen.queryByRole('menuitem', { name: 'Activate' })).toBeNull()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Cancel contract' }))
    await expect(args.onCancel).toHaveBeenCalledOnce()
  },
}

/** The one action outside More: the banner's Activate. It is also in the menu. */
export const Incomplete: Story = {
  args: withSubscription({ status: SubscriptionStatus.Incomplete, currentPeriodStart: null }),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const banner = within(canvas.getByRole('alert'))
    await expect(banner.getByText('This contract has not started')).toBeVisible()
    await userEvent.click(banner.getByRole('button', { name: 'Activate' }))
    await expect(args.onActivate).toHaveBeenCalledOnce()
  },
}

export const CancelsAtPeriodEnd: Story = {
  args: withSubscription({ cancelAtPeriodEnd: true }),
  parameters: menuA11y,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/ends on Nov 1, 2026 and will not renew/)).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Contract actions' }))
    await expect(await screen.findByRole('menuitem', { name: 'Cancel contract' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  },
}

export const CancelsOnDate: Story = {
  args: withSubscription({ cancelAt: date('2026-12-15') }),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/ends on Dec 15, 2026 and will not renew/),
    ).toBeVisible()
  },
}

export const Cancelled: Story = {
  args: withSubscription({
    status: SubscriptionStatus.Cancelled,
    cancelledAt: date('2026-09-15'),
    endDate: date('2026-09-15'),
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/cancelled on Sep 15, 2026/)).toBeVisible()
    await expect(canvas.getByText('Ended')).toBeVisible()
  },
}

/** A paused contract shows correctly; there is no Pause or Resume action. */
export const Paused: Story = {
  args: withSubscription({ status: SubscriptionStatus.Paused }),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Billing is paused for this contract.'),
    ).toBeVisible()
  },
}

export const Trialing: Story = {
  args: withSubscription({
    status: SubscriptionStatus.Trialing,
    trialStart: date('2026-10-01'),
    trialEnd: date('2026-10-15'),
  }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/trial ends on Oct 15, 2026/)).toBeVisible()
  },
}

/** A queued change is a banner with its date, not a tab. */
export const PendingPlanChange: Story = {
  args: { ...BASE, schedules: ready([SCHEDULE]) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Plan change scheduled')).toBeVisible()
    await expect(canvas.getByText(/Takes effect on Nov 1, 2026 \(in 23 days\)/)).toBeVisible()
  },
}

export const PricingTab: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: /Pricing/ }))
    await expect(await canvas.findByText('Platform fee')).toBeVisible()
    await expect(canvas.getByText('$1,500.00')).toBeVisible()
    // Each charge says where it comes from, and a plan charge says editing it here is local.
    await expect(canvas.getAllByText('From plan')).toHaveLength(2)
    await expect(canvas.getByText('Contract only')).toBeVisible()
    await expect(canvas.getByText(/shared by every contract on Scale/)).toBeVisible()
  },
}

const openPricing = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement)
  const tab = canvas.getByRole('tab', { name: /Pricing/ })
  await userEvent.click(tab)
  await waitFor(() => expect(tab).toHaveAttribute('aria-selected', 'true'))
  await canvas.findByText('Platform fee')
  return canvas
}

/** Overview leads with the charges, then the contract and billing facts, then the latest invoice. */
export const OverviewSummary: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('heading', { name: 'Charges' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Contract' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Billing & collection' })).toBeVisible()
    await expect(canvas.getByText('Platform fee')).toBeVisible()
    // The charges summary hands off to the Pricing tab.
    await userEvent.click(canvas.getByRole('button', { name: /pricing/i }))
    await waitFor(() =>
      expect(canvas.getByRole('tab', { name: /Pricing/ })).toHaveAttribute('aria-selected', 'true'),
    )
  },
}

/** The Overview charges carry the same row actions as Pricing, and show the quantity. */
export const OverviewChargeActions: Story = {
  parameters: menuA11y,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('Platform fee')
    await expect(canvas.getByRole('columnheader', { name: 'Quantity' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for Platform fee' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    await expect(await screen.findByRole('dialog')).toBeVisible()
  },
}

/** "Edit the plan" is the way to change a plan charge for everyone. */
export const EditPlanLink: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = await openPricing(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'edit the plan' }))
    await expect(args.onOpenPlan).toHaveBeenCalledOnce()
  },
}

/** Add a fixed charge to this contract only. */
export const AddCharge: Story = {
  parameters: menuA11y,
  play: async ({ canvasElement, args }) => {
    const canvas = await openPricing(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Add charge' }))
    const dialog = within(await screen.findByRole('dialog'))
    // Empty fields are refused with a message, not sent.
    await userEvent.click(dialog.getByRole('button', { name: 'Add charge' }))
    await expect(await dialog.findByText('Enter a name.')).toBeVisible()
    await expect(args.onAddCharge).not.toHaveBeenCalled()
    await userEvent.type(dialog.getByLabelText('Name'), 'Premium support')
    await userEvent.type(dialog.getByLabelText(/^Price/), '400')
    await userEvent.click(dialog.getByRole('button', { name: 'Add charge' }))
    await expect(args.onAddCharge).toHaveBeenCalledWith({
      name: 'Premium support',
      amount: '400',
      quantity: '1',
      startDate: '',
    })
  },
}

/** Change one charge's price; the dialog starts from the current price. */
export const EditPrice: Story = {
  parameters: menuA11y,
  play: async ({ canvasElement, args }) => {
    const canvas = await openPricing(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for Platform fee' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    const dialog = within(await screen.findByRole('dialog'))
    await expect(
      dialog.getByText(/Only this contract changes; the plan keeps its price/),
    ).toBeVisible()
    const price = dialog.getByLabelText(/^New price/)
    await expect(price).toHaveValue('1500')
    await userEvent.clear(price)
    await userEvent.type(price, '1400')
    await userEvent.type(dialog.getByLabelText('Effective from'), '2026-11-01')
    await userEvent.click(dialog.getByRole('button', { name: 'Save price' }))
    await expect(args.onEditCharge).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'line_1' }),
      { amount: '1400', effectiveFrom: '2026-11-01' },
    )
  },
}

/** Quantity is changed in two steps: the form, then the API's preview, then confirm. */
export const ChangeQuantity: Story = {
  parameters: menuA11y,
  play: async ({ canvasElement, args }) => {
    const canvas = await openPricing(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for Platform fee' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Change quantity' }))
    const dialog = within(await screen.findByRole('dialog'))
    // Nothing changed yet: the form refuses to continue.
    await userEvent.click(dialog.getByRole('button', { name: 'Preview change' }))
    await expect(await dialog.findByText(/Change the quantity or the price/)).toBeVisible()
    await expect(args.onPreviewQuantity).not.toHaveBeenCalled()

    const quantity = dialog.getByLabelText('Quantity')
    await userEvent.clear(quantity)
    await userEvent.type(quantity, '5')
    await userEvent.click(dialog.getByRole('button', { name: 'Preview change' }))
    await expect(args.onPreviewQuantity).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'line_1' }),
      { quantity: '5', amount: '1500', effectiveDate: '' },
    )
    // The preview is shown before anything is saved.
    await expect(await dialog.findByText('New line · quantity 5')).toBeVisible()
    await expect(args.onChangeQuantity).not.toHaveBeenCalled()
    await userEvent.click(dialog.getByRole('button', { name: 'Confirm change' }))
    await expect(args.onChangeQuantity).toHaveBeenCalledOnce()
  },
}

/** Usage charges are repriced, not given a quantity. */
export const UsageChargeHasNoQuantityChange: Story = {
  parameters: menuA11y,
  play: async ({ canvasElement }) => {
    const canvas = await openPricing(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for API requests' }))
    await screen.findByRole('menuitem', { name: 'Edit' })
    await expect(screen.queryByRole('menuitem', { name: 'Change quantity' })).toBeNull()
  },
}

/** A preview the API rejects keeps the form open with the reason. */
export const QuantityPreviewFails: Story = {
  parameters: menuA11y,
  args: {
    onPreviewQuantity: () =>
      Promise.reject(new Error('effective_date must be before the line item end date')),
  },
  play: async ({ canvasElement }) => {
    const canvas = await openPricing(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for Platform fee' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Change quantity' }))
    const dialog = within(await screen.findByRole('dialog'))
    const quantity = dialog.getByLabelText('Quantity')
    await userEvent.clear(quantity)
    await userEvent.type(quantity, '3')
    await userEvent.click(dialog.getByRole('button', { name: 'Preview change' }))
    await expect(await dialog.findByText(/effective_date must be before/)).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Preview change' })).toBeVisible()
  },
}

/** End a charge from a date; a contract-only charge needs no warning about the plan. */
export const EndCharge: Story = {
  parameters: menuA11y,
  play: async ({ canvasElement, args }) => {
    const canvas = await openPricing(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for Onboarding' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'End charge' }))
    const dialog = within(await screen.findByRole('dialog'))
    await expect(dialog.queryByText(/It comes from the plan/)).toBeNull()
    await userEvent.click(dialog.getByRole('button', { name: 'End charge' }))
    await expect(args.onEndCharge).toHaveBeenCalledWith(expect.objectContaining({ id: 'line_3' }), {
      effectiveFrom: '',
    })
  },
}

/** A failed save keeps the dialog open with the reason. */
export const ChargeSaveFails: Story = {
  parameters: menuA11y,
  args: { onEndCharge: () => Promise.reject(new Error('Line item already ended')) },
  play: async ({ canvasElement }) => {
    const canvas = await openPricing(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for Onboarding' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'End charge' }))
    const dialog = within(await screen.findByRole('dialog'))
    await userEvent.click(dialog.getByRole('button', { name: 'End charge' }))
    await expect(await dialog.findByText('Line item already ended')).toBeVisible()
  },
}

/** A cancelled contract cannot be edited. */
export const CancelledPricingIsReadOnly: Story = {
  args: withSubscription({
    status: SubscriptionStatus.Cancelled,
    cancelledAt: date('2026-09-30'),
  }),
  play: async ({ canvasElement }) => {
    const canvas = await openPricing(canvasElement)
    await expect(canvas.queryByRole('button', { name: 'Add charge' })).toBeNull()
    await expect(canvas.queryByRole('button', { name: /^Actions for/ })).toBeNull()
  },
}

/** Without handlers the Pricing tab is read-only. */
export const PricingWithoutEditing: Story = {
  args: { onAddCharge: undefined, onEditCharge: undefined, onEndCharge: undefined },
  play: async ({ canvasElement }) => {
    const canvas = await openPricing(canvasElement)
    await expect(canvas.queryByRole('button', { name: 'Add charge' })).toBeNull()
  },
}

export const UsageTab: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: 'Usage' }))
    await expect(await canvas.findByText('Usage to date')).toBeVisible()
    await expect(canvas.getByText('920,250')).toBeVisible()
  },
}

export const UsageOverage: Story = {
  args: {
    ...BASE,
    usage: ready({
      ...USAGE,
      total: money('2900', 'USD'),
      overage: money('400', 'USD'),
      hasOverage: true,
      charges: [
        ...USAGE.charges,
        {
          id: 'uc_2',
          name: 'API requests (overage)',
          quantity: 200_000,
          amount: money('400', 'USD'),
          isOverage: true,
        },
      ],
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Overage $400.00')).toBeVisible()
    await userEvent.click(canvas.getByRole('tab', { name: 'Usage' }))
    await expect((await canvas.findAllByText('Overage')).length).toBeGreaterThan(0)
  },
}

export const InvoicesTab: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: /Invoices/ }))
    await userEvent.click(await canvas.findByText('INV-0871'))
    await expect(args.onOpenInvoice).toHaveBeenCalledWith('inv_0871')
  },
}

export const NoInvoices: Story = {
  args: { ...BASE, invoices: ready([]) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: /Invoices/ }))
    await expect(await canvas.findByText('No invoices yet')).toBeVisible()
  },
}

export const EntitlementsAndCredits: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: /Entitlements & credits/ }))
    await expect(await canvas.findByText('SAML SSO')).toBeVisible()
    await expect(canvas.getByText('Unlimited')).toBeVisible()
    await expect(canvas.getByText('Onboarding credits')).toBeVisible()
    await expect(canvas.getByText('Recurring · monthly')).toBeVisible()
  },
}

export const NoActivityOrMetadata: Story = {
  args: {
    ...withSubscription({
      metadata: {},
      latestInvoice: null,
      commitmentAmount: null,
      lookupKey: '',
    }),
    activity: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No activity yet.')).toBeVisible()
    await expect(canvas.getAllByText('None').length).toBeGreaterThan(0)
  },
}

/** Each tab loads on its own: the page and header render while the sections are still arriving. */
export const SectionsLoading: Story = {
  args: {
    ...BASE,
    lines: { data: undefined, isLoading: true },
    usage: { data: undefined, isLoading: true },
    invoices: { data: undefined, isLoading: true },
    entitlements: { data: undefined, isLoading: true },
    creditGrants: { data: undefined, isLoading: true },
    schedules: { data: undefined, isLoading: true },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1 })).toBeVisible()
    await userEvent.click(canvas.getByRole('tab', { name: /Invoices/ }))
    await expect(canvas.getByRole('heading', { name: 'Invoices' })).toBeVisible()
  },
}

export const SectionFailed: Story = {
  args: { ...BASE, invoices: { data: undefined, isError: true, onRetry: fn() } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: /Invoices/ }))
    await expect(await canvas.findByText('Invoices could not be loaded')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }))
  },
}
