import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_USAGE_SYNC_QUERY } from '@fp/domain'
import { fetchUsageSyncs, toUsageSync } from './usageSyncs'

const auth = { getToken: async () => 'jwt', getEnvironmentId: async () => 'env_1' }

afterEach(() => vi.unstubAllGlobals())

describe('toUsageSync', () => {
  it('maps a record and lists each provider it reached', () => {
    const row = toUsageSync({
      id: 'ur_1',
      customer_external_id: 'acme',
      subscription_id: 'sub_1',
      plan_id: 'plan_1',
      amount: '12.50',
      currency: 'usd',
      period_start: '2026-01-01T00:00:00Z',
      syncs: {
        aws_marketplace: { reporting_id: 'r1', synced_at: '2026-01-02T00:00:00Z' },
        gcp_marketplace: { skipped: true, skip_reason: 'no agreement' },
      },
    })
    expect(row.customerExternalId).toBe('acme')
    expect(row.syncs.map((s) => s.provider)).toEqual(['aws_marketplace', 'gcp_marketplace'])
    expect(row.syncs[1]).toMatchObject({ skipped: true, skipReason: 'no agreement' })
    expect(row.periodEnd).toBeNull()
  })

  it('reads a missing syncs map as none', () => {
    expect(toUsageSync({ id: 'x', syncs: null }).syncs).toEqual([])
  })
})

describe('fetchUsageSyncs', () => {
  it('posts paging and the synced flag, then narrows by search', async () => {
    let sent: Record<string, unknown> = {}
    vi.stubGlobal('fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body))
      return new Response(
        JSON.stringify({
          items: [
            { id: 'a', customer_external_id: 'acme' },
            { id: 'b', customer_external_id: 'globex' },
          ],
          pagination: { total: 40 },
        }),
        { status: 200 },
      )
    })
    const page = await fetchUsageSyncs('https://api.test/v1', auth, {
      ...DEFAULT_USAGE_SYNC_QUERY,
      page: 2,
      state: 'unsynced',
      search: 'glob',
    })
    expect(sent).toEqual({ limit: 25, offset: 25, synced: false })
    expect(page.usageSyncs.map((r) => r.id)).toEqual(['b'])
    expect(page.total).toBe(40)
  })

  it('sends no synced flag for all', async () => {
    let sent: Record<string, unknown> = {}
    vi.stubGlobal('fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body))
      return new Response(JSON.stringify({ items: [], pagination: { total: 0 } }), { status: 200 })
    })
    await fetchUsageSyncs('https://api.test/v1', auth, DEFAULT_USAGE_SYNC_QUERY)
    expect(sent).not.toHaveProperty('synced')
  })
})
