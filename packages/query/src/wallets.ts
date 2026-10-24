import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, ErrorKind, call, debitWallet } from '@fp/api'
import {
  type AlertSettingConfig,
  type AutoTopup,
  WalletKind,
  AutoTopupCooldownUnit,
  type CreateWallet,
  type DebitWallet,
  type TopUpWallet,
  type Wallet,
  type WalletTransaction,
  WalletStatus,
  moneyOr,
} from '@fp/domain'
import { type AlertConfigWire, toAlertConfig, toAlertConfigRequest } from './alertSettings'
import { queryKeys } from './keys'
import { useFlexprice, useFlexpriceAuth, useFlexpriceServerURL } from './provider'

/**
 * Prepaid wallets: read per customer, create, top up, terminate.
 *
 * Credit and money amounts are decimal strings from the API and stay strings.
 */

export interface WalletWire {
  alertSettings?: AlertConfigWire | undefined
  id?: string | undefined
  customerId?: string | undefined
  currency?: string | undefined
  walletStatus?: string | undefined
  walletType?: string | undefined
  description?: string | undefined
  metadata?: Record<string, string> | undefined
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
        cooldown?: { unit?: string | undefined; value?: number | undefined } | undefined
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
    alertSettings: toAlertConfig(wire.alertSettings),
    id: wire.id ?? '',
    customerId: wire.customerId ?? '',
    currency,
    walletType:
      wire.walletType === WalletKind.PrePaid || wire.walletType === WalletKind.PostPaid
        ? wire.walletType
        : null,
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
      ...toCooldown(wire.autoTopup?.cooldown),
    },
    metadata: wire.metadata ?? {},
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
    walletType: draft.walletType,
    ...(description ? { description } : {}),
    ...(draft.topupConversionRate ? { topupConversionRate: draft.topupConversionRate } : {}),
    ...(draft.initialCredits ? { initialCreditsToLoad: draft.initialCredits } : {}),
    ...(draft.initialCredits && draft.initialCreditsExpiry
      ? { initialCreditsExpiryDateUtc: `${draft.initialCreditsExpiry}T00:00:00Z` }
      : {}),
  }
}

/** Builds `POST /wallets/{id}/top-up`. Purchased credits are charged; free ones are a grant. */
export function toTopUpRequest(draft: TopUpWallet): Record<string, unknown> {
  const description = draft.description.trim()
  const referenceId = draft.referenceId.trim()
  const reason =
    draft.kind === 'free'
      ? 'FREE_CREDIT_GRANT'
      : draft.invoice
        ? 'PURCHASED_CREDIT_INVOICED'
        : 'PURCHASED_CREDIT_DIRECT'
  return {
    creditsToAdd: draft.credits,
    transactionReason: reason,
    ...(description ? { description } : {}),
    // The credits lapse at the start of the picked day, in UTC.
    ...(draft.expiryDate ? { expiryDateUtc: `${draft.expiryDate}T00:00:00Z` } : {}),
    ...(draft.priority ? { priority: Number(draft.priority) } : {}),
    ...(referenceId ? { idempotencyKey: referenceId } : {}),
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
      // Sent only when set: a blank cool-off leaves whatever the wallet has.
      ...(draft.cooldownValue
        ? {
            cooldown: {
              value: Number(draft.cooldownValue),
              unit: draft.cooldownUnit ?? AutoTopupCooldownUnit.Hour,
            },
          }
        : {}),
    },
  }
}

const COOLDOWN_UNITS = new Set<string>(Object.values(AutoTopupCooldownUnit))

/** The wire's cool-off, as the draft's two fields. Seconds and unknown units are read as none. */
function toCooldown(
  wire: { unit?: string | undefined; value?: number | undefined } | undefined,
): Pick<AutoTopup, 'cooldownValue' | 'cooldownUnit'> {
  if (!wire?.value || !COOLDOWN_UNITS.has(wire.unit ?? '')) return {}
  return { cooldownValue: String(wire.value), cooldownUnit: wire.unit as AutoTopupCooldownUnit }
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
    // No customer yet (a form still choosing one): nothing to read.
    enabled: customerId.length > 0,
  })
}

/** One wallet's ledger, newest first — `GET /wallets/{id}/transactions`. */
/**
 * One wallet's real-time balance: `GET /wallets/{id}/balance/real-time`.
 *
 * The wallet list carries only the stored balance — what was left at the last
 * invoice — so a wallet read from it looks untouched until the next invoice,
 * however much usage has run since. This read nets that pending usage off,
 * which is V1's "Ongoing balance" and the figure that can go negative.
 *
 * Under the `wallets` key, so a top-up, debit or terminate refreshes it with
 * everything else.
 */
export function useWalletBalance(walletId: string | null) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.wallets.balance(walletId ?? ''),
    queryFn: async () =>
      toWallet(await call(() => client.wallets.getWalletBalance(walletId ?? ''))),
    enabled: Boolean(walletId),
  })
}

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

/** Builds `POST /wallets/{id}/debit`. The reason is fixed: a manual debit. */
export function toDebitRequest(draft: DebitWallet): {
  credits: string
  idempotencyKey: string
  description?: string
} {
  const description = draft.description.trim()
  return {
    credits: draft.credits,
    idempotencyKey: draft.idempotencyKey,
    ...(description ? { description } : {}),
  }
}

export function useDebitWallet(walletId: string) {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const invalidate = useInvalidateWallets()

  return useMutation({
    mutationFn: async (draft: DebitWallet) => {
      const [token, environmentId] = await Promise.all([auth.getToken(), auth.getEnvironmentId()])
      if (!token) throw new ApiError(ErrorKind.Unauthorized, 'Sign in to debit a wallet.')
      if (!environmentId) throw new ApiError(ErrorKind.Forbidden, 'Choose an environment first.')
      return debitWallet(serverURL, token, environmentId, walletId, toDebitRequest(draft))
    },
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

/**
 * `PUT /wallets/{id}` with one part of the wallet. The one place the update
 * request is cast: the auto top-up and alert bodies are built as plain maps.
 */
function updateWallet(client: ReturnType<typeof useFlexprice>, walletId: string, body: object) {
  return call(() => client.wallets.updateWallet(walletId, body as never))
}

export function useUpdateAutoTopup(walletId: string) {
  const client = useFlexprice()
  const invalidate = useInvalidateWallets()

  return useMutation({
    mutationFn: (draft: AutoTopup) =>
      updateWallet(client, walletId, toUpdateAutoTopupRequest(draft)),
    onSuccess: invalidate,
  })
}

/**
 * A wallet's balance alerts, stored on the wallet as V1 does
 * (`alert_settings` on `PUT /wallets/{id}`), not as an `/alerts/setting` record.
 */
export function useUpdateWalletAlerts(walletId: string) {
  const client = useFlexprice()
  const invalidate = useInvalidateWallets()

  return useMutation({
    mutationFn: (config: AlertSettingConfig) =>
      updateWallet(client, walletId, { alertSettings: toAlertConfigRequest(config) }),
    onSuccess: invalidate,
  })
}

/** A wallet's metadata — `PUT /wallets/{id}` with the whole map. */
export function useUpdateWalletMetadata(walletId: string) {
  const client = useFlexprice()
  const invalidate = useInvalidateWallets()

  return useMutation({
    mutationFn: (metadata: Record<string, string>) => updateWallet(client, walletId, { metadata }),
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
