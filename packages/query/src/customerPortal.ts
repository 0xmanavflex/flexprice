import { useRef } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  updatePortalAutoTopup,
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
  type PortalTopUp,
  type PortalWallet,
  type PortalWalletTotals,
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
  toPortalTopUps,
  toPortalWalletTransactions,
  toPortalWallets,
  walletFlows,
} from '@fp/domain'
import { queryKeys } from './keys'

/**
 * The customer portal's data, read with the session token from the portal
 * link: never the console session, so none of these needs `FlexpriceProvider`.
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

/** A wallet's transactions, newest first; `since` keeps only those from that moment on. */
export const usePortalWalletTransactions = (
  auth: PortalAuth,
  wallet: PortalWallet | null,
  limit: number,
  since: Date | null = null,
): PortalQuery<{ items: PortalWalletTransaction[]; total: number }> =>
  usePortalQuery(
    auth,
    ['walletTransactions', wallet?.id, limit, since?.toISOString() ?? null],
    async () =>
      toPortalWalletTransactions(
        await getPortalWalletTransactions(auth, wallet?.id ?? '', {
          limit,
          offset: 0,
          ...(since ? { since } : {}),
        }),
        wallet?.currency ?? 'USD',
      ),
    wallet !== null,
  )

/**
 * A wallet's transactions, newest first, a page at a time: each "Load more"
 * asks the API for the next `pageSize` by offset, rather than refetching a
 * longer list from the top. Rows already shown are not repeated.
 */
export function usePortalWalletTransactionPages(
  auth: PortalAuth,
  wallet: PortalWallet | null,
  pageSize: number,
  since: Date | null = null,
): PortalQuery<{ items: PortalWalletTransaction[]; total: number }> & {
  loadMore: () => void
  loadingMore: boolean
} {
  const query = useInfiniteQuery({
    queryKey: queryKeys.customerPortal.part(
      auth.apiOrigin,
      auth.token,
      'walletTransactionPages',
      wallet?.id,
      pageSize,
      since?.toISOString() ?? null,
    ),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) =>
      toPortalWalletTransactions(
        await getPortalWalletTransactions(auth, wallet?.id ?? '', {
          limit: pageSize,
          offset: pageParam,
          ...(since ? { since } : {}),
        }),
        wallet?.currency ?? 'USD',
      ),
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((count, page) => count + page.items.length, 0)
      return last.items.length < pageSize || loaded >= last.total ? undefined : loaded
    },
    enabled: wallet !== null,
    ...PORTAL_QUERY,
  })
  const seen = new Set<string>()
  const items = (query.data?.pages ?? [])
    .flatMap((page) => page.items)
    .filter((item) => !seen.has(item.id) && Boolean(seen.add(item.id)))
  // The page shows "Load more" while `items.length < total`; tie that to whether
  // there is a next page to fetch, so the button never shows without one (rows
  // repeated across pages, when a new transaction shifts the offsets, would
  // otherwise leave the API's total out of reach).
  const total = query.hasNextPage
    ? Math.max(query.data?.pages.at(-1)?.total ?? 0, items.length + 1)
    : items.length
  return {
    data: query.data ? { items, total } : undefined,
    error: query.error,
    isPending: query.isPending,
    refetch: () => void query.refetch(),
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage()
    },
    loadingMore: query.isFetchingNextPage,
  }
}

/** The most transactions the API returns at once. */
const MAX_PAGE = 1000
/** A safety bound on the rows read for the totals (50 pages of `MAX_PAGE`). */
const MAX_FLOW_ROWS = 50_000

/**
 * Credits added and used on a wallet since `since` (or ever, with none),
 * across every transaction in that window, not only the history's loaded
 * pages. The API has no aggregate, so this reads the window a page at a time
 * (`limit` up to 1000, the API's maximum) until its total is reached. Past
 * `MAX_FLOW_ROWS` it stops and says so: `counted < total` marks the sums as
 * covering only the latest `counted` transactions.
 */
export const usePortalWalletFlows = (
  auth: PortalAuth,
  wallet: PortalWallet | null,
  since: Date | null = null,
): PortalQuery<PortalWalletTotals> =>
  usePortalQuery(
    auth,
    ['walletFlows', wallet?.id, since?.toISOString() ?? null],
    async () => {
      const currency = wallet?.currency ?? 'USD'
      const rows = new Map<string, PortalWalletTransaction>()
      let offset = 0
      let total = 0
      while (offset < MAX_FLOW_ROWS) {
        const page = toPortalWalletTransactions(
          await getPortalWalletTransactions(auth, wallet?.id ?? '', {
            limit: MAX_PAGE,
            offset,
            ...(since ? { since } : {}),
          }),
          currency,
        )
        total = page.total
        for (const item of page.items) rows.set(item.id, item)
        // Advance by what came back, so a lower server cap still pages correctly.
        offset += page.items.length
        if (page.items.length === 0 || offset >= total) break
      }
      return {
        flows: walletFlows([...rows.values()], currency),
        counted: rows.size,
        total: Math.max(total, rows.size),
      }
    },
    wallet !== null,
  )

/** Every credit added to a wallet, with what is left of it. */
export const usePortalTopUps = (
  auth: PortalAuth,
  wallet: PortalWallet | null,
  limit: number,
): PortalQuery<{ items: PortalTopUp[]; total: number }> =>
  usePortalQuery(
    auth,
    ['topUps', wallet?.id, limit],
    async () => {
      const page = toPortalWalletTransactions(
        await getPortalWalletTransactions(auth, wallet?.id ?? '', {
          limit,
          offset: 0,
          type: 'credit',
        }),
        wallet?.currency ?? 'USD',
      )
      return { items: toPortalTopUps(page.items), total: page.total }
    },
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
  enabled = true,
): PortalQuery<PortalSpend> => {
  const windowSize = end.getTime() - start.getTime() <= 86_400_000 ? 'HOUR' : 'DAY'
  return usePortalQuery(
    auth,
    ['spend', start.toISOString(), end.toISOString()],
    async () => toPortalSpend(await getPortalUsageAnalytics(auth, { start, end, windowSize })),
    enabled && end.getTime() > start.getTime(),
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

export function useUpdatePortalAutoTopup(auth: PortalAuth) {
  return usePortalAction<{
    walletId: string
    enabled: boolean
    threshold: string | null
    credits: string | null
    cooldown: { value: number; unit: 'minute' | 'hour' | 'day' } | null
  }>(auth, async ({ walletId, enabled, threshold, credits, cooldown }) => {
    await updatePortalAutoTopup(auth, walletId, {
      enabled,
      ...(threshold ? { threshold } : {}),
      ...(credits ? { amount: credits } : {}),
      ...(cooldown ? { cooldown } : {}),
    })
    // Saved, nothing to open.
    return null
  })
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
