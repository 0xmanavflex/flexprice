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
  type EditCoupon,
  moneyOr,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'
import { nameContainsFilter } from './search'

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
    sort: [{ field: SORT_FIELD[query.sortBy], direction: query.sortDirection }],
    ...(query.search ? { filters: nameContainsFilter(query.search) } : {}),
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
    // Status is not a server-side filter here, so it is applied on the page —
    // the same split add-ons use.
    coupons:
      query.statuses.length > 0
        ? coupons.filter((coupon) => query.statuses.includes(coupon.status))
        : coupons,
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
 * its cadence are immutable once created. The draft carries the one editable
 * field, so this is the whole request.
 */
export function toUpdateCouponRequest(draft: EditCoupon): Record<string, unknown> {
  return { name: draft.name }
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
