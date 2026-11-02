import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ApiError,
  ErrorKind,
  type AuthSource,
  type SelfBillingCheckoutWire,
  type SelfBillingFeatureUsageWire,
  type SelfBillingStatusWire,
  type SelfBillingPlanWire,
  type SelfBillingSummaryWire,
  cancelSelfBillingCheckout,
  createSelfBillingPortalSession,
  fetchSelfBillingCheckout,
  fetchSelfBillingStatus,
  fetchSelfBillingSummary,
  startSelfBillingCheckout,
} from '@fp/api'
import {
  AccountState,
  type CheckoutDetails,
  CheckoutStatus,
  type SelfBillingCheckout,
  type SelfBillingPlan,
  type SelfBillingStatus,
  type SelfBillingSummary,
  selfInvoiceStatus,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexpriceAuth, useFlexpriceServerURL } from './provider'

/**
 * Self-billing: the tenant's own Flexprice account.
 *
 * Keyed under `tenant`, with no environment in the key: the account is the
 * tenant's, the same whichever environment is selected. The status is read once
 * per session (it drives the pill and the lock on every page) and refetched
 * when a checkout settles.
 */

const STATES = new Set<string>(Object.values(AccountState))
const toState = (value: string | undefined): AccountState | null =>
  value && STATES.has(value) ? (value as AccountState) : null

/**
 * The summary's account state. Its `status` says only whether the account is
 * usable (`active`) or locked (`suspended`); a trial is `active` there and
 * `trialing` in `subscription_status`, which decides it.
 */
function summaryState(status: string | undefined, subscriptionStatus: string | undefined) {
  const state = toState(status)
  if (state === AccountState.Active && subscriptionStatus === 'trialing')
    return AccountState.Trialing
  return state
}

/** The event the invoice-value meter counts: what the tenant bills through Flexprice. */
const INVOICE_VALUE_EVENT = 'invoice_value'

const CHECKOUT_STATUSES = new Set<string>(Object.values(CheckoutStatus))

/** `2026-10-20T12:00:00Z` as `2026-10-20`; null for nothing or nonsense. */
function day(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

export function localToday(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function toSelfBillingStatus(wire: SelfBillingStatusWire): SelfBillingStatus {
  return { enabled: Boolean(wire.enabled), state: toState(wire.status) }
}

/** The usage feature metered on one of the events self-billing sends. */
function featureFor(
  features: readonly SelfBillingFeatureUsageWire[],
  eventName: string,
): SelfBillingFeatureUsageWire | undefined {
  return features.find(
    (f) => f.feature?.meter?.event_name === eventName || f.feature?.lookup_key === eventName,
  )
}

const number = (value: string | number | null | undefined) => {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

/**
 * The summary's plan, or null when it has none: the console prices nothing itself.
 *
 * A charge on the invoice-value meter is a share of what the tenant bills. The
 * charge names only its meter id, so it is recognised by that id against the
 * usage feature counting `invoice_value`, or else by its meter's name.
 */
export function toSelfBillingPlan(
  wire: SelfBillingPlanWire | null | undefined,
  features: readonly SelfBillingFeatureUsageWire[] = [],
): SelfBillingPlan | null {
  if (!wire || (!wire.id && !wire.name)) return null
  const invoiceValueMeter = featureFor(features, INVOICE_VALUE_EVENT)?.feature?.meter?.id
  return {
    id: wire.id ?? '',
    name: wire.name ?? '',
    description: wire.description ?? '',
    charges: (wire.charges ?? []).map((charge) => {
      const divideBy = Number(charge.transform_quantity?.divide_by ?? 0)
      const usage = (charge.type ?? '').toUpperCase() === 'USAGE'
      return {
        id: charge.price_id || charge.line_item_id || '',
        name: charge.display_name || charge.meter_display_name || '',
        type: usage ? ('usage' as const) : ('fixed' as const),
        amount: charge.amount ?? '0',
        currency: (charge.currency ?? 'usd').toUpperCase(),
        billingPeriod: charge.billing_period ?? '',
        billingPeriodCount: charge.billing_period_count ?? 1,
        divideBy: Number.isFinite(divideBy) && divideBy > 1 ? divideBy : null,
        meterName: usage ? charge.meter_display_name || null : null,
        shareOfBilled:
          usage &&
          ((Boolean(invoiceValueMeter) && charge.meter_id === invoiceValueMeter) ||
            /^invoice value$/i.test(
              (charge.meter_display_name || charge.display_name || '').trim(),
            )),
      }
    }),
  }
}

export function toSelfBillingSummary(
  wire: SelfBillingSummaryWire,
  today: string = localToday(),
): SelfBillingSummary {
  const features = wire.usage?.features ?? []
  const events = featureFor(features, 'events_ingested')
  const billed = featureFor(features, 'invoice_value')
  const start = day(wire.usage?.period?.start_time)
  const end = day(wire.usage?.period?.end_time)
  return {
    state: summaryState(wire.status, wire.subscription_status) ?? AccountState.Trialing,
    plan: toSelfBillingPlan(wire.plan, features),
    trialEndsOn: day(wire.trial_ends_at),
    invoices: (wire.invoices ?? []).map((invoice) => {
      const dueDate = day(invoice.due_date)
      return {
        id: invoice.id ?? '',
        number: invoice.number ?? '',
        status: selfInvoiceStatus(invoice.payment_status ?? '', dueDate, today),
        total: number(invoice.total),
        currency: (invoice.currency ?? 'usd').toUpperCase(),
        dueDate,
        pdfUrl: invoice.pdf_url || null,
      }
    }),
    events: events
      ? {
          used: number(events.current_usage),
          cap: events.is_unlimited ? null : (events.total_limit ?? null),
        }
      : null,
    billed: billed ? number(billed.current_usage) : null,
    period: start && end ? { start, end } : null,
  }
}

export function toSelfBillingCheckout(wire: SelfBillingCheckoutWire): SelfBillingCheckout {
  return {
    checkoutId: wire.checkout_id ?? '',
    url: wire.url ?? '',
    status:
      wire.status && CHECKOUT_STATUSES.has(wire.status)
        ? (wire.status as CheckoutStatus)
        : CheckoutStatus.Pending,
    terminal: Boolean(wire.terminal),
    state: toState(wire.tenant_status),
  }
}

async function credentials(auth: AuthSource): Promise<{ token: string; environmentId: string }> {
  const [token, environmentId] = await Promise.all([auth.getToken(), auth.getEnvironmentId()])
  if (!token) throw new ApiError(ErrorKind.Unauthorized, 'Sign in to see billing.')
  if (!environmentId)
    throw new ApiError(ErrorKind.Forbidden, 'Choose an environment to see billing.')
  return { token, environmentId }
}

const DISABLED: SelfBillingStatus = { enabled: false, state: null }

/**
 * Whether self-billing is on, and the tenant's state. Read once per session;
 * a deployment without self-billing answers as disabled, never as an error.
 */
export function useSelfBillingStatus(options: { enabled?: boolean } = {}) {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  return useQuery({
    queryKey: queryKeys.tenant.selfBillingStatus(),
    queryFn: async () => {
      try {
        return toSelfBillingStatus(await fetchSelfBillingStatus(serverURL, await credentials(auth)))
      } catch (error) {
        if (error instanceof ApiError && error.kind === ErrorKind.NotFound) return DISABLED
        throw error
      }
    },
    enabled: options.enabled ?? true,
    staleTime: Infinity,
  })
}

/** The billing page: state, trial, invoices and usage. Null when self-billing is off. */
export function useSelfBillingSummary(options: { enabled?: boolean } = {}) {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  return useQuery({
    queryKey: queryKeys.tenant.selfBillingSummary(),
    queryFn: async () => {
      try {
        return toSelfBillingSummary(
          await fetchSelfBillingSummary(serverURL, await credentials(auth)),
        )
      } catch (error) {
        if (error instanceof ApiError && error.kind === ErrorKind.NotFound) return null
        throw error
      }
    },
    enabled: options.enabled ?? true,
    staleTime: 60_000,
  })
}

/**
 * Refetches the status and the summary: after a checkout settles, the pill and
 * the lock follow: and the environment list: activation creates the
 * production environment, which "Open production" has to find.
 */
export function useRefreshSelfBilling() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant.selfBilling() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.session.environments() }),
    ])
}

/** The checkout body, as the API names the address. */
export function toCheckoutBody(details: CheckoutDetails) {
  return {
    name: details.name.trim(),
    email: details.email.trim(),
    address_line1: details.line1.trim(),
    address_line2: details.line2.trim(),
    address_city: details.city.trim(),
    address_state: details.state.trim(),
    address_country: details.country.trim().toUpperCase(),
    address_postal_code: details.postalCode.trim(),
    tax_id: details.taxId.trim(),
  }
}

/** Starts the upgrade: saves the billing details and returns Stripe Checkout's URL. */
export function useStartSelfBillingCheckout() {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  return useMutation({
    mutationFn: async (details: CheckoutDetails) =>
      toSelfBillingCheckout(
        await startSelfBillingCheckout(serverURL, await credentials(auth), toCheckoutBody(details)),
      ),
  })
}

/** How often the return page asks whether the payment has settled. */
const POLL_MS = 2_000

/**
 * One checkout, polled until it settles. Once it completes the account's
 * status and summary are refetched, so the pill and the lock lift.
 */
export function useSelfBillingCheckout(checkoutId: string | null) {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const refresh = useRefreshSelfBilling()
  const query = useQuery({
    queryKey: queryKeys.tenant.selfBillingCheckout(checkoutId ?? ''),
    queryFn: async () =>
      toSelfBillingCheckout(
        await fetchSelfBillingCheckout(serverURL, await credentials(auth), checkoutId as string),
      ),
    enabled: Boolean(checkoutId),
    refetchInterval: (q) => (q.state.data?.terminal ? false : POLL_MS),
    staleTime: 0,
  })
  const settled = query.data?.terminal ?? false
  useEffect(() => {
    if (settled) void refresh()
    // Refetch once per settle, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled])
  return query
}

/** Drops a checkout left before paying, so the next Upgrade starts a fresh one. */
export function useCancelSelfBillingCheckout() {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  return useMutation({
    mutationFn: async (checkoutId: string) =>
      cancelSelfBillingCheckout(serverURL, await credentials(auth), checkoutId),
  })
}

/** A short-lived billing portal link: pay an invoice, change the card, read invoices. */
export function useSelfBillingPortalSession() {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  return useMutation({
    mutationFn: async () => {
      const wire = await createSelfBillingPortalSession(serverURL, await credentials(auth))
      if (!wire.url) throw new ApiError(ErrorKind.Unknown, 'The billing portal did not open.')
      return wire.url
    },
  })
}

/** The API's refusal of a write while the account is locked: `403 "tenant account is suspended"`. */
export function isAccountLockedError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.kind === ErrorKind.Forbidden &&
    /suspended/i.test(error.message)
  )
}
