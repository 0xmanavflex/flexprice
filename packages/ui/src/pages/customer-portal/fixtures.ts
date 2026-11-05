import {
  type PortalCustomer,
  type PortalGateway,
  type PortalInvoice,
  type PortalPaymentMethod,
  type PortalQuota,
  type PortalSpend,
  type PortalSubscription,
  type PortalTopUp,
  type PortalWallet,
  type PortalWalletTransaction,
  money,
  walletFlows,
} from '@fp/domain'
import type { CustomerPortalActions, CustomerPortalData } from './types'

/** The reference portal's account: Northwind Labs, a customer of Massio. */
export const PORTAL_NOW = new Date(2026, 9, 5, 12)

const usd = (amount: string) => money(amount, 'USD')
const d = (iso: string) => new Date(`${iso}T00:00:00`)

export const portalCustomer: PortalCustomer = {
  id: 'cus_northwind',
  name: 'Northwind Labs',
  email: 'billing@northwind.dev',
  initials: 'NL',
}

export const portalSubscriptions: PortalSubscription[] = [
  {
    id: 'sub_growth',
    planName: 'Growth',
    status: 'active',
    statusLabel: 'Active',
    cadence: 'Billed monthly',
    periodStart: d('2026-09-12'),
    periodEnd: d('2026-10-12'),
    trialEnd: null,
    cancelAt: null,
  },
  {
    id: 'sub_voice',
    planName: 'Voice add-on',
    status: 'trialing',
    statusLabel: 'Trial',
    cadence: 'Billed monthly',
    periodStart: d('2026-09-28'),
    periodEnd: d('2026-10-28'),
    trialEnd: d('2026-10-12'),
    cancelAt: null,
  },
]

const invoice = (
  overrides: Partial<PortalInvoice> & Pick<PortalInvoice, 'id' | 'number' | 'status'>,
): PortalInvoice => ({
  currency: 'USD',
  issuedAt: d('2026-09-12'),
  dueAt: d('2026-09-26'),
  paidAt: null,
  periodStart: d('2026-08-12'),
  periodEnd: d('2026-09-12'),
  subtotal: usd('512.40'),
  discount: null,
  tax: null,
  total: usd('512.40'),
  amountPaid: usd('0'),
  amountDue: usd('512.40'),
  lines: [],
  ...overrides,
})

export const portalInvoices: PortalInvoice[] = [
  invoice({
    id: 'inv_01488',
    number: 'INV-2026-01488',
    status: 'failed',
    subtotal: usd('474.44'),
    tax: usd('37.96'),
    lines: [
      { id: 'l1', name: 'Growth plan', kind: 'Fixed', quantity: '1', amount: usd('249') },
      { id: 'l2', name: 'API calls', kind: 'Usage', quantity: '842100', amount: usd('168.42') },
      { id: 'l3', name: 'Storage', kind: 'Usage', quantity: '1140', amount: usd('57.02') },
    ],
  }),
  ...['01377', '01261', '01149', '01036'].map((n, i) =>
    invoice({
      id: `inv_${n}`,
      number: `INV-2026-${n}`,
      status: 'paid',
      issuedAt: new Date(2026, 7 - i, 12),
      dueAt: new Date(2026, 7 - i, 26),
      periodStart: new Date(2026, 6 - i, 12),
      periodEnd: new Date(2026, 7 - i, 12),
      total: usd(['486.10', '455.82', '431.00', '402.77'][i] ?? '400'),
      amountPaid: usd(['486.10', '455.82', '431.00', '402.77'][i] ?? '400'),
      amountDue: usd('0'),
    }),
  ),
  invoice({
    id: 'inv_00921',
    number: 'INV-2026-00921',
    status: 'void',
    issuedAt: d('2026-03-12'),
    total: usd('120'),
    amountDue: usd('0'),
  }),
]

export const portalWallets: PortalWallet[] = [
  {
    id: 'wal_prepaid',
    name: 'Prepaid credits',
    active: true,
    statusLabel: 'Active',
    currency: 'USD',
    balance: usd('1864'),
    credits: '18640',
    creditPrice: '0.1',
    autoTopup: { enabled: true, threshold: '2000', credits: '5000', cooldown: null },
  },
]

export const portalTransactions: PortalWalletTransaction[] = [
  {
    id: 't1',
    direction: 'out',
    title: 'Invoice payment',
    detail: 'INV-2026-01488',
    at: d('2026-09-12'),
    amount: usd('412'),
    credits: '4120',
    pending: false,
    failed: false,
    remaining: null,
    expiresAt: null,
  },
  {
    id: 't2',
    direction: 'in',
    title: 'Plan credits',
    detail: 'Growth plan · monthly grant',
    at: d('2026-09-12'),
    amount: usd('200'),
    credits: '2000',
    pending: false,
    failed: false,
    remaining: null,
    expiresAt: null,
  },
  {
    id: 't3',
    direction: 'out',
    title: 'Credits expired',
    detail: 'August grant',
    at: d('2026-09-12'),
    amount: usd('38'),
    credits: '380',
    pending: false,
    failed: false,
    remaining: null,
    expiresAt: null,
  },
  {
    id: 't4',
    direction: 'in',
    title: 'Credits purchased',
    detail: 'Auto top-up · Visa •••• 4242',
    at: d('2026-08-30'),
    amount: usd('500'),
    credits: '5000',
    pending: false,
    failed: false,
    remaining: null,
    expiresAt: null,
  },
  {
    id: 't5',
    direction: 'in',
    title: 'Credits purchased',
    detail: 'Razorpay checkout',
    at: d('2026-08-28'),
    amount: usd('250'),
    credits: '2500',
    pending: false,
    failed: true,
    remaining: null,
    expiresAt: null,
  },
]

export const portalTopUps: PortalTopUp[] = [
  {
    id: 'tu-plan',
    title: 'Plan credits',
    detail: 'Growth plan · monthly grant',
    at: d('2026-09-12'),
    granted: '2000',
    remaining: '1380',
    consumed: 0.31,
    expiresAt: d('2026-10-12'),
    daysLeft: 7,
    state: 'expiring soon',
  },
  {
    id: 'tu-sep',
    title: 'Credits purchased',
    detail: 'Auto top-up · Visa •••• 4242',
    at: d('2026-09-04'),
    granted: '10000',
    remaining: '9840',
    consumed: 0.016,
    expiresAt: null,
    daysLeft: null,
    state: 'active',
  },
  {
    id: 'tu-aug',
    title: 'Credits purchased',
    detail: 'Stripe checkout',
    at: d('2026-08-02'),
    granted: '10000',
    remaining: '7270',
    consumed: 0.273,
    expiresAt: null,
    daysLeft: null,
    state: 'active',
  },
  {
    id: 'tu-free',
    title: 'Free credits',
    detail: 'Welcome credits',
    at: d('2026-07-20'),
    granted: '5000',
    remaining: '0',
    consumed: 1,
    expiresAt: null,
    daysLeft: null,
    state: 'used up',
  },
]

export const portalCards: PortalPaymentMethod[] = [
  {
    id: 'pm_visa',
    provider: 'stripe',
    brand: 'Visa',
    network: 'visa',
    last4: '4242',
    expires: '08/28',
    expired: false,
    isDefault: true,
    canAutoCharge: true,
  },
  {
    id: 'pm_mc',
    provider: 'stripe',
    brand: 'Mastercard',
    network: 'mastercard',
    last4: '5100',
    expires: '03/27',
    expired: false,
    isDefault: false,
    canAutoCharge: true,
  },
  {
    id: 'pm_amex',
    provider: 'stripe',
    brand: 'American Express',
    network: 'amex',
    last4: '0005',
    expires: '06/26',
    expired: true,
    isDefault: false,
    canAutoCharge: true,
  },
]

export const portalGateways: PortalGateway[] = [
  {
    provider: 'stripe',
    label: 'Stripe',
    paysInvoices: true,
    checkout: true,
    savesCards: true,
    autoCharge: true,
  },
  {
    provider: 'razorpay',
    label: 'Razorpay',
    paysInvoices: true,
    checkout: true,
    savesCards: false,
    autoCharge: false,
  },
]

export const portalQuotas: PortalQuota[] = [
  {
    featureId: 'f_api',
    name: 'API calls',
    unit: 'calls',
    used: '842100',
    limit: '1000000',
    unlimited: false,
    percent: 84.21,
    over: null,
    resetsAt: d('2026-10-12'),
  },
  {
    featureId: 'f_tokens',
    name: 'AI tokens',
    unit: 'tokens',
    used: '6400000',
    limit: '5000000',
    unlimited: false,
    percent: 128,
    over: '1400000',
    resetsAt: d('2026-10-12'),
  },
  {
    featureId: 'f_seats',
    name: 'Storage',
    unit: 'GB',
    used: '1140',
    limit: null,
    unlimited: true,
    percent: 0,
    over: null,
    resetsAt: null,
  },
]

function series(total: number, seed: number) {
  return Array.from({ length: 30 }, (_, i) => {
    const wave = 0.75 + 0.35 * Math.sin((i + seed) / 3) + (i % 7 === 5 ? 0.3 : 0)
    const cost = Math.round((total / 30) * wave * 100) / 100
    return { at: new Date(2026, 8, 6 + i), usage: Math.round(cost * 5000), cost }
  })
}

export const portalSpend: PortalSpend = {
  currency: 'USD',
  total: usd('393.42'),
  items: [
    {
      featureId: 'f_api',
      name: 'API calls',
      group: 'Platform',
      unit: 'calls',
      usage: '842100',
      cost: usd('168.42'),
      unitCost: usd('0.0002'),
      unitCostIsAverage: false,
      share: 0.428,
      points: series(168.42, 0),
    },
    {
      featureId: 'f_tokens',
      name: 'AI tokens',
      group: 'AI',
      unit: 'tokens',
      usage: '6400000',
      cost: usd('128'),
      unitCost: usd('0.00002'),
      unitCostIsAverage: false,
      share: 0.325,
      points: series(128, 2),
    },
    {
      featureId: 'f_storage',
      name: 'Storage',
      group: 'Platform',
      unit: 'GB',
      usage: '1140',
      cost: usd('57.02'),
      unitCost: usd('0.05'),
      unitCostIsAverage: false,
      share: 0.145,
      points: series(57.02, 4),
    },
    {
      featureId: 'f_voice',
      name: 'Voice minutes',
      group: 'AI',
      unit: 'minutes',
      usage: '2000',
      cost: usd('39.98'),
      // A tiered price: the period's effective rate.
      unitCost: usd('0.01999'),
      unitCostIsAverage: true,
      share: 0.102,
      points: series(39.98, 6),
    },
  ],
}

export const portalData: CustomerPortalData = {
  customer: { status: 'ready', data: portalCustomer },
  subscriptions: { status: 'ready', data: portalSubscriptions },
  invoices: { status: 'ready', data: portalInvoices },
  wallets: { status: 'ready', data: portalWallets },
  paymentMethods: { status: 'ready', data: portalCards },
  gateways: { status: 'ready', data: portalGateways },
  quotas: { status: 'ready', data: portalQuotas },
  spend: { status: 'ready', data: portalSpend },
  previousSpend: { status: 'ready', data: { ...portalSpend, total: usd('351.27') } },
  periodSpend: { status: 'ready', data: { ...portalSpend, total: usd('315.12') } },
  transactions: { status: 'ready', data: { items: portalTransactions, total: 9 } },
  flows: {
    status: 'ready',
    data: {
      flows: walletFlows(portalTransactions, 'USD'),
      counted: portalTransactions.length,
      total: portalTransactions.length,
    },
  },
  topUps: { status: 'ready', data: { items: portalTopUps, total: portalTopUps.length } },
  invoiceDetail: null,
}

export const emptyPortalData: CustomerPortalData = {
  ...portalData,
  subscriptions: { status: 'ready', data: [] },
  invoices: { status: 'ready', data: [] },
  wallets: { status: 'ready', data: [] },
  paymentMethods: { status: 'ready', data: [] },
  quotas: { status: 'ready', data: [] },
  spend: { status: 'ready', data: { currency: 'USD', total: usd('0'), items: [] } },
  previousSpend: { status: 'ready', data: { currency: 'USD', total: usd('0'), items: [] } },
  periodSpend: { status: 'ready', data: { currency: 'USD', total: usd('0'), items: [] } },
  transactions: { status: 'ready', data: { items: [], total: 0 } },
  flows: { status: 'ready', data: { flows: walletFlows([], 'USD'), counted: 0, total: 0 } },
  topUps: { status: 'ready', data: { items: [], total: 0 } },
}

const loading = { status: 'loading' } as const

export const loadingPortalData: CustomerPortalData = {
  customer: loading,
  subscriptions: loading,
  invoices: loading,
  wallets: loading,
  paymentMethods: loading,
  gateways: loading,
  quotas: loading,
  spend: loading,
  previousSpend: loading,
  periodSpend: loading,
  transactions: loading,
  flows: loading,
  topUps: loading,
  invoiceDetail: null,
}

const done = () => Promise.resolve()
const opened = () => Promise.resolve('https://checkout.stripe.com/c/pay/cs_demo' as string | null)

export const noopPortalActions: CustomerPortalActions = {
  onViewChange: () => undefined,
  onRangeChange: () => undefined,
  onCustomRange: () => undefined,
  onWalletChange: () => undefined,
  onShowMoreTransactions: () => undefined,
  onShowMoreTopUps: () => undefined,
  onRefresh: () => undefined,
  onOpenInvoice: () => undefined,
  payInvoice: opened,
  addCredits: () => Promise.resolve(null),
  addCard: opened,
  saveAutoTopup: done,
  removeCard: done,
  makeDefault: done,
  downloadInvoice: done,
}
