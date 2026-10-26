import type {
  PortalCustomer,
  PortalGateway,
  PortalInvoice,
  PortalPaymentMethod,
  PortalQuota,
  PortalRange,
  PortalSpend,
  PortalCooldown,
  PortalSubscription,
  PortalTopUp,
  PortalView,
  PortalWallet,
  PortalWalletTotals,
  PortalWalletTransaction,
} from '@fp/domain'

/** One piece of the portal's data, as the page renders it. */
export type Load<T> =
  { status: 'loading' } | { status: 'error'; retry: () => void } | { status: 'ready'; data: T }

/** How a top-up is paid: the saved default card now, or a gateway's checkout page. */
export type PayVia = { kind: 'saved' } | { kind: 'checkout'; provider: string }

export interface CustomerPortalData {
  customer: Load<PortalCustomer>
  subscriptions: Load<PortalSubscription[]>
  invoices: Load<PortalInvoice[]>
  wallets: Load<PortalWallet[]>
  paymentMethods: Load<PortalPaymentMethod[]>
  gateways: Load<PortalGateway[]>
  quotas: Load<PortalQuota[]>
  spend: Load<PortalSpend>
  /** The same window just before `spend`'s, for the change. */
  previousSpend: Load<PortalSpend>
  /** Spend from the current billing period's start to now, for the projection; null with no period. */
  periodSpend: Load<PortalSpend> | null
  /** The selected wallet's transactions this billing period (or all, with no period), as loaded so far. */
  transactions: Load<{ items: PortalWalletTransaction[]; total: number }>
  /** Credits added and used across every transaction in that window, not only the loaded ones. */
  flows: Load<PortalWalletTotals>
  /** The selected wallet's credits in, with what is left of each. */
  topUps: Load<{ items: PortalTopUp[]; total: number }>
  /** The invoice open in the sheet, with its lines; null when none is open. */
  invoiceDetail: Load<PortalInvoice> | null
}

/**
 * What the portal can do. Each write resolves when it is done: with the
 * gateway page it opened in a new tab, if it opened one (the dialog then keeps
 * that link on screen): and rejects with a message the customer can read.
 */
export interface CustomerPortalActions {
  onViewChange: (view: PortalView) => void
  onRangeChange: (range: PortalRange) => void
  /** A range picked on the calendar, `[start, end)` in local days. */
  onCustomRange: (start: Date, end: Date) => void
  onWalletChange: (walletId: string) => void
  onShowMoreTransactions: () => void
  onShowMoreTopUps: () => void
  /** Refetch everything, after the customer says they finished on a gateway's page. */
  onRefresh: () => void
  onOpenInvoice: (invoiceId: string | null) => void
  payInvoice: (invoice: PortalInvoice, provider: string | null) => Promise<string | null>
  addCredits: (
    wallet: PortalWallet,
    credits: string,
    via: PayVia,
    note: string,
  ) => Promise<string | null>
  addCard: (provider: string) => Promise<string | null>
  saveAutoTopup: (wallet: PortalWallet, settings: AutoTopupSettings) => Promise<void>
  removeCard: (card: PortalPaymentMethod) => Promise<void>
  makeDefault: (card: PortalPaymentMethod) => Promise<void>
  downloadInvoice: (invoice: PortalInvoice) => Promise<void>
}

export interface AutoTopupSettings {
  enabled: boolean
  /** Top up when the balance falls below this many credits. */
  threshold: string | null
  /** Credits to add each time. */
  credits: string | null
  cooldown: PortalCooldown | null
}

export interface CustomerPortalViewProps {
  /** The merchant's name, for the header and copy; null when the API does not say. */
  brandName: string | null
  /** A CSS colour for the brand mark and primary buttons. */
  brandColor: string | null
  views: readonly PortalView[]
  view: PortalView
  range: PortalRange
  /** A calendar range, which replaces `range` when set. */
  customRange: { start: Date; end: Date } | null
  walletId: string | null
  data: CustomerPortalData
  actions: CustomerPortalActions
  locale?: string
  /** "Now", for stories and tests; defaults to the clock. */
  now?: Date
}
