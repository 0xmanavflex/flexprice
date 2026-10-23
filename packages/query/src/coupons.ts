import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type Flexprice, call } from '@fp/api'
import {
  type Coupon,
  type CouponAssociation,
  type CouponQuery,
  CouponCadence,
  CouponSortField,
  CouponStatus,
  CouponType,
  type CreateCoupon,
  type EditCoupon,
  moneyOr,
  COUPON_FILTERS,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'
import { nameContainsFilter, statusFilterField, toFilterConditions } from './search'
import { sortWithTieBreak } from './listSort'
import { ALL_SUBSCRIPTION_STATUSES } from './subscriptionStatuses'

/**
 * Coupons: the translation between product vocabulary and the API.
 *
 * Reached through `POST /coupons/search` (`client.coupons.queryCoupon`), the
 * same search shape features, plans and add-ons use. The wire keeps a fixed
 * discount as a bare `amountOff` string beside a separate `currency`; the domain
 * joins them into a `Money` here, so no screen ever sees the two apart.
 */

/**
 * The wire shape this reads, after the SDK camelCases the response.
 *
 * `createdAt`/`updatedAt` arrive as `Date` (the SDK parses them); the redeem
 * window arrives as raw ISO strings, so those are parsed here.
 */
export interface CouponWire {
  id?: string | undefined
  name?: string | undefined
  couponCode?: string | undefined
  type?: string | undefined
  amountOff?: string | undefined
  percentageOff?: string | undefined
  currency?: string | undefined
  cadence?: string | undefined
  durationInPeriods?: number | undefined
  maxRedemptions?: number | undefined
  totalRedemptions?: number | undefined
  redeemAfter?: string | undefined
  redeemBefore?: string | undefined
  status?: string | undefined
  metadata?: { [k: string]: string } | undefined
  createdAt?: Date | undefined
  updatedAt?: Date | undefined
}

const COUPON_TYPES = new Set<string>(Object.values(CouponType))
const COUPON_CADENCES = new Set<string>(Object.values(CouponCadence))
const COUPON_STATUSES = new Set<string>(Object.values(CouponStatus))

function toDate(value: string | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function toCoupon(wire: CouponWire): Coupon {
  const type = COUPON_TYPES.has(wire.type ?? '') ? (wire.type as CouponType) : CouponType.Fixed
  const cadence = COUPON_CADENCES.has(wire.cadence ?? '')
    ? (wire.cadence as CouponCadence)
    : CouponCadence.Once
  const status = COUPON_STATUSES.has(wire.status ?? '')
    ? (wire.status as CouponStatus)
    : CouponStatus.Published

  return {
    id: wire.id ?? '',
    name: wire.name ?? 'Untitled coupon',
    code: wire.couponCode ?? '',
    type,
    // A fixed coupon carries a Money; a percentage coupon carries the raw
    // string the API sends ("10", not 0.1) — never both.
    amountOff: type === CouponType.Fixed ? moneyOr(wire.amountOff, wire.currency) : null,
    percentageOff: type === CouponType.Percentage ? (wire.percentageOff ?? '0') : null,
    cadence,
    durationInPeriods: cadence === CouponCadence.Repeated ? (wire.durationInPeriods ?? null) : null,
    maxRedemptions: wire.maxRedemptions ?? null,
    totalRedemptions: wire.totalRedemptions ?? 0,
    redeemAfter: toDate(wire.redeemAfter),
    redeemBefore: toDate(wire.redeemBefore),
    status,
    metadata: wire.metadata && Object.keys(wire.metadata).length > 0 ? wire.metadata : null,
    createdAt: wire.createdAt ?? null,
    updatedAt: wire.updatedAt ?? null,
  }
}

const SORT_FIELD: Record<CouponSortField, string> = {
  [CouponSortField.Name]: 'name',
  [CouponSortField.CreatedAt]: 'created_at',
  [CouponSortField.UpdatedAt]: 'updated_at',
}

export function toCouponFilter(query: CouponQuery): Record<string, unknown> {
  return {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    /*
     * Status, server-side.
     *
     * It used to narrow the fetched page in the browser, which is a different
     * and wrong thing: the request returns one page, rows are dropped from
     * *that* page, and the pager still reports the server's unfiltered total.
     * `status` is a declared field on this filter model and a real column the
     * backend accepts, so there was never a reason not to send it.
     */
    ...statusFilterField(query.statuses, Object.values(CouponStatus)),
    sort: sortWithTieBreak(SORT_FIELD[query.sortBy], query.sortDirection),
    ...(query.search || (query.filters?.length ?? 0) > 0
      ? {
          filters: [
            ...(query.search ? nameContainsFilter(query.search) : []),
            ...toFilterConditions(query.filters ?? [], COUPON_FILTERS),
          ],
        }
      : {}),
  }
}

export interface CouponPage {
  coupons: Coupon[]
  total: number
}

export async function fetchCoupons(client: Flexprice, query: CouponQuery): Promise<CouponPage> {
  const response = await call(() => client.coupons.queryCoupon(toCouponFilter(query) as never))
  const coupons = (response.items ?? []).map((item) => toCoupon(item as CouponWire))

  return {
    coupons,
    total: response.pagination?.total ?? 0,
  }
}

export function useCoupons(query: CouponQuery) {
  const client = useFlexprice()

  // `view` is a layout, not a filter: it must not miss the cache on a toggle.
  const { view: _view, ...key } = query

  return useQuery({
    queryKey: queryKeys.coupons.list({ ...key, statuses: [...query.statuses].sort() }),
    queryFn: () => fetchCoupons(client, query),
    placeholderData: (previous) => previous,
  })
}

/** One coupon, by id — `GET /coupons/{id}` (`client.coupons.getCoupon`). */
export function useCoupon(id: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.coupons.detail(id),
    queryFn: async () => {
      const response = await call(() => client.coupons.getCoupon(id))
      return toCoupon(response as CouponWire)
    },
    enabled: id.length > 0,
  })
}

/**
 * A coupon's edit is a rename.
 *
 * `UpdateCouponRequest` accepts only `name` and `metadata`; the discount and
 * its cadence are immutable once created. Metadata is sent only when the draft
 * carries it, so a rename leaves it alone.
 */
export function toUpdateCouponRequest(draft: EditCoupon): Record<string, unknown> {
  return { name: draft.name, ...(draft.metadata ? { metadata: draft.metadata } : {}) }
}

export function useUpdateCoupon() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: EditCoupon }) =>
      call(() => client.coupons.updateCoupon(id, toUpdateCouponRequest(draft) as never)),
    onSuccess: (_result, { id }) => {
      // The prefix covers every list and filter; the detail is refreshed by id.
      void queryClient.invalidateQueries({ queryKey: queryKeys.coupons.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.coupons.detail(id) })
    },
  })
}

/**
 * Archive a coupon — `DELETE /coupons/{id}`, a soft delete.
 *
 * The catalogue never hard-deletes; archiving flips the status so the coupon
 * stops being offered while the record (and its redemption history) survives.
 */
export function useArchiveCoupon() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => call(() => client.coupons.deleteCoupon(id)),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.coupons.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.coupons.detail(id) })
    },
  })
}

/**
 * The wire shape of one association, after the SDK camelCases the response.
 *
 * `startDate`/`endDate` arrive as `Date` (the SDK parses them). The nested
 * `coupon`, line item and price expansions are ignored here — the "where used"
 * table needs only the subscription and the window.
 */
export interface CouponAssociationWire {
  id?: string | undefined
  subscriptionId?: string | undefined
  status?: string | undefined
  startDate?: Date | undefined
  endDate?: Date | undefined
}

export function toCouponAssociation(wire: CouponAssociationWire): CouponAssociation {
  const status = COUPON_STATUSES.has(wire.status ?? '')
    ? (wire.status as CouponStatus)
    : CouponStatus.Published

  return {
    id: wire.id ?? '',
    subscriptionId: wire.subscriptionId ?? '',
    status,
    startDate: wire.startDate ?? null,
    endDate: wire.endDate ?? null,
  }
}

export interface CouponAssociationPage {
  associations: CouponAssociation[]
  total: number
}

/**
 * Where a coupon is used — `GET /coupons/associations`, filtered to this one.
 *
 * The endpoint is its own resource (`client.couponAssociations`), reached with
 * the coupon id and `activeOnly` off so the table shows the full history, not
 * only what is in force this instant.
 */
export function useCouponAssociations(couponId: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.coupons.associations(couponId),
    queryFn: async (): Promise<CouponAssociationPage> => {
      const response = await call(() =>
        client.couponAssociations.listCouponAssociations({
          couponIds: [couponId],
          limit: 100,
        } as never),
      )
      const items = (response.items ?? []).map((item) =>
        toCouponAssociation(item as CouponAssociationWire),
      )
      return { associations: items, total: response.pagination?.total ?? items.length }
    },
    enabled: couponId.length > 0,
  })
}

/**
 * Domain draft out, `CreateCouponRequest` in. Only the fields the coupon's type
 * uses are sent — a fixed coupon never carries `percentageOff` and vice versa —
 * and `durationInPeriods` only for a repeated cadence. The redemption window
 * goes out as ISO strings, which is what the request takes.
 */
export function toCreateCouponRequest(draft: CreateCoupon): Record<string, unknown> {
  return {
    name: draft.name,
    type: draft.type,
    cadence: draft.cadence,
    ...(draft.couponCode ? { couponCode: draft.couponCode } : {}),
    ...(draft.type === CouponType.Fixed
      ? { amountOff: draft.amountOff, currency: draft.currency }
      : { percentageOff: draft.percentageOff }),
    ...(draft.cadence === CouponCadence.Repeated && draft.durationInPeriods !== undefined
      ? { durationInPeriods: draft.durationInPeriods }
      : {}),
    ...(draft.redeemAfter ? { redeemAfter: draft.redeemAfter.toISOString() } : {}),
    ...(draft.redeemBefore ? { redeemBefore: draft.redeemBefore.toISOString() } : {}),
    ...(draft.maxRedemptions !== undefined ? { maxRedemptions: draft.maxRedemptions } : {}),
    ...(draft.metadata ? { metadata: draft.metadata } : {}),
  }
}

/** Create a coupon — `POST /coupons`. Call `mutateAsync(draft: CreateCoupon)`. */
export function useCreateCoupon() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    meta: { notify: { success: 'Coupon created', error: 'Could not create the coupon.' } },
    mutationFn: (draft: CreateCoupon) =>
      call(() => client.coupons.createCoupon(toCreateCouponRequest(draft) as never)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.coupons.all() })
    },
  })
}

/** One contract a coupon is applied to, named for the redemptions table. */
export interface CouponRedemptionRow {
  id: string
  contractId: string
  customer: string
  plan: string
  startDate: Date | null
  endDate: Date | null
  status: string
}

/**
 * Where a coupon is applied, by customer and plan: its associations, then
 * those contracts read back by id through the subscription search.
 */
export function useCouponRedemptions(couponId: string) {
  const client = useFlexprice()
  const associations = useCouponAssociations(couponId)
  const rows = associations.data?.associations ?? []
  const ids = [...new Set(rows.map((row) => row.subscriptionId).filter(Boolean))]

  return useQuery({
    queryKey: [...queryKeys.coupons.associations(couponId), 'contracts', ids],
    enabled: associations.isSuccess,
    queryFn: async (): Promise<CouponRedemptionRow[]> => {
      const byId = new Map<string, { customer: string; plan: string }>()
      if (ids.length > 0) {
        const response = await call(() =>
          client.subscriptions.querySubscription({
            subscriptionIds: ids,
            subscriptionStatus: ALL_SUBSCRIPTION_STATUSES,
            limit: ids.length,
            expand: 'customer,plan',
          } as never),
        )
        for (const item of (response.items ?? []) as Array<{
          id?: string
          customerId?: string
          customer?: { name?: string; email?: string }
          plan?: { name?: string }
          planId?: string
        }>) {
          if (!item.id) continue
          byId.set(item.id, {
            customer: item.customer?.name || item.customer?.email || item.customerId || 'Unknown',
            plan: item.plan?.name || item.planId || '—',
          })
        }
      }
      return rows.map((row) => ({
        id: row.id,
        contractId: row.subscriptionId,
        customer: byId.get(row.subscriptionId)?.customer ?? row.subscriptionId,
        plan: byId.get(row.subscriptionId)?.plan ?? '—',
        startDate: row.startDate,
        endDate: row.endDate,
        status: row.endDate && row.endDate.getTime() < Date.now() ? 'Ended' : 'Active',
      }))
    },
  })
}
