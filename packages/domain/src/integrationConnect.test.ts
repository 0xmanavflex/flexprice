import { describe, expect, it } from 'vitest'
import type { IntegrationConnection } from './integration'
import {
  connectSteps,
  connectionFormSchema,
  connectionSpecFor,
  connectionToFormValues,
  defaultConnectionValues,
  manageFormSchema,
  oauthRedirectUri,
  toConnectionChanges,
  toConnectionPayload,
  webhookEvents,
  webhookUrl,
} from './integrationConnect'

const spec = (id: string) => connectionSpecFor(id)!

describe('connect payload', () => {
  it('puts keys in encrypted_secret_data and leaves blank optional values out', () => {
    const razorpay = spec('razorpay')
    const values = defaultConnectionValues(razorpay, 'Razorpay')
    values.fields['key_id'] = ' rzp_test_1 '
    values.fields['secret_key'] = 'shh'
    values.sync['invoice:outbound'] = true

    expect(toConnectionPayload(razorpay, values)).toEqual({
      name: 'Razorpay',
      provider_type: 'razorpay',
      encrypted_secret_data: { key_id: 'rzp_test_1', secret_key: 'shh' },
      sync_config: { invoice: { outbound: true } },
    })
  })

  it('sends every offered direction, including the ones switched off', () => {
    const stripe = spec('stripe')
    const payload = toConnectionPayload(stripe, defaultConnectionValues(stripe, 'Stripe'))
    expect(payload.sync_config).toMatchObject({ plan: { inbound: false } })
  })

  it('routes metadata fields out of the secrets', () => {
    const zoho = spec('zoho_books')
    const values = defaultConnectionValues(zoho, 'Zoho Books')
    values.fields['client_id'] = 'id'
    values.fields['client_secret'] = 'secret'
    values.fields['organization_id'] = '60001'
    const payload = toConnectionPayload(zoho, values)
    expect(payload.encrypted_secret_data).toEqual({ client_id: 'id', client_secret: 'secret' })
    expect(payload.metadata).toMatchObject({ organization_id: '60001' })
  })
})

describe('connect form', () => {
  it('requires the provider keys', () => {
    const razorpay = spec('razorpay')
    const result = connectionFormSchema(razorpay).safeParse(
      defaultConnectionValues(razorpay, 'Razorpay'),
    )
    expect(result.success).toBe(false)
  })

  it('has a webhook step only where the provider posts events', () => {
    expect(connectSteps(spec('razorpay'))).toEqual(['credentials', 'sync', 'webhook'])
    expect(connectSteps(spec('tabs'))).not.toContain('webhook')
  })

  it('does not offer sync combinations the API rejects', () => {
    const offered = Object.values(
      Object.fromEntries(
        Object.keys(defaultConnectionValues(spec('stripe'), 'Stripe').sync).map((key) => [
          key,
          key,
        ]),
      ),
    )
    for (const rejected of ['plan:outbound', 'subscription:outbound', 'invoice:inbound'])
      expect(offered).not.toContain(rejected)
  })
})

describe('addresses', () => {
  it('builds the webhook URL from the API base, tenant and environment', () => {
    expect(webhookUrl('https://api.flexprice.io/v1/', 'stripe', 't1', 'e1')).toBe(
      'https://api.flexprice.io/v1/webhooks/stripe/t1/e1',
    )
  })

  it('adds Stripe events for the inbound sync that needs them', () => {
    const stripe = spec('stripe')
    expect(webhookEvents(stripe, {})).not.toContain('product.created')
    expect(webhookEvents(stripe, { 'plan:inbound': true })).toContain('product.created')
  })

  it('points the redirect URI at the callback path the API is configured with', () => {
    expect(oauthRedirectUri('https://app.flexprice.io/')).toBe(
      'https://app.flexprice.io/tools/integrations/oauth/callback',
    )
  })
})

describe('manage changes', () => {
  const connection: IntegrationConnection = {
    id: 'conn_1',
    name: 'Chargebee',
    providerType: 'chargebee',
    syncConfig: { invoice: { outbound: false } },
    metadata: {},
  }
  const chargebee = spec('chargebee')

  it('sends nothing when nothing changed', () => {
    expect(
      toConnectionChanges(chargebee, connection, connectionToFormValues(chargebee, connection)),
    ).toEqual({})
  })

  it('sends only the name, a merged sync config and non-blank rotatable secrets', () => {
    const values = connectionToFormValues(chargebee, connection)
    values.name = 'Chargebee (prod)'
    values.sync['invoice:outbound'] = true
    values.fields['webhook_username'] = 'hook'
    values.fields['webhook_password'] = 'pw'
    expect(toConnectionChanges(chargebee, connection, values)).toEqual({
      name: 'Chargebee (prod)',
      sync_config: { invoice: { outbound: true } },
      encrypted_secret_data: { webhook_username: 'hook', webhook_password: 'pw' },
    })
  })

  it('requires the Chargebee webhook login as a pair', () => {
    const values = connectionToFormValues(chargebee, connection)
    values.fields['webhook_username'] = 'hook'
    expect(manageFormSchema(chargebee).safeParse(values).success).toBe(false)
  })
})
