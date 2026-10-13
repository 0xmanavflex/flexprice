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
  BillingModel,
  BillingPeriod,
  NO_USAGE_TERMS,
  TierMode,
  money,
  FeatureType,
  type CreditGrant,
  type IntegrationLink,
  type Invoice,
  type InvoicePreview,
  type SubscriptionAddon,
  type SubscriptionCoupon,
  type SubscriptionTax,
  type SubscriptionDetail,
  type SubscriptionEntitlement,
  type LinePricing,
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

const flat = (): LinePricing => ({
  billingModel: BillingModel.FlatFee,
  tierMode: null,
  tiers: [],
  divideBy: null,
  priceUnit: '',
  meterId: '',
  billingPeriod: BillingPeriod.Monthly,
  currency: 'USD',
  terms: NO_USAGE_TERMS,
})

const METERS = [{ id: 'meter_api', name: 'API requests', unit: 'request' }]

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
    pricing: flat(),
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
    pricing: {
      billingModel: BillingModel.Tiered,
      tierMode: TierMode.Slab,
      tiers: [
        { upTo: 1_000_000, unitAmount: '0.002' },
        { upTo: null, unitAmount: '0.001' },
      ],
      divideBy: null,
      priceUnit: '',
      meterId: 'meter_api',
      billingPeriod: BillingPeriod.Monthly,
      currency: 'USD',
      terms: {
        bucketSize: 'DAY',
        commitment: {
          kind: 'amount',
          value: '500',
          windowed: false,
          overageFactor: '1.5',
          trueUp: false,
        },
      },
    },
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
    pricing: flat(),
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

const PREVIEW: InvoicePreview = {
  periodStart: date('2026-10-01'),
  periodEnd: date('2026-11-01'),
  lines: [
    {
      id: 'pl_1',
      name: 'Platform fee',
      detail: 'Oct 1 – Nov 1',
      quantity: '1',
      amount: money('1500', 'USD'),
      kind: 'fixed',
    },
    {
      id: 'pl_2',
      name: 'API requests',
      detail: '920,250 requests',
      quantity: '920250',
      amount: money('1840.5', 'USD'),
      kind: 'usage',
    },
    {
      id: 'pl_3',
      name: 'Onboarding',
      detail: 'Oct 1 – Nov 1',
      quantity: '1',
      amount: money('250', 'USD'),
      kind: 'fixed',
    },
    {
      id: 'pl_4',
      name: 'Seat overage',
      detail: 'No usage this period',
      quantity: '0',
      amount: money('0', 'USD'),
      kind: 'usage',
    },
  ],
  subtotal: money('3590.5', 'USD'),
  discount: money('359.05', 'USD'),
  tax: money('258.51', 'USD'),
  prepaidCredits: money('100', 'USD'),
  amountDue: money('3389.96', 'USD'),
}

const ADDONS: SubscriptionAddon[] = [
  {
    id: 'sa_1',
    name: 'Priority support',
    active: true,
    startDate: date('2026-04-01'),
    endDate: null,
  },
  {
    id: 'sa_2',
    name: 'Extra seats',
    active: false,
    startDate: date('2026-03-01'),
    endDate: date('2026-08-31'),
  },
]

const COUPONS: SubscriptionCoupon[] = [
  {
    id: 'sc_1',
    name: 'Launch partner',
    code: 'LAUNCH10',
    discount: '10% off',
    active: true,
    startDate: date('2026-03-01'),
    endDate: date('2027-03-01'),
  },
]

const TAXES: SubscriptionTax[] = [
  {
    id: 'st_1',
    name: 'VAT',
    code: 'VAT-DE',
    percentage: '7.2%',
    inclusive: false,
    priority: 1,
  },
]

const INTEGRATION_LINKS: IntegrationLink[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    providerType: 'stripe',
    mappingId: 'map_1',
    providerEntityId: 'cus_Qx81nKd02',
    createdAt: date('2026-03-04'),
    updatedAt: date('2026-09-18'),
  },
]

const BASE: SubscriptionDetailViewProps = {
  subscription: SUBSCRIPTION,
  lines: ready(LINES),
  entitlements: ready(ENTITLEMENTS),
  creditGrants: ready(GRANTS),
  usage: ready(USAGE),
  invoices: ready(INVOICES),
  schedules: ready([]),
  preview: ready(PREVIEW),
  addons: ready(ADDONS),
  coupons: ready(COUPONS),
  taxes: ready(TAXES),
  integrationLinks: INTEGRATION_LINKS,
  linkableProviders: [{ providerType: 'quickbooks', name: 'QuickBooks' }],
  onLinkIntegration: fn(async () => undefined),
  onUnlinkIntegration: fn(async () => undefined),
  onAddEntitlement: fn(async () => undefined),
  onAddCreditGrant: fn(async () => undefined),
  onAddAddon: fn(async () => undefined),
  onAddCoupon: fn(async () => undefined),
  onAddTax: fn(async () => undefined),
  sectionOptions: {
    features: [{ id: 'feat_seats', name: 'Seats', type: FeatureType.Static }],
    addons: [{ id: 'addon_support', name: 'Priority support' }],
    coupons: [{ code: 'LAUNCH10', name: 'Launch 10% off' }],
    taxRates: [{ code: 'VAT-DE', label: 'VAT (7.2%)' }],
  },
  activity: ACTIVITY,
  onBack: fn(),
  onOpenCustomer: fn(),
  onOpenPlan: fn(),
  onOpenInvoice: fn(),
  onActivate: fn(),
  onCancel: fn(),
  meters: METERS,
  priceUnits: [],
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

/** One contract: lifecycle banners, four tabs, an Overview that runs from contract details to taxes, and an Activity, Metadata, Related rail. */
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
    await expect(canvas.getAllByRole('tab')).toHaveLength(4)
    await expect(canvas.queryByRole('tab', { name: /Entitlements/ })).toBeNull()
    await expect(canvas.queryByRole('tab', { name: 'Schedule' })).toBeNull()
    await expect(canvas.queryByRole('tab', { name: 'Activity' })).toBeNull()
    await expect(canvas.getByRole('heading', { name: 'Activity' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Metadata' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Related' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Contract details' })).toBeVisible()
    await expect(canvas.getByText('Plan started on')).toBeVisible()
    await expect(canvas.queryByRole('heading', { name: 'Recent invoices' })).toBeNull()
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
    await expect(canvas.getAllByText('Ended').length).toBeGreaterThan(0)
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
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/trial ends on Oct 15, 2026/)).toBeVisible()
    await expect(canvas.getByText('Billing starts after the trial')).toBeVisible()
    await expect(canvas.queryByText('Amount due')).toBeNull()
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

/** Charges is a standard grid: search, sort, facets, and a Manage pricing action. */
export const ChargesTab: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: /Charges/ }))
    await expect(await canvas.findByText('Platform fee')).toBeVisible()
    await expect(canvas.getByText('$1,500.00')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Manage pricing' })).toBeVisible()
    await expect(canvas.getByRole('textbox', { name: /^Search/ })).toBeVisible()
    // Each charge says where it comes from.
    await expect(canvas.getAllByText('Plan').length).toBeGreaterThan(0)
    await expect(canvas.getAllByText('Contract').length).toBeGreaterThan(0)
    await expect(canvas.queryByText(/shared by every contract/)).toBeNull()
    await expect(canvas.queryByRole('heading', { name: 'Activity' })).toBeNull()
    await expect(canvas.queryByRole('heading', { name: 'Metadata' })).toBeNull()
  },
}

const openPricing = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement)
  const tab = canvas.getByRole('tab', { name: /Charges/ })
  await userEvent.click(tab)
  await waitFor(() => expect(tab).toHaveAttribute('aria-selected', 'true'))
  await canvas.findByText('Platform fee')
  return canvas
}

/** Overview runs contract details, upcoming invoice, overridden charges, entitlements, grants, add-ons, coupons, taxes. */
export const OverviewSummary: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const order = [
      'Contract details',
      'Upcoming invoice',
      'Overridden charges',
      'Entitlements',
      'Credit grants',
      'Add-ons',
      'Coupons',
      'Taxes',
    ]
    const headings = await Promise.all(order.map((name) => canvas.findByRole('heading', { name })))
    headings.forEach((heading, index) => {
      const next = headings[index + 1]
      if (next) {
        expect(
          heading.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy()
      }
    })
    // Charges no longer sit on Overview unless the contract overrides the plan.
    await expect(canvas.queryByRole('heading', { name: 'Charges' })).toBeNull()
    await expect(canvas.queryByRole('heading', { name: 'Billing & collection' })).toBeNull()
    // The overridden charges hand off to the Charges tab.
    await userEvent.click(canvas.getByRole('button', { name: 'Manage pricing' }))
    await waitFor(() =>
      expect(canvas.getByRole('tab', { name: /Charges/ })).toHaveAttribute('aria-selected', 'true'),
    )
  },
}

/** Overview lists only what the contract changed from its plan. */
export const OverriddenCharges: Story = {
  play: async ({ canvasElement }) => {
    const section = within(
      (await within(canvasElement).findByRole('heading', { name: 'Overridden charges' })).closest(
        'section',
      )!,
    )
    await expect(section.getByText('Onboarding')).toBeVisible()
    await expect(section.queryByText('Platform fee')).toBeNull()
  },
}

/** A contract that follows its plan has no Overridden charges section at all. */
export const NoOverriddenCharges: Story = {
  args: { ...BASE, lines: ready(LINES.filter((line) => line.source === 'plan')) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('heading', { name: 'Entitlements' })).toBeVisible()
    await expect(canvas.queryByRole('heading', { name: 'Overridden charges' })).toBeNull()
  },
}

/** The preview is the next invoice: lines, then subtotal, discount, tax, prepaid credits and amount due. */
export const UpcomingInvoice: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const section = within(
      (await canvas.findByRole('heading', { name: 'Upcoming invoice' })).closest('section')!,
    )
    await expect(section.getByText('Oct 1, 2026 – Nov 1, 2026')).toBeVisible()
    await expect(section.getByText('API requests')).toBeVisible()
    await expect(section.getByText('920,250 requests')).toBeVisible()
    await expect(section.getByText('$1,840.50')).toBeVisible()
    await expect(section.getByText('Subtotal')).toBeVisible()
    await expect(section.getByText('Discount')).toBeVisible()
    await expect(section.getByText('−$359.05')).toBeVisible()
    await expect(section.getByText('Tax')).toBeVisible()
    await expect(section.getByText('Prepaid credits')).toBeVisible()
    await expect(section.getByText('Amount due')).toBeVisible()
    await expect(section.getByText('$3,389.96')).toBeVisible()
  },
}

/** Discount, tax and prepaid credits only appear when there is something to show. */
export const UpcomingInvoicePlain: Story = {
  args: {
    ...BASE,
    preview: ready({
      ...PREVIEW,
      lines: PREVIEW.lines.slice(0, 1),
      subtotal: money('1500', 'USD'),
      discount: money('0', 'USD'),
      tax: money('0', 'USD'),
      prepaidCredits: money('0', 'USD'),
      amountDue: money('1500', 'USD'),
    }),
  },
  play: async ({ canvasElement }) => {
    const section = within(
      (await within(canvasElement).findByRole('heading', { name: 'Upcoming invoice' })).closest(
        'section',
      )!,
    )
    await expect(section.getByText('Amount due')).toBeVisible()
    await expect(section.queryByText('Discount')).toBeNull()
    await expect(section.queryByText('Tax')).toBeNull()
    await expect(section.queryByText('Prepaid credits')).toBeNull()
  },
}

export const UpcomingInvoiceAllZero: Story = {
  args: {
    ...BASE,
    preview: ready({
      ...PREVIEW,
      lines: [],
      subtotal: money('0', 'USD'),
      discount: money('0', 'USD'),
      tax: money('0', 'USD'),
      prepaidCredits: money('0', 'USD'),
      amountDue: money('0', 'USD'),
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Nothing to bill yet')).toBeVisible()
  },
}

export const UpcomingInvoiceLoading: Story = {
  args: { ...BASE, preview: { data: undefined, isLoading: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('heading', { name: 'Upcoming invoice' })).toBeVisible()
    await expect(canvas.queryByText('Amount due')).toBeNull()
  },
}

export const UpcomingInvoiceFailed: Story = {
  args: { ...BASE, preview: { data: undefined, isError: true, onRetry: fn() } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('The invoice preview could not be loaded')).toBeVisible()
    await userEvent.click(canvas.getAllByRole('button', { name: 'Try again' })[0]!)
  },
}

/** A cancelled or not-yet-started contract has no next invoice. */
export const NoUpcomingInvoiceWhenCancelled: Story = {
  args: withSubscription({
    status: SubscriptionStatus.Cancelled,
    cancelledAt: date('2026-09-15'),
    endDate: date('2026-09-15'),
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('heading', { name: 'Contract details' })).toBeVisible()
    await expect(canvas.queryByRole('heading', { name: 'Upcoming invoice' })).toBeNull()
  },
}

export const NoUpcomingInvoiceWhenIncomplete: Story = {
  args: withSubscription({ status: SubscriptionStatus.Incomplete, currentPeriodStart: null }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('heading', { name: 'Contract details' })).toBeVisible()
    await expect(canvas.queryByRole('heading', { name: 'Upcoming invoice' })).toBeNull()
  },
}

/** The first row of facts, then payment terms, time zone and commitment. */
export const ContractDetails: Story = {
  play: async ({ canvasElement }) => {
    const section = within(
      (await within(canvasElement).findByRole('heading', { name: 'Contract details' })).closest(
        'section',
      )!,
    )
    await expect(section.getByText('Plan started on')).toBeVisible()
    await expect(section.getByText('Mar 1, 2026')).toBeVisible()
    await expect(section.getByText('Current period')).toBeVisible()
    await expect(section.getByText('Collection')).toBeVisible()
    await expect(section.getByText('Billing cycle')).toBeVisible()
    await expect(section.getByText('Payment terms')).toBeVisible()
    await expect(section.getByText('Time zone')).toBeVisible()
    await expect(section.getByText('Commitment')).toBeVisible()
    await expect(section.getByText(/\$2,500\.00/)).toBeVisible()
  },
}

export const AddonsCouponsTaxes: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Priority support')).toBeVisible()
    await expect(canvas.getByText('Extra seats')).toBeVisible()
    await expect(canvas.getByText('LAUNCH10')).toBeVisible()
    await expect(canvas.getByText('10% off')).toBeVisible()
    await expect(canvas.getByText('VAT')).toBeVisible()
    await expect(canvas.getByText('7.2%')).toBeVisible()
    await expect(canvas.getByText('Added on top')).toBeVisible()
  },
}

/** Empty sections stay on the page, each with its own centred Add button. */
export const AddonsCouponsTaxesEmpty: Story = {
  args: {
    ...BASE,
    entitlements: ready([]),
    creditGrants: ready([]),
    addons: ready([]),
    coupons: ready([]),
    taxes: ready([]),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('No add-ons')).toBeVisible()
    await expect(canvas.getByText('No coupons')).toBeVisible()
    await expect(canvas.getByText('No taxes')).toBeVisible()
    for (const name of [
      'Add entitlement',
      'Add credit grant',
      'Add add-on',
      'Add coupon',
      'Add tax',
    ]) {
      await expect(canvas.getByRole('button', { name })).toBeVisible()
    }
  },
}

/** Pages that do not load add-ons, coupons or taxes still show the sections, empty. */
export const WithoutAddonsCouponsTaxes: Story = {
  args: { ...BASE, addons: undefined, coupons: undefined, taxes: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('heading', { name: 'Add-ons' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Coupons' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Taxes' })).toBeVisible()
  },
}

/** With data the same button moves to the section's top right. */
export const SectionAddButtons: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const [heading, name] of [
      ['Entitlements', 'Add entitlement'],
      ['Credit grants', 'Add credit grant'],
      ['Add-ons', 'Add add-on'],
      ['Coupons', 'Add coupon'],
      ['Taxes', 'Add tax'],
    ] as const) {
      const section = within(
        (await canvas.findByRole('heading', { name: heading })).closest('section')!,
      )
      await expect(section.getByRole('button', { name })).toBeVisible()
    }
  },
}

/** A cancelled contract cannot be changed, so the Add buttons go away. */
export const SectionAddButtonsCancelled: Story = {
  args: withSubscription({ status: SubscriptionStatus.Cancelled }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('heading', { name: 'Taxes' })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Add tax' })).toBeNull()
    await expect(canvas.queryByRole('button', { name: 'Add coupon' })).toBeNull()
  },
}

export const AddAddon: Story = {
  parameters: menuA11y,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Add add-on' }))
    const dialog = within(await screen.findByRole('dialog'))
    await userEvent.click(dialog.getByRole('combobox', { name: /Add-on/ }))
    await userEvent.click(await screen.findByRole('option', { name: 'Priority support' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Add add-on' }))
    await waitFor(() => expect(args.onAddAddon).toHaveBeenCalledWith({ addonId: 'addon_support' }))
  },
}

export const AddCoupon: Story = {
  parameters: menuA11y,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Add coupon' }))
    const dialog = within(await screen.findByRole('dialog'))
    await userEvent.click(dialog.getByRole('combobox', { name: /Coupon/ }))
    await userEvent.click(await screen.findByRole('option', { name: 'Launch 10% off' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Add coupon' }))
    await waitFor(() => expect(args.onAddCoupon).toHaveBeenCalledWith({ couponCode: 'LAUNCH10' }))
  },
}

export const AddCouponNeedsChoice: Story = {
  parameters: menuA11y,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Add coupon' }))
    const dialog = within(await screen.findByRole('dialog'))
    await userEvent.click(dialog.getByRole('button', { name: 'Add coupon' }))
    await expect(await dialog.findByRole('alert')).toHaveTextContent('Choose a coupon')
    await expect(args.onAddCoupon).not.toHaveBeenCalled()
  },
}

export const AddTaxDialog: Story = {
  parameters: menuA11y,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Add tax' }))
    const dialog = within(await screen.findByRole('dialog'))
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible()
  },
}

export const AddEntitlementDialog: Story = {
  parameters: menuA11y,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Add entitlement' }))
    await expect(
      within(await screen.findByRole('dialog')).getByRole('heading', { name: 'Add entitlement' }),
    ).toBeVisible()
  },
}

export const AddCreditGrantDialog: Story = {
  parameters: menuA11y,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Add credit grant' }))
    await expect(
      within(await screen.findByRole('dialog')).getByRole('heading', { name: 'Add credit grant' }),
    ).toBeVisible()
  },
}

/** Five lines show; More reveals the rest, and there is no pagination. */
export const UpcomingInvoiceManyLines: Story = {
  args: {
    ...BASE,
    preview: ready({
      ...PREVIEW,
      lines: Array.from({ length: 8 }, (_, index) => ({
        id: `pl_${index}`,
        name: `Line item ${index + 1}`,
        detail: 'Oct 1 – Nov 1',
        quantity: '1',
        amount: money('10', 'USD'),
        kind: 'fixed' as const,
      })),
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const section = within(
      (await canvas.findByRole('heading', { name: 'Upcoming invoice' })).closest('section')!,
    )
    await expect(section.getByText('Line item 5')).toBeVisible()
    await expect(section.queryByText('Line item 6')).toBeNull()
    await userEvent.click(section.getByRole('button', { name: 'Show 3 more' }))
    await expect(section.getByText('Line item 8')).toBeVisible()
    await expect(section.queryByRole('navigation')).toBeNull()
    await userEvent.click(section.getByRole('button', { name: 'Show fewer lines' }))
    await expect(section.queryByText('Line item 6')).toBeNull()
  },
}

/** Marks sit by the contract ID; hover shows the provider-side detail. */
export const HeaderIntegrations: Story = {
  parameters: menuA11y,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const mark = await canvas.findByRole('button', { name: 'Stripe integration' })
    await userEvent.hover(mark)
    const id = await screen.findByText('cus_Qx81nKd02')
    const tip = within(id.closest('dl')!)
    await expect(tip.getByText('Created')).toBeVisible()
    await expect(tip.getByText('Updated')).toBeVisible()
    await expect(tip.getByText('Sep 18, 2026', { exact: false })).toBeVisible()
  },
}

export const UnlinkIntegration: Story = {
  parameters: menuA11y,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Stripe integration' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Unlink Stripe' }))
    const dialog = within(await screen.findByRole('dialog'))
    await userEvent.click(dialog.getByRole('button', { name: 'Unlink' }))
    await waitFor(() =>
      expect(args.onUnlinkIntegration).toHaveBeenCalledWith({ providerType: 'stripe' }),
    )
  },
}

export const LinkIntegration: Story = {
  parameters: menuA11y,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Link an integration' }))
    const dialog = within(await screen.findByRole('dialog'))
    await userEvent.type(dialog.getByLabelText(/Customer ID at the provider/), 'qb_42')
    await userEvent.click(dialog.getByRole('button', { name: 'Link' }))
    await waitFor(() =>
      expect(args.onLinkIntegration).toHaveBeenCalledWith({
        providerType: 'quickbooks',
        providerEntityId: 'qb_42',
      }),
    )
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

/** Add a fixed charge: the full charge form plus quantity, start date and proration. */
export const AddCharge: Story = {
  parameters: menuA11y,
  play: async ({ canvasElement, args }) => {
    const canvas = await openPricing(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Manage pricing' }))
    // Fixed or usage first, then the form for that type.
    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    const dialog = within(await screen.findByRole('dialog'))
    await dialog.findByLabelText(/^Amount/)
    // The contract's currency is fixed.
    await expect(dialog.getByLabelText(/^Currency/)).toBeDisabled()
    // Empty fields are refused, not sent.
    await userEvent.click(dialog.getByRole('button', { name: 'Add charge' }))
    await expect(args.onAddCharge).not.toHaveBeenCalled()
    await userEvent.type(dialog.getByLabelText('Display name'), 'Premium support')
    await userEvent.type(dialog.getByLabelText(/^Amount/), '400')
    const quantity = dialog.getByLabelText(/^Quantity/)
    await userEvent.clear(quantity)
    await userEvent.type(quantity, '0')
    await userEvent.click(dialog.getByRole('button', { name: 'Add charge' }))
    await expect(await dialog.findByText('Enter a whole number of 1 or more.')).toBeVisible()
    await expect(args.onAddCharge).not.toHaveBeenCalled()
    await userEvent.clear(quantity)
    await userEvent.type(quantity, '3')
    await userEvent.click(dialog.getByRole('button', { name: 'Add charge' }))
    await expect(args.onAddCharge).toHaveBeenCalledWith({
      charge: expect.objectContaining({
        type: 'FIXED',
        billingModel: 'FLAT_FEE',
        displayName: 'Premium support',
        amount: '400',
        currency: 'USD',
        billingPeriod: 'MONTHLY',
      }),
      quantity: '3',
      startDate: '',
      proration: 'create_prorations',
      terms: NO_USAGE_TERMS,
    })
  },
}

/** Add a metered charge: meter, pricing model, bucket size and a commitment. */
export const AddUsageCharge: Story = {
  parameters: menuA11y,
  play: async ({ canvasElement, args }) => {
    const canvas = await openPricing(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Manage pricing' }))
    await userEvent.click(await screen.findByRole('radio', { name: /Usage/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    const dialog = within(await screen.findByRole('dialog'))
    await userEvent.click(await dialog.findByRole('combobox', { name: /Metered feature/ }))
    await userEvent.click(await screen.findByRole('option', { name: /API requests/ }))
    await userEvent.type(dialog.getByLabelText(/^Amount/), '0.002')
    // Usage terms exist only on a metered charge; quantity does not.
    await expect(dialog.queryByLabelText(/^Quantity/)).toBeNull()
    await userEvent.click(dialog.getByRole('checkbox', { name: 'Add a commitment' }))
    await userEvent.type(dialog.getByLabelText(/^Commitment/), '500')
    // A commitment needs a value above zero.
    await userEvent.clear(dialog.getByLabelText(/^Overage factor/))
    await userEvent.type(dialog.getByLabelText(/^Overage factor/), '0.5')
    await userEvent.click(dialog.getByRole('button', { name: 'Add charge' }))
    await expect(
      await dialog.findByText('Enter 1 or more. 1 means no overage premium.'),
    ).toBeVisible()
    await expect(args.onAddCharge).not.toHaveBeenCalled()
    await userEvent.clear(dialog.getByLabelText(/^Overage factor/))
    await userEvent.type(dialog.getByLabelText(/^Overage factor/), '1.5')
    await userEvent.click(dialog.getByRole('button', { name: 'Add charge' }))
    await expect(args.onAddCharge).toHaveBeenCalledWith({
      charge: expect.objectContaining({
        type: 'USAGE',
        billingModel: 'FLAT_FEE',
        meterId: 'meter_api',
        amount: '0.002',
      }),
      quantity: '1',
      startDate: '',
      proration: 'create_prorations',
      terms: {
        bucketSize: '',
        commitment: {
          kind: 'amount',
          value: '500',
          windowed: false,
          overageFactor: '1.5',
          trueUp: false,
        },
      },
    })
  },
}

/** Edit a metered charge: the form opens on its own price, bucket and commitment. */
export const EditUsageCharge: Story = {
  parameters: menuA11y,
  play: async ({ canvasElement, args }) => {
    const canvas = await openPricing(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for API requests' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    const dialog = within(await screen.findByRole('dialog'))
    await expect(await dialog.findByText('Only this contract changes')).toBeVisible()
    await expect(dialog.getByText(/the plan keeps its price/)).toBeVisible()
    // Currency, period and meter cannot change on an existing charge.
    await expect(dialog.getByLabelText('Display name')).toBeDisabled()
    await expect(dialog.getByLabelText(/^Currency/)).toBeDisabled()
    // Starts on the line's own commitment.
    await expect(dialog.getByLabelText(/^Commitment/)).toHaveValue('500')
    await expect(dialog.getByLabelText(/^Overage factor/)).toHaveValue('1.5')
    const commitment = dialog.getByLabelText(/^Commitment/)
    await userEvent.clear(commitment)
    await userEvent.type(commitment, '800')
    await userEvent.click(dialog.getByRole('button', { name: 'Save charge' }))
    await expect(args.onEditCharge).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'line_2' }),
      expect.objectContaining({
        price: expect.objectContaining({
          priceId: 'price_api',
          billingModel: 'TIERED',
          tierMode: 'SLAB',
        }),
        effectiveFrom: '',
        terms: expect.objectContaining({
          bucketSize: 'DAY',
          commitment: expect.objectContaining({ value: '800', overageFactor: '1.5' }),
        }),
      }),
    )
  },
}

/** A fixed charge is edited through its quantity: the form, then the API's preview, then confirm. */
export const ChangeQuantity: Story = {
  parameters: menuA11y,
  play: async ({ canvasElement, args }) => {
    const canvas = await openPricing(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for Platform fee' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))
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

/** Usage charges open the price form, not the quantity dialog. */
export const UsageChargeHasNoQuantityChange: Story = {
  parameters: menuA11y,
  play: async ({ canvasElement }) => {
    const canvas = await openPricing(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for API requests' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    const dialog = within(await screen.findByRole('dialog'))
    await expect(await dialog.findByText('Bucket size')).toBeVisible()
    await expect(dialog.queryByRole('button', { name: 'Preview change' })).toBeNull()
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
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))
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
    await expect(canvas.queryByRole('button', { name: 'Manage pricing' })).toBeNull()
    await expect(canvas.queryByRole('button', { name: /^Actions for/ })).toBeNull()
  },
}

/** A contract still in its trial takes no new charges, but existing ones stay editable. */
export const TrialingCannotAddCharge: Story = {
  args: withSubscription({ status: SubscriptionStatus.Trialing }),
  play: async ({ canvasElement }) => {
    const canvas = await openPricing(canvasElement)
    await expect(canvas.queryByRole('button', { name: 'Manage pricing' })).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Actions for Platform fee' })).toBeVisible()
  },
}

/** Without handlers the Charges tab is read-only. */
export const PricingWithoutEditing: Story = {
  args: { onAddCharge: undefined, onEditCharge: undefined, onEndCharge: undefined },
  play: async ({ canvasElement }) => {
    const canvas = await openPricing(canvasElement)
    await expect(canvas.queryByRole('button', { name: 'Manage pricing' })).toBeNull()
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
    await userEvent.click(canvas.getByRole('tab', { name: 'Usage' }))
    await expect(await canvas.findByText('Usage to date')).toBeVisible()
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

/** Entitlements and credit grants sit on Overview, below the charges. */
export const EntitlementsAndCredits: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
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
    preview: { data: undefined, isLoading: true },
    addons: { data: undefined, isLoading: true },
    coupons: { data: undefined, isLoading: true },
    taxes: { data: undefined, isLoading: true },
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
