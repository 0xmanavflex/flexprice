import { describe, expect, it } from 'vitest'
import type { IntegrationConnection } from './integration'
import {
  awsTrustPolicy,
  connectSteps,
  connectionForEntity,
  connectionFormSchema,
  connectionSpecFor,
  connectionToFormValues,
  fieldsForStep,
  defaultConnectionValues,
  gcpSetupScript,
  marketplaceExternalId,
  manageFormSchema,
  oauthRedirectUri,
  toConnectionChanges,
  toConnectionPayload,
  toWebhookChanges,
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

  it('sends the webhook secret, and the connection id when given, in one create', () => {
    const stripe = spec('stripe')
    const values = defaultConnectionValues(stripe, 'Stripe')
    values.fields['secret_key'] = 'sk'
    values.fields['webhook_secret'] = 'whsec'
    const offPayload = toConnectionPayload(stripe, values)
    expect(offPayload.encrypted_secret_data).toEqual({ secret_key: 'sk', webhook_secret: 'whsec' })
    expect(offPayload).not.toHaveProperty('id')
    const perEntity = toConnectionPayload(stripe, values, { connectionId: 'conn_X' })
    expect(perEntity).toMatchObject({
      id: 'conn_X',
      encrypted_secret_data: { secret_key: 'sk', webhook_secret: 'whsec' },
    })
    expect(toWebhookChanges(stripe, values)).toEqual({
      encrypted_secret_data: { webhook_secret: 'whsec' },
    })
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

  it('sends AWS Marketplace the external ID its trust policy names, and the region as sync config', () => {
    const aws = spec('aws_marketplace')
    const values = defaultConnectionValues(aws, 'AWS Marketplace')
    values.fields['role_arn'] = 'arn:aws:iam::123456789012:role/fp'
    const payload = toConnectionPayload(aws, values, {
      externalId: marketplaceExternalId('t1', 'e1'),
    })
    expect(payload.encrypted_secret_data).toEqual({
      role_arn: 'arn:aws:iam::123456789012:role/fp',
      external_id: 't1_e1',
    })
    expect(payload.sync_config).toEqual({ aws_marketplace: { region: 'us-east-1' } })
  })

  it('never adds an external ID to other providers', () => {
    const tabs = spec('tabs')
    const values = defaultConnectionValues(tabs, 'Tabs')
    values.fields['api_key'] = 'k'
    expect(
      toConnectionPayload(tabs, values, { externalId: 't1_e1' }).encrypted_secret_data,
    ).toEqual({ api_key: 'k' })
  })
})

describe('marketplace setup', () => {
  it("trusts Flexprice's account only with the tenant's external ID", () => {
    const policy = JSON.parse(awsTrustPolicy('999988887777', 't1_e1')) as {
      Statement: { Principal: { AWS: string }; Condition: unknown }[]
    }
    expect(policy.Statement[0]!.Principal.AWS).toBe('arn:aws:iam::999988887777:root')
    expect(policy.Statement[0]!.Condition).toEqual({
      StringEquals: { 'sts:ExternalId': 't1_e1' },
    })
  })

  it('names the account and role in the GCP script', () => {
    const script = gcpSetupScript('999988887777', 'flexprice-metering')
    expect(script).toContain('FLEXPRICE_AWS_ACCOUNT_ID="999988887777"')
    expect(script).toContain('FLEXPRICE_AWS_ROLE_NAME="flexprice-metering"')
    expect(script).toContain(
      '--attribute-condition="attribute.aws_role == \'$FLEXPRICE_AWS_ROLE_NAME\'" \\\n',
    )
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

  it('has a webhook step only where the provider posts events, OAuth providers included', () => {
    expect(connectSteps(spec('razorpay'))).toEqual(['credentials', 'sync', 'webhook'])
    expect(connectSteps(spec('tabs'))).not.toContain('webhook')
    expect(connectSteps(spec('quickbooks'))).toEqual(['credentials', 'sync', 'webhook'])
  })

  it('keeps webhook fields the API needs at create on credentials', () => {
    const keys = (step: 'credentials' | 'webhook', perConnection: boolean) =>
      fieldsForStep(spec('chargebee'), step, perConnection).map((f) => f.key)
    expect(keys('webhook', false)).toEqual(['webhook_username', 'webhook_password'])
    expect(keys('webhook', true)).toEqual([])
    expect(keys('credentials', true)).toContain('webhook_password')
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

  it('ends the webhook URL with the connection id when given', () => {
    expect(webhookUrl('https://api.flexprice.io/v1', 'stripe', 't', 'e', 'conn_1')).toBe(
      'https://api.flexprice.io/v1/webhooks/stripe/t/e/conn_1',
    )
    expect(webhookUrl('https://api.flexprice.io/v1', 'tabs', 't', 'e', 'conn_1')).toBe(
      'https://api.flexprice.io/v1/webhooks/tabs/t/e',
    )
  })

  it('adds Stripe events for the inbound sync that needs them', () => {
    const stripe = spec('stripe')
    expect(webhookEvents(stripe, {})).not.toContain('product.created')
    expect(webhookEvents(stripe, { 'plan:inbound': true })).toContain('product.created')
    expect(webhookEvents(stripe, {})).not.toContain('invoice_payment.paid')
    expect(webhookEvents(stripe, { 'invoice:outbound': true })).toContain('invoice_payment.paid')
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
    billingEntityId: null,
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

  it('sends provider settings the form does not show back as they were saved', () => {
    const zoho = spec('zoho_books')
    const saved: IntegrationConnection = {
      ...connection,
      providerType: 'zoho_books',
      syncConfig: {
        invoice: { outbound: true },
        customer: { inbound: true },
        invoice_sync_settings: {
          payment_gateways: { enabled: true, gateways: ['paypal'] },
          submit_for_approval: true,
        },
      },
    }
    const values = connectionToFormValues(zoho, saved)
    values.sync['invoice:outbound'] = false
    expect(toConnectionChanges(zoho, saved, values).sync_config).toEqual({
      invoice: { outbound: false },
      customer: { inbound: true },
      invoice_sync_settings: {
        payment_gateways: { enabled: true, gateways: ['paypal'] },
        submit_for_approval: true,
      },
    })
  })

  it('requires the Chargebee webhook login as a pair', () => {
    const values = connectionToFormValues(chargebee, connection)
    values.fields['webhook_username'] = 'hook'
    expect(manageFormSchema(chargebee).safeParse(values).success).toBe(false)
  })
})

describe('connectionForEntity', () => {
  it('gives a connection without an entity to the default entity', () => {
    const entities = [
      { id: 'be_us', isDefault: true },
      { id: 'be_eu', isDefault: false },
    ]
    const unowned: IntegrationConnection = {
      id: 'conn_1',
      name: 'Stripe',
      providerType: 'stripe',
      syncConfig: {},
      metadata: {},
      billingEntityId: null,
    }
    const integration = { connections: [unowned] }
    expect(connectionForEntity(integration, 'be_us', entities)).toBe(unowned)
    expect(connectionForEntity(integration, 'be_eu', entities)).toBeNull()
  })
})

describe('Zoho invoice payment gateways', () => {
  const zoho = spec('zoho_books')
  const connection: IntegrationConnection = {
    id: 'connection',
    name: 'Zoho',
    providerType: 'zoho_books',
    metadata: {},
    billingEntityId: null,
    syncConfig: {
      invoice: { outbound: true, future: 'keep' },
      invoice_sync_settings: {
        payment_gateways: {
          enabled: true,
          gateways: ['paypal', 'future_gateway'],
          paypal_payment_method: 'adaptive',
          future: 'keep',
        },
        template_id: 'template',
      },
      future_settings: { enabled: true },
    },
  }
  it('round-trips unchanged settings without issuing an update', () => {
    expect(toConnectionChanges(zoho, connection, connectionToFormValues(zoho, connection))).toEqual(
      {},
    )
  })
  it('edits gateways without dropping opaque provider settings', () => {
    const values = connectionToFormValues(zoho, connection)
    values.zohoPaymentGateways = {
      enabled: true,
      gateways: ['stripe', 'future_gateway'],
      paypalPaymentMethod: 'standard',
    }
    expect(toConnectionChanges(zoho, connection, values).sync_config).toEqual({
      invoice: { outbound: true, future: 'keep' },
      invoice_sync_settings: {
        template_id: 'template',
        payment_gateways: { enabled: true, gateways: ['stripe', 'future_gateway'], future: 'keep' },
      },
      future_settings: { enabled: true },
    })
  })
  it('rejects enabling gateways without a choice', () => {
    const values = connectionToFormValues(zoho, connection)
    values.zohoPaymentGateways = { enabled: true, gateways: [], paypalPaymentMethod: 'standard' }
    expect(manageFormSchema(zoho).safeParse(values).success).toBe(false)
  })
  it('includes gateway configuration when creating a connection', () => {
    const values = defaultConnectionValues(zoho, 'Zoho')
    values.zohoPaymentGateways = {
      enabled: true,
      gateways: ['paypal'],
      paypalPaymentMethod: 'adaptive',
    }
    expect(toConnectionPayload(zoho, values).sync_config).toMatchObject({
      invoice_sync_settings: {
        payment_gateways: {
          enabled: true,
          gateways: ['paypal'],
          paypal_payment_method: 'adaptive',
        },
      },
    })
  })
  it('defaults new QuickBooks connections to the active environment', () => {
    expect(
      defaultConnectionValues(spec('quickbooks'), 'QuickBooks', 'production').fields['environment'],
    ).toBe('production')
    expect(
      defaultConnectionValues(spec('quickbooks'), 'QuickBooks', 'development').fields[
        'environment'
      ],
    ).toBe('sandbox')
  })
})
