import { useQuery } from '@tanstack/react-query'
import { ApiError, type AuthSource, ErrorKind, searchUsageRecords } from '@fp/api'
import { type UsageSync, type UsageSyncEntry, type UsageSyncQuery, moneyOr } from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexpriceAuth, useFlexpriceServerURL } from './provider'

/**
 * Usage syncs, through `POST /usage-records/search`: a route the SDK has no
 * method for, so this reads the raw snake_case body (see `@fp/api`
 * `usageRecords.ts`). Whether a record is synced is a server-side filter;
 * search narrows the returned page.
 */

export interface UsageSyncEntryWire {
  agreement_id?: string
  reporting_id?: string
  synced_at?: string
  skipped?: boolean
  skip_reason?: string
  connection_id?: string
}

export interface UsageSyncWire {
  id?: string
  customer_id?: string
  customer_external_id?: string
  subscription_id?: string
  plan_id?: string
  amount?: string | number
  currency?: string
  period_start?: string
  period_end?: string
  syncs?: Record<string, UsageSyncEntryWire> | null
}

function toDate(value: string | undefined): Date | null {
  const parsed = value ? new Date(value) : null
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null
}

export function toUsageSync(wire: UsageSyncWire): UsageSync {
  const syncs: UsageSyncEntry[] = Object.entries(wire.syncs ?? {}).map(([provider, entry]) => ({
    provider,
    skipped: entry.skipped === true,
    skipReason: entry.skip_reason ?? '',
    syncedAt: toDate(entry.synced_at),
    reportingId: entry.reporting_id ?? '',
    agreementId: entry.agreement_id ?? '',
    connectionId: entry.connection_id ?? '',
  }))
  return {
    id: wire.id ?? '',
    customerId: wire.customer_id ?? '',
    customerExternalId: wire.customer_external_id ?? '',
    subscriptionId: wire.subscription_id ?? '',
    planId: wire.plan_id ?? '',
    amount: moneyOr(wire.amount === undefined ? undefined : String(wire.amount), wire.currency),
    periodStart: toDate(wire.period_start),
    periodEnd: toDate(wire.period_end),
    syncs,
  }
}

export interface UsageSyncPage {
  usageSyncs: UsageSync[]
  total: number
}

export async function fetchUsageSyncs(
  serverURL: string,
  auth: AuthSource,
  query: UsageSyncQuery,
): Promise<UsageSyncPage> {
  const [token, environmentId] = await Promise.all([auth.getToken(), auth.getEnvironmentId()])
  if (!token) throw new ApiError(ErrorKind.Unauthorized, 'Sign in to view usage syncs.')

  const body = await searchUsageRecords(serverURL, token, environmentId ?? '', {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    ...(query.state === 'all' ? {} : { synced: query.state === 'synced' }),
  })
  const record = (body ?? {}) as { items?: UsageSyncWire[] | null; pagination?: { total?: number } }
  const all = (record.items ?? []).map(toUsageSync)

  const term = query.search.trim().toLowerCase()
  const usageSyncs = term
    ? all.filter((row) =>
        [row.customerExternalId, row.customerId, row.subscriptionId, row.planId].some((field) =>
          field.toLowerCase().includes(term),
        ),
      )
    : all

  return { usageSyncs, total: record.pagination?.total ?? all.length }
}

export function useUsageSyncs(query: UsageSyncQuery) {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()

  return useQuery({
    queryKey: queryKeys.usageSyncs.list({ ...query }),
    queryFn: () => fetchUsageSyncs(serverURL, auth, query),
    placeholderData: (previous) => previous,
  })
}
