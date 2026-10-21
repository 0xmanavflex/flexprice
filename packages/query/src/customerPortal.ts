import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ApiError,
  type PortalAuth,
  addPortalPaymentMethod,
  deletePortalPaymentMethod,
  getPortalConfig,
  getPortalCustomer,
  getPortalIntegrations,
  getPortalInvoice,
  getPortalInvoicePdf,
  getPortalInvoices,
  getPortalPaymentMethods,
  getPortalSubscriptions,
  getPortalUsageAnalytics,
  getPortalUsageSummary,
  getPortalWalletTransactions,
  getPortalWallets,
  payPortalInvoice,
  setDefaultPortalPaymentMethod,
  topUpPortalWallet,
} from '@fp/api'
import {
  DEFAULT_PORTAL_CONFIG,
  type PortalConfig,
  type PortalCustomer,
  type PortalGateway,
  type PortalInvoice,
  type PortalPaymentMethod,
  type PortalQuota,
  type PortalSpend,
  type PortalSubscription,
  type PortalWallet,
  type PortalWalletTransaction,
  toPortalActionUrl,
  toPortalConfig,
  toPortalCustomer,
  toPortalGateways,
  toPortalInvoice,
  toPortalInvoices,
  toPortalPaymentMethods,
  toPortalQuotas,
  toPortalSpend,
  toPortalSubscriptions,
  toPortalWalletTransactions,
  toPortalWallets,
} from '@fp/domain'
import { queryKeys } from './keys'

/**
 * The customer portal's data, read with the session token from the portal
 * link — never the console session, so none of these needs `FlexpriceProvider`.
 *
 * Every hook takes the same `PortalAuth`; every key starts with it, so a
 * payment or top-up refreshes the whole portal with one invalidation.
 */

export interface PortalQuery<T> {
  data: T | undefined
  error: unknown
  isPending: boolean
  refetch: () => void
}

const PORTAL_QUERY = {
  // A customer coming back from a gateway tab sees the payment land.
  refetchOnWindowFocus: true,
  // The portal renders every failure itself; nothing throws to a boundary.
  throwOnError: false,
  // A 401 is an expired link; asking again will not fix it.
  retry: (count: number, error: unknown) =>
    !(
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403 || error.status === 404)
    ) && count < 2,
} as const

function usePortalQuery<T>(
  auth: PortalAuth,
  key: readonly unknown[],
  fetch: () => Promise<T>,
  enabled = true,
): PortalQuery<T> {
  const query = useQuery({
    queryKey: queryKeys.customerPortal.part(auth.apiOrigin, auth.token, ...key),
    queryFn: fetch,
    enabled,
    ...PORTAL_QUERY,
  })
  return {
    data: query.data,
    error: query.error,
    isPending: query.isPending,
    refetch: () => void query.refetch(),
  }
}

export const usePortalCustomer = (auth: PortalAuth): PortalQuery<PortalCustomer> =>
  usePortalQuery(auth, ['customer'], async () => toPortalCustomer(await getPortalCustomer(auth)))

/** The tenant's portal settings. No setting yet (404) is the default portal, not an error. */
export const usePortalConfig = (auth: PortalAuth): PortalQuery<PortalConfig> =>
  usePortalQuery(auth, ['config'], async () => {
    try {
      return toPortalConfig(await getPortalConfig(auth))
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return DEFAULT_PORTAL_CONFIG
      throw error
    }
  })

export const usePortalGateways = (auth: PortalAuth): PortalQuery<PortalGateway[]> =>
  usePortalQuery(auth, ['gateways'], async () =>
    toPortalGateways(await getPortalIntegrations(auth)),
  )

export const usePortalSubscriptions = (auth: PortalAuth): PortalQuery<PortalSubscription[]> =>
  usePortalQuery(auth, ['subscriptions'], async () =>
    toPortalSubscriptions(await getPortalSubscriptions(auth)),
  )

export const usePortalInvoices = (auth: PortalAuth): PortalQuery<PortalInvoice[]> =>
  usePortalQuery(auth, ['invoices'], async () => toPortalInvoices(await getPortalInvoices(auth)))

/** One invoice with its line items (the list leaves them out). */
export const usePortalInvoice = (
  auth: PortalAuth,
  invoiceId: string | null,
): PortalQuery<PortalInvoice> =>
  usePortalQuery(
    auth,
    ['invoice', invoiceId],
    async () => toPortalInvoice(await getPortalInvoice(auth, invoiceId ?? '')),
    invoiceId !== null,
  )

export const usePortalWallets = (auth: PortalAuth): PortalQuery<PortalWallet[]> =>
  usePortalQuery(auth, ['wallets'], async () => toPortalWallets(await getPortalWallets(auth)))

export const usePortalWalletTransactions = (
  auth: PortalAuth,
  wallet: PortalWallet | null,
  limit: number,
): PortalQuery<{ items: PortalWalletTransaction[]; total: number }> =>
  usePortalQuery(
    auth,
    ['walletTransactions', wallet?.id, limit],
    async () =>
      toPortalWalletTransactions(
        await getPortalWalletTransactions(auth, wallet?.id ?? '', { limit, offset: 0 }),
        wallet?.currency ?? 'USD',
      ),
    wallet !== null,
  )

export const usePortalPaymentMethods = (auth: PortalAuth): PortalQuery<PortalPaymentMethod[]> =>
  usePortalQuery(auth, ['paymentMethods'], async () =>
    toPortalPaymentMethods(await getPortalPaymentMethods(auth)),
  )

export const usePortalQuotas = (auth: PortalAuth): PortalQuery<PortalQuota[]> =>
  usePortalQuery(auth, ['quotas'], async () => toPortalQuotas(await getPortalUsageSummary(auth)))

/** Spend per feature over `[start, end)`, in daily points (hourly for a single day). */
export const usePortalSpend = (
  auth: PortalAuth,
  start: Date,
  end: Date,
): PortalQuery<PortalSpend> => {
  const windowSize = end.getTime() - start.getTime() <= 86_400_000 ? 'HOUR' : 'DAY'
  return usePortalQuery(auth, ['spend', start.toISOString(), end.toISOString()], async () =>
    toPortalSpend(await getPortalUsageAnalytics(auth, { start, end, windowSize })),
  )
}

/* ---- Actions -------------------------------------------------------------- */

export interface PortalAction<A> {
  run: (args: A) => Promise<string | null>
  isPending: boolean
}

/**
 * A portal write that may hand back a gateway page. Resolves that page's URL,
 * or null when it is already done (a saved card was charged); either way the
 * portal's data is refreshed.
 *
 * One idempotency key per attempt: a retry after a failure sends the same
 * key, so the backend answers with what it may already have done.
 */
function usePortalAction<A>(
  auth: PortalAuth,
  call: (args: A, idempotencyKey: string) => Promise<unknown>,
): PortalAction<A> {
  const queryClient = useQueryClient()
  const key = useRef<string | null>(null)
  const mutation = useMutation({
    mutationFn: async (args: A) => {
      key.current ??= crypto.randomUUID()
      return toPortalActionUrl(await call(args, key.current))
    },
    onSuccess: () => {
      key.current = null
      void queryClient.invalidateQueries({
        queryKey: queryKeys.customerPortal.all(auth.apiOrigin, auth.token),
      })
    },
  })
  return { run: (args) => mutation.mutateAsync(args), isPending: mutation.isPending }
}

/** Where a gateway sends the customer back: this page, as it is now. */
function returnUrls(returnUrl: string) {
  return { success_url: returnUrl, cancel_url: returnUrl, failure_url: returnUrl }
}

export function usePayPortalInvoice(auth: PortalAuth) {
  return usePortalAction<{ invoiceId: string; provider: string | null; returnUrl: string }>(
    auth,
    ({ invoiceId, provider, returnUrl }, idempotency_key) =>
      payPortalInvoice(auth, invoiceId, {
        idempotency_key,
        ...(provider ? { payment_provider: provider } : {}),
        ...returnUrls(returnUrl),
      }),
  )
}

export function useTopUpPortalWallet(auth: PortalAuth) {
  return usePortalAction<{
    walletId: string
    credits: string
    /** A gateway's checkout, or null to charge the saved default card. */
    provider: string | null
    note: string
    returnUrl: string
  }>(auth, ({ walletId, credits, provider, note, returnUrl }, idempotency_key) =>
    topUpPortalWallet(auth, walletId, {
      credits_to_add: credits,
      idempotency_key,
      ...(note.trim() ? { description: note.trim() } : {}),
      checkout: provider
        ? { payment_provider: provider, ...returnUrls(returnUrl) }
        : { use_saved_method: true, ...returnUrls(returnUrl) },
    }),
  )
}

export function useAddPortalPaymentMethod(auth: PortalAuth) {
  return usePortalAction<{ provider: string; returnUrl: string }>(auth, ({ provider, returnUrl }) =>
    addPortalPaymentMethod(auth, {
      payment_provider: provider,
      success_url: returnUrl,
      cancel_url: returnUrl,
    }),
  )
}

export function useRemovePortalPaymentMethod(auth: PortalAuth) {
  return usePortalAction<{ provider: string; id: string }>(auth, ({ provider, id }) =>
    deletePortalPaymentMethod(auth, { payment_provider: provider, payment_method_id: id }),
  )
}

export function useSetDefaultPortalPaymentMethod(auth: PortalAuth) {
  return usePortalAction<{ provider: string; id: string }>(auth, ({ provider, id }) =>
    setDefaultPortalPaymentMethod(auth, { payment_provider: provider, payment_method_id: id }),
  )
}

/** Resolves a fresh PDF link for an invoice; each one is short-lived. */
export function usePortalInvoicePdf(auth: PortalAuth) {
  const mutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const body = (await getPortalInvoicePdf(auth, invoiceId)) as {
        presigned_url?: unknown
      } | null
      return typeof body?.presigned_url === 'string' ? body.presigned_url : null
    },
  })
  return {
    run: (invoiceId: string) => mutation.mutateAsync(invoiceId),
    isPending: mutation.isPending,
  }
}
