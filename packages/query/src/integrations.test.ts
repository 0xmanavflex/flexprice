import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchIntegrations, toIntegrations } from './integrations'

describe('toIntegrations', () => {
  it('lists the whole catalogue, matching zoho to its zoho_books connections', () => {
    const all = toIntegrations([
      { id: 'conn_z', provider_type: 'zoho_books', connection_status: 'published' },
    ])
    expect(all.find((i) => i.id === 'zoho')?.connections).toHaveLength(1)
    expect(all.find((i) => i.id === 'stripe')?.connections).toEqual([])
    expect(all.length).toBeGreaterThan(10)
  })

  it('keeps every published connection per provider in wire order, with its entity and no secrets', () => {
    const all = toIntegrations([
      {
        id: 'conn_1',
        name: 'Stripe (live)',
        provider_type: 'stripe',
        connection_status: 'published',
        billing_entity_id: 'be_1',
        sync_config: { invoice: { outbound: true }, plan: { inbound: false } },
        metadata: { region: 'eu', ignored: 3 as unknown as string },
        created_at: '2026-10-01T00:00:00Z',
      },
      { id: 'conn_2', name: 'Stripe EU', provider_type: 'stripe', billing_entity_id: 'be_2' },
      { id: 'conn_3', name: 'Draft', provider_type: 'stripe', connection_status: 'draft' },
      { id: 'conn_4', name: 'Old', provider_type: 'razorpay', connection_status: 'archived' },
    ])
    const stripe = all.find((i) => i.id === 'stripe')!
    expect(stripe.connections.map((c) => [c.id, c.billingEntityId])).toEqual([
      ['conn_1', 'be_1'],
      ['conn_2', 'be_2'],
    ])
    expect(stripe.connections[0]).toEqual({
      id: 'conn_1',
      name: 'Stripe (live)',
      providerType: 'stripe',
      syncConfig: { invoice: { outbound: true }, plan: { inbound: false } },
      metadata: { region: 'eu' },
      billingEntityId: 'be_1',
      createdAt: '2026-10-01T00:00:00Z',
    })
    expect(all.find((i) => i.id === 'razorpay')?.connections).toEqual([])
  })
})

describe('fetchIntegrations', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reads every page of connections, not just the first hundred', async () => {
    const row = (n: number) => ({
      id: `conn_${n}`,
      name: `Stripe ${n}`,
      provider_type: 'stripe',
      connection_status: 'published',
      status: 'published',
    })
    const all = Array.from({ length: 130 }, (_, n) => row(n))
    const offsets: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL) => {
        const url = new URL(String(input))
        const offset = Number(url.searchParams.get('offset'))
        const limit = Number(url.searchParams.get('limit'))
        offsets.push(String(offset))
        return new Response(
          JSON.stringify({
            connections: all.slice(offset, offset + limit),
            total: all.length,
            limit,
            offset,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }),
    )
    const integrations = await fetchIntegrations('https://api.test/v1', {
      getToken: async () => 'token',
      getEnvironmentId: async () => 'env_1',
    } as never)
    expect(offsets).toEqual(['0', '100'])
    expect(integrations.find((i) => i.providerType === 'stripe')?.connections).toHaveLength(130)
  })
})
