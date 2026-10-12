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
}

export const emptyAutoTopup = (): AutoTopup => ({
  enabled: false,
  threshold: '',
  amount: '',
  invoicing: true,
})

/** One prepaid wallet. Balances stay decimal strings; the API owns the arithmetic. */
export interface Wallet {
  id: string
  customerId: string
  currency: string
  status: WalletStatus
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
})
export type CreateWallet = z.infer<typeof createWalletSchema>

export const emptyWallet = (currency = 'USD'): CreateWallet => ({
  currency,
  description: '',
  conversionRate: '1',
  initialCredits: '',
})

export const WalletTopUpKind = { Purchased: 'purchased', Free: 'free' } as const
export type WalletTopUpKind = (typeof WalletTopUpKind)[keyof typeof WalletTopUpKind]

export const topUpWalletSchema = z.object({
  kind: z.enum(['purchased', 'free']),
  credits: z.string().trim().refine(positive, 'Enter a positive number of credits'),
  description: z.string().trim().max(200, 'Keep the note under 200 characters'),
})
export type TopUpWallet = z.infer<typeof topUpWalletSchema>

export const emptyTopUp = (): TopUpWallet => ({ kind: 'purchased', credits: '', description: '' })

export const autoTopupSchema = z
  .object({
    enabled: z.boolean(),
    threshold: z.string().trim(),
    amount: z.string().trim(),
    invoicing: z.boolean(),
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
  })
