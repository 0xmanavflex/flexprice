import { useCallback, useEffect, useRef, useState } from 'react'
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  ApiError,
  type PortalAuth,
  addPortalPaymentMethod,
  deletePortalPaymentMethod,
  getPortalCheckoutSession,
  getPortalConfig,
  getPortalPropertyKeys,
  getPortalPropertyValues,
  type PortalUsageFilters,
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
  toPortalPropertyValues,
  toPortalCheckoutResult,
  toPortalCheckoutSessionId,
  type PortalCheckoutResult,
  DEFAULT_PORTAL_CONFIG,
  type PortalConfig,
  type PortalCustomer,
  type PortalGateway,
  type PortalOpenCheckout,
  type PortalInvoice,
  type PortalCooldown,
  type PortalSavedCards,
  type PortalQuota,
  type PortalSpend,
  type PortalSubscription,
  type PortalTopUp,
  type PortalWallet,
  type PortalWalletTotals,
  type PortalWalletTransaction,
  toPortalActionUrl,
  toPortalOpenCheckout,
  toPortalConfig,
  toPortalPropertyKeys,
  toPortalCustomer,
  toPortalGateways,
  toPortalInvoice,
  toPortalInvoices,
  toPortalSavedCards,
  toPortalQuotas,
  toPortalSpend,
  toPortalSubscriptions,
  toPortalTopUps,
  toPortalWalletTransactions,
  toPortalWallets,
  walletFlows,
  withPortalAutoTopup,
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
  /** Keep showing the last answer while a new key loads (a longer list). */
  keepPrevious = false,
): PortalQuery<T> {
  const query = useQuery({
    queryKey: queryKeys.customerPortal.part(auth.apiOrigin, auth.token, ...key),
    queryFn: fetch,
    enabled,
    ...(keepPrevious ? { placeholderData: keepPreviousData } : {}),
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
  /** Off until the totals are on screen: a long ledger takes many requests. */
  enabled = true,
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
    wallet !== null && enabled,
  )

/** Every credit added to a wallet, with what is left of it; the newest `limit`. */
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
      const items = toPortalTopUps(page.items)
      // `total` counts checkouts still awaiting payment too, which are not top-ups yet:
      // more remain only while the API has rows past this page.
      return { items, total: page.items.length < page.total ? page.total : items.length }
    },
    wallet !== null,
    // "Show more" asks for a longer list: the rows on screen stay while it loads.
    true,
  )

/** Saved cards, and the gateways that could not list theirs (unknown, not none). */
export const usePortalPaymentMethods = (auth: PortalAuth): PortalQuery<PortalSavedCards> =>
  usePortalQuery(auth, ['paymentMethods'], async () =>
    toPortalSavedCards(await getPortalPaymentMethods(auth)),
  )

export const usePortalQuotas = (auth: PortalAuth): PortalQuery<PortalQuota[]> =>
  usePortalQuery(auth, ['quotas'], async () => toPortalQuotas(await getPortalUsageSummary(auth)))

/** Spend per feature over `[start, end)`, in daily points (hourly for a single day). */
export const usePortalSpend = (
  auth: PortalAuth,
  start: Date,
  end: Date,
  enabled = true,
  /** An event property key: each feature split by its values. */
  groupBy: string | null = null,
  /** Only these features, and only events whose properties hold these values. */
  filter: PortalUsageFilters = {},
): PortalQuery<PortalSpend> => {
  const windowSize = end.getTime() - start.getTime() <= 86_400_000 ? 'HOUR' : 'DAY'
  return usePortalQuery(
    auth,
    ['spend', start.toISOString(), end.toISOString(), groupBy, JSON.stringify(filter)],
    async () =>
      toPortalSpend(
        await getPortalUsageAnalytics(
          auth,
          { start, end, windowSize },
          groupBy ?? undefined,
          filter,
        ),
        groupBy ?? undefined,
      ),
    enabled && end.getTime() > start.getTime(),
  )
}

/**
 * The event property keys this customer may group usage by, in the window.
 * Empty unless the merchant turned grouping on; their allowed and hidden keys
 * are applied by the server.
 */
export const usePortalPropertyKeys = (
  auth: PortalAuth,
  start: Date,
  end: Date,
  enabled = true,
): PortalQuery<string[]> =>
  usePortalQuery(
    auth,
    ['propertyKeys', start.toISOString(), end.toISOString()],
    async () => toPortalPropertyKeys(await getPortalPropertyKeys(auth, { start, end })),
    enabled && end.getTime() > start.getTime(),
  )

/**
 * The values each groupable property key takes in the window, for the usage
 * filter's choices: `POST /analytics/properties/values`, one key at a time.
 */
export const usePortalPropertyValues = (
  auth: PortalAuth,
  start: Date,
  end: Date,
  keys: readonly string[],
  enabled = true,
): PortalQuery<Record<string, string[]>> =>
  usePortalQuery(
    auth,
    ['propertyValues', start.toISOString(), end.toISOString(), [...keys].sort().join(',')],
    async () =>
      Object.fromEntries(
        await Promise.all(
          keys.map(
            async (key) =>
              [
                key,
                toPortalPropertyValues(await getPortalPropertyValues(auth, { start, end }, key)),
              ] as const,
          ),
        ),
      ),
    enabled && keys.length > 0 && end.getTime() > start.getTime(),
  )

/* ---- Actions -------------------------------------------------------------- */

export interface PortalAction<A, R = string | null> {
  run: (args: A) => Promise<R>
  isPending: boolean
}

/**
 * A portal write that may hand back a gateway page. Resolves that page's URL,
 * or null when it is already done (a saved card was charged); either way the
 * portal's data is refreshed.
 *
 * One idempotency key per request: retrying the same request after a failure
 * sends the same key, so the backend answers with what it may already have
 * done. A changed request (another amount, wallet, gateway or invoice) is a
 * new one and gets a new key, never the old request's answer.
 */
function usePortalAction<A, R = string | null>(
  auth: PortalAuth,
  call: (args: A, idempotencyKey: string) => Promise<unknown>,
  read: (wire: unknown) => R = toPortalActionUrl as (wire: unknown) => R,
): PortalAction<A, R> {
  const queryClient = useQueryClient()
  const key = useRef<{ request: string; value: string } | null>(null)
  const mutation = useMutation({
    mutationFn: async (args: A) => {
      const request = JSON.stringify(args)
      if (key.current?.request !== request) {
        key.current = { request, value: crypto.randomUUID() }
      }
      return read(await call(args, key.current.value))
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

export function usePayPortalInvoice(auth: PortalAuth, onCheckout?: (sessionId: string) => void) {
  return usePortalAction<{ invoiceId: string; provider: string | null; returnUrl: string }>(
    auth,
    ({ invoiceId, provider, returnUrl }, idempotency_key) =>
      payPortalInvoice(auth, invoiceId, {
        idempotency_key,
        ...(provider ? { payment_provider: provider } : {}),
        ...returnUrls(returnUrl),
      }),
    (wire) => {
      const url = toPortalActionUrl(wire)
      const session = toPortalCheckoutSessionId(wire)
      if (url && session) onCheckout?.(session)
      return url
    },
  )
}

/**
 * A top-up's outcome: the gateway page to open (null when the saved card was
 * charged), or the checkout already open for this wallet, when the API made
 * no new one.
 */
export type PortalTopUpOutcome =
  { url: string | null; alreadyOpen: null } | { url: null; alreadyOpen: PortalOpenCheckout }

export function useTopUpPortalWallet(auth: PortalAuth, onCheckout?: (sessionId: string) => void) {
  return usePortalAction<
    {
      walletId: string
      credits: string
      /** The gateway: its checkout, or (with `savedCard`) the card saved there. */
      provider: string
      /** Charge the card saved at `provider` instead of opening its checkout. */
      savedCard?: boolean
      note: string
      returnUrl: string
      /** Cancel the checkout already open for this wallet and start this one. */
      replace?: boolean
    },
    PortalTopUpOutcome
  >(
    auth,
    ({ walletId, credits, provider, savedCard, note, returnUrl, replace }, idempotency_key) =>
      topUpPortalWallet(auth, walletId, {
        credits_to_add: credits,
        idempotency_key,
        ...(note.trim() ? { description: note.trim() } : {}),
        // The provider goes with a saved card too: with two gateways connected the API
        // cannot tell which card is meant, and refuses ("payment provider is ambiguous").
        checkout: savedCard
          ? { payment_provider: provider, use_saved_method: true, ...returnUrls(returnUrl) }
          : {
              payment_provider: provider,
              ...returnUrls(returnUrl),
              ...(replace
                ? {
                    entity_creation_options: {
                      entity_creation_conflict_policies: { on_existing_entity: 'supersede' },
                    },
                  }
                : {}),
            },
      }),
    (wire) => {
      const alreadyOpen = toPortalOpenCheckout(wire)
      if (alreadyOpen) return { url: null, alreadyOpen }
      const url = toPortalActionUrl(wire)
      const session = toPortalCheckoutSessionId(wire)
      if (url && session) onCheckout?.(session)
      return { url, alreadyOpen: null }
    },
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
  const queryClient = useQueryClient()
  return usePortalAction<{
    walletId: string
    enabled: boolean
    threshold: string | null
    credits: string | null
    /** Null leaves the stored wait as it is; `{value: 0}` clears it. */
    cooldown: PortalCooldown | null
  }>(auth, async ({ walletId, enabled, threshold, credits, cooldown }) => {
    await updatePortalAutoTopup(auth, walletId, {
      enabled,
      ...(threshold ? { threshold } : {}),
      ...(credits ? { amount: credits } : {}),
      ...(cooldown ? { cooldown } : {}),
    })
    // Show what was saved at once: the refetch that follows is not awaited, and
    // until it answers the old settings would read "off" (or "on") still.
    queryClient.setQueryData<PortalWallet[]>(
      queryKeys.customerPortal.part(auth.apiOrigin, auth.token, 'wallets'),
      (wallets) =>
        wallets &&
        withPortalAutoTopup(wallets, walletId, { enabled, threshold, credits, cooldown }),
    )
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

/* ---- Following a checkout -------------------------------------------------- */

/** How often a checkout is read, and how long before the portal stops asking. */
const CHECKOUT_POLL_MS = 2_000
const CHECKOUT_WATCH_MS = 10 * 60_000
/** Per tab, so two tabs never follow each other's checkout. */
const CHECKOUT_STORAGE = 'flexprice.portal.checkout'

interface FollowedCheckout {
  id: string
  since: number
}

function readFollowed(): FollowedCheckout | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(CHECKOUT_STORAGE) ?? 'null') as unknown
    return value && typeof value === 'object' && 'id' in value && 'since' in value
      ? (value as FollowedCheckout)
      : null
  } catch {
    return null
  }
}

function writeFollowed(value: FollowedCheckout | null) {
  try {
    if (value) sessionStorage.setItem(CHECKOUT_STORAGE, JSON.stringify(value))
    else sessionStorage.removeItem(CHECKOUT_STORAGE)
  } catch {
    // Storage blocked: the checkout is followed until this page closes.
  }
}

/**
 * Follows the checkout the customer was just sent to. The gateway sends them
 * back without saying how it went, and its webhook may still be on its way, so
 * the session is read until it settles: completed, failed (cancelled too) or
 * expired. `onSettled` then runs once, and the portal's data is read again. The
 * checkout is kept in this tab's storage, so a reload keeps following it.
 */
export function usePortalCheckoutFollower(
  auth: PortalAuth,
  onSettled: (result: PortalCheckoutResult) => void,
) {
  const queryClient = useQueryClient()
  const [followed, setFollowed] = useState<FollowedCheckout | null>(readFollowed)
  const settled = useRef(onSettled)
  settled.current = onSettled
  const session = useQuery({
    queryKey: [
      ...queryKeys.customerPortal.all(auth.apiOrigin, auth.token),
      'checkout',
      followed?.id,
    ],
    queryFn: async () => toPortalCheckoutResult(await getPortalCheckoutSession(auth, followed!.id)),
    enabled: followed !== null,
    retry: false,
    gcTime: 0,
    refetchInterval: (query) =>
      query.state.data && query.state.data.status !== 'pending' ? false : CHECKOUT_POLL_MS,
  })
  const stop = useCallback(() => {
    writeFollowed(null)
    setFollowed(null)
  }, [])
  useEffect(() => {
    if (!followed) return
    const result = session.data
    if (result && result.status !== 'pending') {
      stop()
      void queryClient.invalidateQueries({
        queryKey: queryKeys.customerPortal.all(auth.apiOrigin, auth.token),
      })
      settled.current(result)
      return
    }
    // A checkout left open past the window is no longer watched; its row still says
    // "awaiting payment" and becomes failed when the gateway lets it expire.
    if (session.isError || Date.now() - followed.since > CHECKOUT_WATCH_MS) stop()
  }, [followed, session.data, session.isError, session.dataUpdatedAt, stop, queryClient, auth])
  const follow = useCallback((id: string) => {
    const next = { id, since: Date.now() }
    writeFollowed(next)
    setFollowed(next)
  }, [])
  return { follow, following: followed !== null }
}
