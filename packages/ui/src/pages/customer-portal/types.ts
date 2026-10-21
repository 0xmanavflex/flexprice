import type {
  PortalCustomer,
  PortalGateway,
  PortalInvoice,
  PortalPaymentMethod,
  PortalQuota,
  PortalRange,
  PortalSpend,
  PortalSubscription,
  PortalView,
  PortalWallet,
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
  transactions: Load<{ items: PortalWalletTransaction[]; total: number }>
  /** The invoice open in the sheet, with its lines; null when none is open. */
  invoiceDetail: Load<PortalInvoice> | null
}

/**
 * What the portal can do. Each write resolves when it is done or handed to a
 * gateway's page, and rejects with a message the customer can read.
 */
export interface CustomerPortalActions {
  onViewChange: (view: PortalView) => void
  onRangeChange: (range: PortalRange) => void
  onWalletChange: (walletId: string) => void
  onShowMoreTransactions: () => void
  onOpenInvoice: (invoiceId: string | null) => void
  payInvoice: (invoice: PortalInvoice, provider: string | null) => Promise<void>
  addCredits: (wallet: PortalWallet, credits: string, via: PayVia, note: string) => Promise<void>
  addCard: (provider: string) => Promise<void>
  removeCard: (card: PortalPaymentMethod) => Promise<void>
  makeDefault: (card: PortalPaymentMethod) => Promise<void>
  downloadInvoice: (invoice: PortalInvoice) => Promise<void>
}

export interface CustomerPortalViewProps {
  /** The merchant's name, for the header and copy; null when the API does not say. */
  brandName: string | null
  /** A CSS colour for the brand mark and primary buttons. */
  brandColor: string | null
  views: readonly PortalView[]
  view: PortalView
  range: PortalRange
  walletId: string | null
  data: CustomerPortalData
  actions: CustomerPortalActions
  locale?: string
  /** "Now", for stories and tests; defaults to the clock. */
  now?: Date
}
