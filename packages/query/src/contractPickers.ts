import { fetchFeatures } from './features'
import { fetchPriceUnits } from './priceUnits'
import { useQuery } from '@tanstack/react-query'
import {
  DEFAULT_FEATURE_QUERY,
  DEFAULT_PRICE_UNIT_QUERY,
  DEFAULT_CUSTOMER_QUERY,
  DEFAULT_PLAN_QUERY,
  DEFAULT_COUPON_QUERY,
  CouponStatus,
} from '@fp/domain'
import { fetchCustomers } from './customers'
import { fetchPlans } from './plans'
import { fetchCoupons } from './coupons'
import { useFlexprice, useFlexpriceAuth, useFlexpriceServerURL } from './provider'

/** A complete picker catalogue, read in bounded pages rather than one capped request. */
export async function collectPickerPages<T>(
  fetchPage: (page: number) => Promise<{ items: T[]; total: number }>,
): Promise<T[]> {
  const all: T[] = []
  for (let page = 1; ; page++) {
    const result = await fetchPage(page)
    all.push(...result.items)
    if (result.items.length === 0 || (result.total > 0 && all.length >= result.total)) return all
  }
}

export function useContractPickerCustomers() {
  const auth = useFlexpriceAuth()
  const serverURL = useFlexpriceServerURL()
  return useQuery({
    queryKey: ['customers', 'contract-picker', 'all-pages'],
    queryFn: async ({ signal }) => ({
      customers: await collectPickerPages(async (page) => {
        const result = await fetchCustomers(
          serverURL,
          auth,
          { ...DEFAULT_CUSTOMER_QUERY, page, pageSize: 100 },
          signal,
        )
        return { items: result.customers, total: result.total }
      }),
    }),
  })
}

export function useContractPickerPlans() {
  const client = useFlexprice()
  return useQuery({
    queryKey: ['plans', 'contract-picker', 'all-pages'],
    queryFn: async ({ signal }) => ({
      plans: await collectPickerPages(async (page) => {
        const result = await fetchPlans(
          client,
          { ...DEFAULT_PLAN_QUERY, page, pageSize: 100 },
          signal,
        )
        return { items: result.plans, total: result.total }
      }),
    }),
  })
}

export function useContractPickerCoupons() {
  const client = useFlexprice()
  return useQuery({
    queryKey: ['coupons', 'contract-picker', 'all-pages'],
    queryFn: async () => ({
      coupons: await collectPickerPages(async (page) => {
        const result = await fetchCoupons(client, {
          ...DEFAULT_COUPON_QUERY,
          statuses: [CouponStatus.Published],
          page,
          pageSize: 100,
        })
        return { items: result.coupons, total: result.total }
      }),
    }),
  })
}

export function useContractPickerFeatures() {
  const client = useFlexprice()
  return useQuery({
    queryKey: ['features', 'contract-picker', 'all-pages'],
    queryFn: async ({ signal }) => ({
      features: await collectPickerPages(async (page) => {
        const result = await fetchFeatures(
          client,
          { ...DEFAULT_FEATURE_QUERY, page, pageSize: 100 },
          signal,
        )
        return { items: result.features, total: result.total }
      }),
    }),
  })
}

export function useContractPickerPriceUnits() {
  const client = useFlexprice()
  return useQuery({
    queryKey: ['priceUnits', 'contract-picker', 'all-pages'],
    queryFn: async () => ({
      priceUnits: await collectPickerPages(async (page) => {
        const result = await fetchPriceUnits(client, {
          ...DEFAULT_PRICE_UNIT_QUERY,
          page,
          pageSize: 100,
        })
        return { items: result.priceUnits, total: result.total }
      }),
    }),
  })
}
