import { describe, expect, it } from 'vitest'
import { fromWire, toWireBody } from './wire'

describe('fromWire: snake_case JSON to what the mappers read', () => {
  it('camelCases keys at every depth and revives timestamps as dates', () => {
    expect(
      fromWire({
        billing_entity_id: 'be_1',
        created_at: '2026-01-02T03:04:05Z',
        line_items: [{ period_start: '2026-01-01T00:00:00Z', price_id: 'p1' }],
      }),
    ).toEqual({
      billingEntityId: 'be_1',
      createdAt: new Date('2026-01-02T03:04:05Z'),
      lineItems: [{ periodStart: new Date('2026-01-01T00:00:00Z'), priceId: 'p1' }],
    })
  })

  it('leaves metadata exactly as the customer wrote it', () => {
    expect(fromWire({ metadata: { cost_center: '2026-01-02T03:04:05Z' } })).toEqual({
      metadata: { cost_center: '2026-01-02T03:04:05Z' },
    })
  })
})

describe('toWireBody: camelCase request to the snake_case the API reads', () => {
  it('snake_cases keys but not the keys inside metadata', () => {
    expect(
      toWireBody({
        externalId: 'acme',
        addressLine1: '1 Main St',
        filters: [{ field: 'name', dataType: 'string', value: { string: 'x' } }],
        metadata: { costCenter: 'a' },
      }),
    ).toEqual({
      external_id: 'acme',
      address_line1: '1 Main St',
      filters: [{ field: 'name', data_type: 'string', value: { string: 'x' } }],
      metadata: { costCenter: 'a' },
    })
  })
})
