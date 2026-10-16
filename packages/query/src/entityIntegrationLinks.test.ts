import { describe, expect, it, vi } from 'vitest'
import type { Flexprice } from '@fp/api'
import { entityIntegrationKey, fetchEntityIntegrationLinks } from './entityIntegrationLinks'

describe('entity integration mappings', () => {
  it('separates invoice/plan cache entries even when IDs match', () => {
    expect(entityIntegrationKey('invoice', 'same')).not.toEqual(
      entityIntegrationKey('plan', 'same'),
    )
  })
  it('requests the actual entity and filters archived mappings', async () => {
    const get = vi.fn().mockResolvedValue({
      items: [
        {
          id: 'invoice-map',
          providerType: 'stripe',
          providerEntityId: 'in_external',
          status: 'published',
        },
        { id: 'archived', providerType: 'quickbooks', providerEntityId: 'old', status: 'archived' },
      ],
    })
    const client = { integrations: { getEntityIntegrationMappings: get } } as unknown as Flexprice
    const links = await fetchEntityIntegrationLinks(client, 'invoice', 'invoice-1')
    expect(get).toHaveBeenCalledWith('invoice', 'invoice-1', expect.anything())
    expect(links.map((link) => link.providerEntityId)).toEqual(['in_external'])
  })
  it('does not turn failed mapping reads into empty results', async () => {
    const client = {
      integrations: {
        getEntityIntegrationMappings: vi.fn().mockRejectedValue(new Error('offline')),
      },
    } as unknown as Flexprice
    await expect(fetchEntityIntegrationLinks(client, 'plan', 'plan-1')).rejects.toThrow()
  })
})
