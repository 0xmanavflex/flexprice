import { describe, expect, it } from 'vitest'
import { BillingEntityMode } from './billingEntity'
import type { IntegrationConnection } from './integration'
import { gatewayCandidates, preferredGateway } from './paymentGateway'

const connection = (
  id: string,
  providerType: string,
  billingEntityId: string | null,
): IntegrationConnection => ({
  id,
  name: id,
  providerType,
  syncConfig: {},
  metadata: {},
  billingEntityId,
})

const entities = [
  { id: 'be_us', isDefault: true },
  { id: 'be_in', isDefault: false },
]

const connections = [
  connection('stripe_us', 'stripe', 'be_us'),
  connection('stripe_default', 'stripe', null),
  connection('razorpay_in', 'razorpay', 'be_in'),
  connection('quickbooks_in', 'quickbooks', 'be_in'),
  connection('hubspot_us', 'hubspot', 'be_us'),
]

const ids = (items: IntegrationConnection[]) => items.map((item) => item.id)

describe('gatewayCandidates', () => {
  it("keeps only the customer's entity's payment connections while entities are enabled", () => {
    expect(
      ids(gatewayCandidates(connections, { billingEntityId: 'be_in' }, entities, 'enabled')),
    ).toEqual(['razorpay_in'])
  })

  it('treats a missing entity on the customer or the connection as the default entity', () => {
    expect(ids(gatewayCandidates(connections, {}, entities, BillingEntityMode.Enabled))).toEqual([
      'stripe_us',
      'stripe_default',
    ])
  })

  it.each([BillingEntityMode.Off, BillingEntityMode.Enabling, undefined])(
    'offers every payment connection in the environment when the mode is %s',
    (mode) => {
      expect(
        ids(gatewayCandidates(connections, { billingEntityId: 'be_in' }, entities, mode)),
      ).toEqual(['stripe_us', 'stripe_default', 'razorpay_in'])
    },
  )
})

describe('preferredGateway', () => {
  const candidates = [{ id: 'razorpay_in' }]

  it('shows the preferred connection while it is a candidate', () => {
    expect(preferredGateway('razorpay_in', candidates)).toBe('razorpay_in')
  })

  it('falls back to Automatic for a stale or missing preference', () => {
    expect(preferredGateway('stripe_us', candidates)).toBeNull()
    expect(preferredGateway(undefined, candidates)).toBeNull()
  })
})
