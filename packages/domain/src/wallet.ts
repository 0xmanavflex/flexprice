import { z } from 'zod'
import type { Money } from './money'

export const WalletStatus = { Active: 'active', Frozen: 'frozen', Closed: 'closed' } as const
export type WalletStatus = (typeof WalletStatus)[keyof typeof WalletStatus]

export const WALLET_STATUS_LABEL: Record<WalletStatus, string> = {
  active: 'Active',
  frozen: 'Frozen',
  closed: 'Terminated',
}

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
  autoTopup: boolean
  createdAt: Date | null
}

export type WalletTransactionDirection = 'in' | 'out'

export interface WalletTransaction {
  id: string
  direction: WalletTransactionDirection
  /** The API's reason, humanised. */
  reason: string
  description: string
  credits: string
  amount: Money
  createdAt: Date | null
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
