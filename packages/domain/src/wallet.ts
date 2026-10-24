import type { AlertSettingConfig } from './alertSetting'
import { z } from 'zod'
import type { Money } from './money'

export const WalletStatus = { Active: 'active', Frozen: 'frozen', Closed: 'closed' } as const
export type WalletStatus = (typeof WalletStatus)[keyof typeof WalletStatus]

export const WALLET_STATUS_LABEL: Record<WalletStatus, string> = {
  active: 'Active',
  frozen: 'Frozen',
  closed: 'Terminated',
}

/** When a wallet refills itself: below the threshold, add the amount. Credits stay decimal strings. */
export interface AutoTopup {
  enabled: boolean
  /** Refill when the balance falls to this many credits. */
  threshold: string
  /** Credits added on each refill. */
  amount: string
  /** Raise an invoice for the refill instead of granting it. */
  invoicing: boolean
  /** The least time between two refills; blank for none. A whole number of `cooldownUnit`s. */
  cooldownValue?: string | undefined
  cooldownUnit?: AutoTopupCooldownUnit | undefined
}

/** The units a refill cool-off is counted in (the wire's `DurationUnit`, less seconds). */
export const AutoTopupCooldownUnit = {
  Minute: 'minute',
  Hour: 'hour',
  Day: 'day',
} as const
export type AutoTopupCooldownUnit =
  (typeof AutoTopupCooldownUnit)[keyof typeof AutoTopupCooldownUnit]

export const AUTO_TOPUP_COOLDOWN_UNIT_LABEL: Record<AutoTopupCooldownUnit, string> = {
  [AutoTopupCooldownUnit.Minute]: 'Minutes',
  [AutoTopupCooldownUnit.Hour]: 'Hours',
  [AutoTopupCooldownUnit.Day]: 'Days',
}

export const emptyAutoTopup = (): AutoTopup => ({
  enabled: false,
  threshold: '',
  amount: '',
  invoicing: true,
})

export const WalletKind = { PrePaid: 'PRE_PAID', PostPaid: 'POST_PAID' } as const
export type WalletKind = (typeof WalletKind)[keyof typeof WalletKind]

export const WALLET_KIND_LABEL: Record<WalletKind, string> = {
  PRE_PAID: 'Prepaid',
  POST_PAID: 'Postpaid',
}

/** One prepaid wallet. Balances stay decimal strings; the API owns the arithmetic. */
export interface Wallet {
  /** Balance alert thresholds stored on the wallet (`alert_settings`); null when none. */
  alertSettings?: AlertSettingConfig | null
  id: string
  customerId: string
  currency: string
  status: WalletStatus
  /** Prepaid (drawn down in real time) or postpaid (settled on the invoice); null when the API does not say. */
  walletType: WalletKind | null
  description: string
  /** Credits as of the last invoice. */
  creditBalance: string
  balance: Money
  /** Credits net of usage not yet invoiced. */
  realTimeCreditBalance: string
  realTimeBalance: Money
  /** Currency per credit. */
  conversionRate: string
  topupConversionRate: string
  autoTopup: AutoTopup
  /** Free-form key/value fields; `{}` when none. */
  metadata: Readonly<Record<string, string>>
  createdAt: Date | null
}

export type WalletTransactionDirection = 'in' | 'out'

/** Credits one product drew from a top-up. The wallet API does not send these today. */
export interface WalletConsumption {
  id: string
  product: string
  contract: string
  /** Credits drawn, as a positive decimal string. */
  credits: string
  amount: Money
}

export interface WalletTransaction {
  id: string
  direction: WalletTransactionDirection
  /** The API's reason, humanised. */
  reason: string
  description: string
  credits: string
  amount: Money
  createdAt: Date | null
  /** Credits of this top-up not yet drawn down; null when the API did not say. */
  creditsAvailable: string | null
  /** When the credits lapse; null for credits that never expire. */
  expiresAt: Date | null
  /** Per-product draw-down of this top-up. Absent unless the API reports it. */
  consumption?: WalletConsumption[]
}

const decimal = /^\d+(\.\d+)?$/
const positive = (value: string) => decimal.test(value) && /[1-9]/.test(value)

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** Today as a local `YYYY-MM-DD`, the form an expiry date is picked in. */
function today(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export const createWalletSchema = z.object({
  currency: z.string().trim().length(3, 'Choose a currency'),
  description: z.string().trim().max(200, 'Keep the description under 200 characters'),
  conversionRate: z.string().trim().refine(positive, 'Enter a positive rate, like 0.01'),
  initialCredits: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || decimal.test(value),
      'Enter a number of credits, or leave blank',
    ),
  /** Prepaid wallets are drawn down in real time; postpaid ones settle on the invoice. */
  walletType: z.enum(['PRE_PAID', 'POST_PAID']),
  /** What one credit costs when bought; blank means the conversion rate. */
  topupConversionRate: z
    .string()
    .trim()
    .refine((value) => value === '' || positive(value), 'Enter a positive rate, or leave blank'),
  /** The day the initial credits lapse (`YYYY-MM-DD`), or blank for never. */
  initialCreditsExpiry: z
    .string()
    .trim()
    .refine((value) => value === '' || DAY.test(value), 'Pick an expiry date')
    .refine((value) => value === '' || value >= today(), 'The expiry date cannot be in the past'),
})
export type CreateWallet = z.infer<typeof createWalletSchema>

export const emptyWallet = (currency = 'USD'): CreateWallet => ({
  currency,
  description: '',
  conversionRate: '1',
  initialCredits: '',
  walletType: 'PRE_PAID',
  topupConversionRate: '',
  initialCreditsExpiry: '',
})

export const WalletTopUpKind = { Purchased: 'purchased', Free: 'free' } as const
export type WalletTopUpKind = (typeof WalletTopUpKind)[keyof typeof WalletTopUpKind]

export const topUpWalletSchema = z.object({
  kind: z.enum(['purchased', 'free']),
  credits: z.string().trim().refine(positive, 'Enter a positive number of credits'),
  description: z.string().trim().max(200, 'Keep the note under 200 characters'),
  /** Purchased credits only: raise an invoice for them, rather than record them as paid. */
  invoice: z.boolean(),
  /** The day the credits expire (`YYYY-MM-DD`), or blank for never. */
  expiryDate: z
    .string()
    .trim()
    .refine((value) => value === '' || DAY.test(value), 'Pick an expiry date')
    .refine((value) => value === '' || value >= today(), 'The expiry date cannot be in the past'),
  /** Which credits are drawn first; a lower number goes first. Blank for no priority. */
  priority: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || (/^\d+$/.test(value) && Number(value) >= 1),
      'Priority is a whole number, 1 or more',
    ),
  /** A unique reference that keeps the same top-up from being applied twice. */
  referenceId: z.string().trim().max(255, 'Keep the reference under 255 characters'),
})
export type TopUpWallet = z.infer<typeof topUpWalletSchema>

export const debitWalletSchema = z.object({
  credits: z.string().trim().refine(positive, 'Enter a positive number of credits'),
  description: z.string().trim().max(200, 'Keep the note under 200 characters'),
  /** Generated when the dialog opens, so a double submit is one debit. */
  idempotencyKey: z.string().trim().min(1, 'A reference is required'),
})
export type DebitWallet = z.infer<typeof debitWalletSchema>

export const emptyDebit = (): DebitWallet => ({
  credits: '',
  description: '',
  idempotencyKey: '',
})

export const emptyTopUp = (): TopUpWallet => ({
  kind: 'purchased',
  credits: '',
  description: '',
  invoice: false,
  expiryDate: '',
  priority: '',
  referenceId: '',
})

export const autoTopupSchema = z
  .object({
    enabled: z.boolean(),
    threshold: z.string().trim(),
    amount: z.string().trim(),
    invoicing: z.boolean(),
    cooldownValue: z.string().trim().optional(),
    cooldownUnit: z
      .enum([AutoTopupCooldownUnit.Minute, AutoTopupCooldownUnit.Hour, AutoTopupCooldownUnit.Day])
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.enabled) return
    if (!positive(value.threshold))
      ctx.addIssue({
        code: 'custom',
        path: ['threshold'],
        message: 'Enter the credit balance that triggers a top-up',
      })
    if (!positive(value.amount))
      ctx.addIssue({
        code: 'custom',
        path: ['amount'],
        message: 'Enter how many credits to add',
      })
    if (value.cooldownValue && !/^[1-9]\d*$/.test(value.cooldownValue))
      ctx.addIssue({
        code: 'custom',
        path: ['cooldownValue'],
        message: 'Enter a whole number, or leave blank for no cool-off',
      })
  })
