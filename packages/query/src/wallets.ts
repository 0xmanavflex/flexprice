import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { call } from '@fp/api'
import {
  type AutoTopup,
  type CreateWallet,
  type TopUpWallet,
  type Wallet,
  type WalletTransaction,
  WalletStatus,
  moneyOr,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

/**
 * Prepaid wallets: read per customer, create, top up, terminate.
 *
 * Credit and money amounts are decimal strings from the API and stay strings.
 */

export interface WalletWire {
  id?: string | undefined
  customerId?: string | undefined
  currency?: string | undefined
  walletStatus?: string | undefined
  description?: string | undefined
  creditBalance?: string | undefined
  balance?: string | undefined
  realTimeCreditBalance?: string | undefined
  realTimeBalance?: string | undefined
  conversionRate?: string | undefined
  topupConversionRate?: string | undefined
  autoTopup?:
    | {
        enabled?: boolean | undefined
        threshold?: number | string | undefined
        amount?: number | string | undefined
        invoicing?: boolean | undefined
      }
    | undefined
  createdAt?: Date | undefined
}

export interface WalletTransactionWire {
  id?: string | undefined
  type?: string | undefined
  transactionReason?: string | undefined
  description?: string | undefined
  creditAmount?: string | undefined
  amount?: string | undefined
  currency?: string | undefined
  creditsAvailable?: string | undefined
  expiryDate?: Date | undefined
  createdAt?: Date | undefined
}

const STATUSES = new Set<string>(Object.values(WalletStatus))

export function toWallet(wire: WalletWire): Wallet {
  const currency = (wire.currency || 'USD').toUpperCase()
  const credits = wire.creditBalance ?? '0'
  const amount = wire.balance ?? '0'
  return {
    id: wire.id ?? '',
    customerId: wire.customerId ?? '',
    currency,
    status: STATUSES.has(wire.walletStatus ?? '')
      ? (wire.walletStatus as WalletStatus)
      : WalletStatus.Active,
    description: wire.description ?? '',
    creditBalance: credits,
    balance: moneyOr(amount, currency),
    realTimeCreditBalance: wire.realTimeCreditBalance ?? credits,
    realTimeBalance: moneyOr(wire.realTimeBalance ?? amount, currency),
    conversionRate: wire.conversionRate ?? '1',
    topupConversionRate: wire.topupConversionRate ?? wire.conversionRate ?? '1',
    autoTopup: {
      enabled: wire.autoTopup?.enabled === true,
      threshold: String(wire.autoTopup?.threshold ?? ''),
      amount: String(wire.autoTopup?.amount ?? ''),
      invoicing: wire.autoTopup?.invoicing ?? true,
    },
    createdAt: wire.createdAt ?? null,
  }
}

const REASON_LABEL: Record<string, string> = {
  INVOICE_PAYMENT: 'Invoice payment',
  FREE_CREDIT_GRANT: 'Free credit grant',
  SUBSCRIPTION_CREDIT_GRANT: 'Subscription grant',
  PURCHASED_CREDIT_INVOICED: 'Purchased credits (invoiced)',
  PURCHASED_CREDIT_DIRECT: 'Purchased credits',
  CREDIT_NOTE: 'Credit note',
  CREDIT_EXPIRED: 'Credits expired',
  WALLET_TERMINATION: 'Wallet terminated',
  MANUAL_BALANCE_DEBIT: 'Manual debit',
  CREDIT_ADJUSTMENT: 'Credit adjustment',
  INVOICE_VOID_REFUND: 'Invoice void refund',
  PURCHASED_CREDIT_BONUS: 'Bonus credits',
}

export function toWalletTransaction(wire: WalletTransactionWire, index = 0): WalletTransaction {
  return {
    id: wire.id ?? `txn_${index}`,
    direction: wire.type === 'debit' ? 'out' : 'in',
    reason: REASON_LABEL[wire.transactionReason ?? ''] ?? 'Wallet activity',
    description: wire.description ?? '',
    credits: wire.creditAmount ?? '0',
    amount: moneyOr(wire.amount, wire.currency),
    createdAt: wire.createdAt ?? null,
    creditsAvailable: wire.creditsAvailable ?? null,
    expiresAt: wire.expiryDate ?? null,
  }
}

/** Builds `POST /wallets`. */
export function toCreateWalletRequest(
  customerId: string,
  draft: CreateWallet,
): Record<string, unknown> {
  const description = draft.description.trim()
  return {
    customerId,
    currency: draft.currency.toUpperCase(),
    conversionRate: draft.conversionRate,
    walletType: 'PRE_PAID',
    ...(description ? { description } : {}),
    ...(draft.initialCredits ? { initialCreditsToLoad: draft.initialCredits } : {}),
  }
}

/** Builds `POST /wallets/{id}/top-up`. Purchased credits are charged; free ones are a grant. */
export function toTopUpRequest(draft: TopUpWallet): Record<string, unknown> {
  const description = draft.description.trim()
  return {
    creditsToAdd: draft.credits,
    transactionReason: draft.kind === 'free' ? 'FREE_CREDIT_GRANT' : 'PURCHASED_CREDIT_DIRECT',
    ...(description ? { description } : {}),
  }
}

/** Builds the `autoTopup` body of `PUT /wallets/{id}`. Off sends only the switch, so saved values survive. */
export function toUpdateAutoTopupRequest(draft: AutoTopup): Record<string, unknown> {
  if (!draft.enabled) return { autoTopup: { enabled: false } }
  return {
    autoTopup: {
      enabled: true,
      threshold: Number(draft.threshold),
      amount: Number(draft.amount),
      invoicing: draft.invoicing,
    },
  }
}

/** A customer's wallets — `GET /customers/{id}/wallets`. */
export function useCustomerWallets(customerId: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.wallets.forCustomer(customerId),
    queryFn: async () =>
      ((await call(() => client.wallets.getWalletsByCustomerId(customerId))) as WalletWire[]).map(
        toWallet,
      ),
  })
}

/** One wallet's ledger, newest first — `GET /wallets/{id}/transactions`. */
export function useWalletTransactions(walletId: string | null) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.wallets.transactions(walletId ?? ''),
    enabled: walletId !== null,
    queryFn: async () => {
      const response = await call(() =>
        client.wallets.getWalletTransactions({ idPathParameter: walletId ?? '', limit: 200 }),
      )
      return ((response.items ?? []) as WalletTransactionWire[]).map(toWalletTransaction)
    },
  })
}

function useInvalidateWallets() {
  const queryClient = useQueryClient()
  return () => void queryClient.invalidateQueries({ queryKey: queryKeys.wallets.all() })
}

export function useCreateWallet(customerId: string) {
  const client = useFlexprice()
  const invalidate = useInvalidateWallets()

  return useMutation({
    mutationFn: (draft: CreateWallet) =>
      call(() => client.wallets.createWallet(toCreateWalletRequest(customerId, draft) as never)),
    onSuccess: invalidate,
  })
}

export function useTopUpWallet(walletId: string) {
  const client = useFlexprice()
  const invalidate = useInvalidateWallets()

  return useMutation({
    mutationFn: (draft: TopUpWallet) =>
      call(() => client.wallets.topUpWallet(walletId, toTopUpRequest(draft) as never)),
    onSuccess: invalidate,
  })
}

export function useUpdateAutoTopup(walletId: string) {
  const client = useFlexprice()
  const invalidate = useInvalidateWallets()

  return useMutation({
    mutationFn: (draft: AutoTopup) =>
      call(() => client.wallets.updateWallet(walletId, toUpdateAutoTopupRequest(draft) as never)),
    onSuccess: invalidate,
  })
}

export function useTerminateWallet() {
  const client = useFlexprice()
  const invalidate = useInvalidateWallets()

  return useMutation({
    mutationFn: (walletId: string) => call(() => client.wallets.terminateWallet(walletId)),
    onSuccess: invalidate,
  })
}
