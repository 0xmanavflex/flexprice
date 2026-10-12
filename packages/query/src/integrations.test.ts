import { describe, expect, it } from 'vitest'
import { countConnections, toIntegrations } from './integrations'

describe('countConnections', () => {
  it('counts published connections per provider and ignores the rest', () => {
    const counts = countConnections([
      { provider_type: 'stripe', connection_status: 'published' },
      { provider_type: 'stripe' },
      { provider_type: 'stripe', connection_status: 'archived' },
      { provider_type: 'hubspot', connection_status: 'draft' },
      { connection_status: 'published' },
    ])
    expect(counts.get('stripe')).toBe(2)
    expect(counts.has('hubspot')).toBe(false)
  })
})

describe('toIntegrations', () => {
  it('lists the whole catalogue, matching zoho to its zoho_books connections', () => {
    const all = toIntegrations([{ provider_type: 'zoho_books', connection_status: 'published' }])
    expect(all.find((i) => i.id === 'zoho')?.connections).toBe(1)
    expect(all.find((i) => i.id === 'stripe')?.connections).toBe(0)
    expect(all.length).toBeGreaterThan(10)
  })

  it('attaches the published connection with its sync switches, and no secrets', () => {
    const all = toIntegrations([
      {
        id: 'conn_1',
        name: 'Stripe (live)',
        provider_type: 'stripe',
        connection_status: 'published',
        sync_config: { invoice: { outbound: true }, plan: { inbound: false } },
        metadata: { region: 'eu', ignored: 3 as unknown as string },
        created_at: '2026-10-01T00:00:00Z',
      },
      { id: 'conn_2', name: 'Old', provider_type: 'razorpay', connection_status: 'archived' },
    ])
    expect(all.find((i) => i.id === 'stripe')?.connection).toEqual({
      id: 'conn_1',
      name: 'Stripe (live)',
      providerType: 'stripe',
      syncConfig: { invoice: { outbound: true }, plan: { inbound: false } },
      metadata: { region: 'eu' },
      createdAt: '2026-10-01T00:00:00Z',
    })
    expect(all.find((i) => i.id === 'razorpay')?.connection).toBeUndefined()
  })
})
