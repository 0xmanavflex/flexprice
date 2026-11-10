import { afterEach, describe, expect, it, vi } from 'vitest'
import { pushToIntegrations } from './integrationSync'

function harness() {
  const seen: Request[] = []
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push(new Request(input as RequestInfo, init))
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
  return { seen }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('pushToIntegrations', () => {
  it('names the chosen connection, so only that provider gets the push', async () => {
    const { seen } = harness()
    await pushToIntegrations('https://api.test', 'tok', 'env_1', {
      entityType: 'invoice',
      entityId: 'inv_1',
      connectionId: 'conn_stripe',
    })
    expect(seen[0]?.url).toBe('https://api.test/integrations/sync')
    await expect(seen[0]?.json()).resolves.toEqual({
      entity_type: 'invoice',
      entity_id: 'inv_1',
      method: 'push',
      connection_id: 'conn_stripe',
    })
  })

  it('sends no connection when none was chosen (every connected provider)', async () => {
    const { seen } = harness()
    await pushToIntegrations('https://api.test', 'tok', 'env_1', {
      entityType: 'customer',
      entityId: 'cust_1',
    })
    await expect(seen[0]?.json()).resolves.not.toHaveProperty('connection_id')
  })
})
