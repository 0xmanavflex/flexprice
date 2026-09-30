import type { Money } from './money'

/**
 * One usage record and where it has been reported.
 *
 * Usage that bills through a cloud marketplace is pushed to it per billing
 * period. A record is one customer's usage on one subscription for one period,
 * and `syncs` says which marketplaces it reached and whether each accepted it.
 */
export interface UsageSyncEntry {
  /** The marketplace key, e.g. `aws_marketplace`. */
  provider: string
  /** A record can be deliberately not sent: no agreement to report against, say. */
  skipped: boolean
  skipReason: string
  syncedAt: Date | null
  reportingId: string
  agreementId: string
  connectionId: string
}

export interface UsageSync {
  id: string
  customerId: string
  /** The customer's id in the sender's system. Falls back to nothing, never a name. */
  customerExternalId: string
  subscriptionId: string
  planId: string
  amount: Money
  periodStart: Date | null
  periodEnd: Date | null
  syncs: UsageSyncEntry[]
}

export const USAGE_SYNC_STATE = {
  All: 'all',
  Synced: 'synced',
  Unsynced: 'unsynced',
} as const
export type UsageSyncState = (typeof USAGE_SYNC_STATE)[keyof typeof USAGE_SYNC_STATE]

export const USAGE_SYNC_STATE_LABEL: Record<UsageSyncState, string> = {
  all: 'All',
  synced: 'Synced',
  unsynced: 'Not synced',
}

export interface UsageSyncQuery {
  page: number
  pageSize: number
  /** Matched against the customer id, subscription id and plan id on the page. */
  search: string
  state: UsageSyncState
}

export const DEFAULT_USAGE_SYNC_QUERY: UsageSyncQuery = {
  page: 1,
  pageSize: 25,
  search: '',
  state: 'all',
}
