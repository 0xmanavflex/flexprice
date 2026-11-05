import { z } from 'zod'
import { effectiveEntityId, type BillingEntity } from './billingEntity'
import type { IntegrationConnection } from './integration'
import { DOCS } from './docsLinks'

/**
 * How each provider is connected: the fields it needs, which of them are
 * secrets, what Flexprice can sync with it, and whether it calls back.
 *
 * This is product knowledge taken from the connections API (`POST /connections`,
 * `POST /oauth/init`), so the connect sheet renders one spec instead of one
 * hand-built form per provider. Two facts shape it:
 *
 *   - The API never returns a secret. A secret field is write-only: there is
 *     nothing to prefill and no "configured" flag to show.
 *   - Only a few secrets can be changed after creation (see `rotatable`).
 *     Everything else means disconnect and connect again.
 */

export type ConnectionFieldKind = 'text' | 'secret' | 'select' | 'textarea'

export interface ConnectionFieldOption {
  value: string
  label: string
}

export interface ConnectionField {
  /** Wire key inside `encrypted_secret_data`, or inside `metadata` when `target` says so. */
  key: string
  label: string
  kind: ConnectionFieldKind
  required: boolean
  placeholder?: string
  hint?: string
  options?: ConnectionFieldOption[]
  defaultValue?: string
  /** `secret` (default) goes in `encrypted_secret_data`, `metadata` in `metadata`, `sync` in `sync_config`. */
  target?: 'secret' | 'metadata' | 'sync'
  /** Checked when the field is not empty. */
  pattern?: { test: RegExp; message: string }
  /** The step the field lives on. Webhook secrets sit beside the webhook URL they belong to. */
  step?: 'credentials' | 'webhook'
  /** Can be changed on an existing connection. */
  rotatable?: boolean
  /** A webhook field the API needs at create, so it stays on credentials when the webhook is set after create. */
  atCreate?: boolean
}

export type SyncEntity =
  'plan' | 'subscription' | 'invoice' | 'customer' | 'payment' | 'price' | 'deal' | 'quote'

export interface SyncOption {
  entity: SyncEntity
  direction: 'inbound' | 'outbound'
  label: string
  description: string
  /** On unless the reader turns it off. Providers with a single fixed sync use this. */
  defaultOn?: boolean
}

export interface ConnectionSpec {
  providerType: string
  /** `oauth` hands the reader to the provider after the form; `credentials` creates the connection directly. */
  setup: 'credentials' | 'oauth'
  fields: ConnectionField[]
  sync: SyncOption[]
  /** Providers that post events back; the sheet shows the URL to register and the events to subscribe to. */
  webhook?: { events: string[] }
  /** What the reader has to do at the provider first, shown above the fields. */
  prerequisites?: string[]
  /** The provider's own docs for finding these values. */
  credentialHelp?: string
}

const secret = (
  key: string,
  label: string,
  extra: Partial<ConnectionField> = {},
): ConnectionField => ({
  key,
  label,
  kind: 'secret',
  required: true,
  ...extra,
})

const text = (
  key: string,
  label: string,
  extra: Partial<ConnectionField> = {},
): ConnectionField => ({
  key,
  label,
  kind: 'text',
  required: true,
  ...extra,
})

const webhookSecret = (extra: Partial<ConnectionField> = {}): ConnectionField =>
  secret('webhook_secret', 'Webhook signing secret', {
    step: 'webhook',
    hint: 'Created at the provider when you register the webhook URL above.',
    ...extra,
  })

const pushInvoices: SyncOption = {
  entity: 'invoice',
  direction: 'outbound',
  label: 'Push invoices',
  description: 'Send Flexprice invoices to the provider when they are finalised.',
}

export const CONNECTION_SPECS: Record<string, ConnectionSpec> = {
  stripe: {
    providerType: 'stripe',
    setup: 'credentials',
    // Every key can be replaced on Configure: the API merges whichever are sent.
    fields: [
      secret('secret_key', 'Secret key', { placeholder: 'sk_live_…', rotatable: true }),
      text('publishable_key', 'Publishable key', { placeholder: 'pk_live_…', rotatable: true }),
      webhookSecret({ placeholder: 'whsec_…', rotatable: true }),
    ],
    sync: [
      {
        entity: 'customer',
        direction: 'outbound',
        label: 'Push customers',
        description:
          'Create a Stripe customer for each Flexprice customer. Stripe Tax needs it to calculate tax.',
      },
      {
        entity: 'plan',
        direction: 'inbound',
        label: 'Pull plans',
        description: 'Import Stripe products as Flexprice plans.',
      },
      {
        entity: 'subscription',
        direction: 'inbound',
        label: 'Pull subscriptions',
        description: 'Create Flexprice subscriptions from Stripe ones.',
      },
      pushInvoices,
      {
        entity: 'price',
        direction: 'outbound',
        label: 'Push prices',
        description: 'Create matching Stripe prices for Flexprice ones.',
      },
    ],
    webhook: {
      events: [
        'checkout.session.completed',
        'checkout.session.async_payment_succeeded',
        'checkout.session.async_payment_failed',
        'checkout.session.expired',
        'customer.created',
        'payment_intent.payment_failed',
        'payment_intent.succeeded',
        'setup_intent.succeeded',
      ],
    },
    credentialHelp: DOCS.integrations.stripe,
  },
  razorpay: {
    providerType: 'razorpay',
    setup: 'credentials',
    fields: [
      text('key_id', 'Key ID', { placeholder: 'rzp_live_…' }),
      secret('secret_key', 'Key secret'),
      webhookSecret(),
    ],
    sync: [pushInvoices],
    webhook: {
      events: [
        'payment.captured',
        'payment.failed',
        'payment_link.paid',
        'payment_link.expired',
        'payment_link.cancelled',
      ],
    },
    credentialHelp: DOCS.integrations.razorpay,
  },
  chargebee: {
    providerType: 'chargebee',
    setup: 'credentials',
    fields: [
      text('site', 'Site', {
        placeholder: 'acme-test',
        hint: 'The part before .chargebee.com in your Chargebee address.',
        pattern: {
          test: /^[a-zA-Z0-9][a-zA-Z0-9-]{0,62}$/,
          message: 'Use only the site name, without .chargebee.com.',
        },
      }),
      secret('api_key', 'API key'),
      text('webhook_username', 'Webhook username', {
        step: 'webhook',
        atCreate: true,
        hint: 'Chargebee signs webhooks with HTTP Basic auth. Choose any username and password, then enter the same pair on the webhook.',
        rotatable: true,
      }),
      secret('webhook_password', 'Webhook password', {
        step: 'webhook',
        atCreate: true,
        rotatable: true,
      }),
    ],
    sync: [pushInvoices],
    webhook: { events: ['payment_succeeded'] },
    credentialHelp: DOCS.integrations.chargebee,
  },
  hubspot: {
    providerType: 'hubspot',
    setup: 'credentials',
    fields: [
      secret('access_token', 'Private app access token', { placeholder: 'pat-…' }),
      secret('client_secret', 'Client secret'),
    ],
    sync: [
      pushInvoices,
      {
        entity: 'deal',
        direction: 'outbound',
        label: 'Push deals',
        description: 'Create HubSpot deals for Flexprice subscriptions.',
      },
      {
        entity: 'quote',
        direction: 'outbound',
        label: 'Push quotes',
        description: 'Create HubSpot quotes for Flexprice contracts.',
      },
    ],
    webhook: { events: ['deal.propertyChange (dealstage)'] },
    prerequisites: [
      'Create a private app in HubSpot with the CRM contacts, line items, deals and quotes scopes.',
    ],
  },
  quickbooks: {
    providerType: 'quickbooks',
    setup: 'oauth',
    fields: [
      secret('client_id', 'Client ID'),
      secret('client_secret', 'Client secret'),
      text('environment', 'Environment', {
        kind: 'select',
        target: 'metadata',
        defaultValue: 'sandbox',
        options: [
          { value: 'sandbox', label: 'Sandbox' },
          { value: 'production', label: 'Production' },
        ],
      }),
      text('income_account_id', 'Income account ID', {
        required: false,
        target: 'metadata',
        placeholder: '79',
        hint: "Defaults to QuickBooks' standard income account (79).",
      }),
      secret('webhook_verifier_token', 'Webhook verifier token', {
        required: false,
        step: 'webhook',
        rotatable: true,
        hint: 'Only needed when you sync payments back from QuickBooks.',
      }),
    ],
    sync: [
      pushInvoices,
      {
        entity: 'payment',
        direction: 'inbound',
        label: 'Pull payments',
        description: 'Record QuickBooks payments against Flexprice invoices.',
      },
    ],
    webhook: { events: ['Payment.Create'] },
    prerequisites: [
      'Add the redirect URI below to your QuickBooks app. QuickBooks sends the reader back there to approve access.',
    ],
  },
  zoho_books: {
    providerType: 'zoho_books',
    setup: 'oauth',
    fields: [
      secret('client_id', 'Client ID'),
      secret('client_secret', 'Client secret'),
      text('organization_id', 'Organization ID', {
        target: 'metadata',
        hint: 'In Zoho Books: Settings, Organization profile.',
      }),
      text('accounts_server', 'Accounts server', {
        kind: 'select',
        target: 'metadata',
        defaultValue: 'https://accounts.zoho.in',
        options: [
          { value: 'https://accounts.zoho.in', label: 'India (.in)' },
          { value: 'https://accounts.zoho.com', label: 'United States (.com)' },
          { value: 'https://accounts.zoho.eu', label: 'Europe (.eu)' },
          { value: 'https://accounts.zoho.com.au', label: 'Australia (.com.au)' },
          { value: 'https://accounts.zoho.jp', label: 'Japan (.jp)' },
        ],
      }),
      webhookSecret({ rotatable: true }),
    ],
    sync: [
      { ...pushInvoices, defaultOn: true },
      {
        entity: 'customer',
        direction: 'inbound',
        label: 'Pull customers',
        description: 'Create Flexprice customers from Zoho contacts.',
        defaultOn: true,
      },
    ],
    webhook: { events: ['Invoice', 'Contact'] },
    prerequisites: [
      'Add the redirect URI below as an authorised redirect in your Zoho API console client.',
    ],
  },
  nomod: {
    providerType: 'nomod',
    setup: 'credentials',
    fields: [secret('api_key', 'API key', { placeholder: 'sk_live_…' }), webhookSecret()],
    sync: [pushInvoices],
    webhook: { events: ['invoice.paid', 'payment_link.paid'] },
    credentialHelp: DOCS.integrations.nomod,
  },
  moyasar: {
    providerType: 'moyasar',
    setup: 'credentials',
    fields: [
      secret('secret_key', 'Secret key', { placeholder: 'sk_…' }),
      secret('publishable_key', 'Publishable key', {
        required: false,
        hint: 'Used to render the secure card form for autopay.',
      }),
      text('success_url', 'Success URL', {
        required: false,
        target: 'metadata',
        placeholder: 'https://example.com/paid',
        pattern: {
          test: /^https?:\/\/.+/,
          message: 'Enter a URL starting with http:// or https://.',
        },
      }),
      text('cancel_url', 'Cancel URL', {
        required: false,
        target: 'metadata',
        placeholder: 'https://example.com/cancelled',
        pattern: {
          test: /^https?:\/\/.+/,
          message: 'Enter a URL starting with http:// or https://.',
        },
      }),
      webhookSecret(),
    ],
    sync: [{ ...pushInvoices, defaultOn: true }],
    webhook: { events: ['payment_paid', 'payment_failed'] },
    credentialHelp: DOCS.integrations.moyasar,
  },
  paddle: {
    providerType: 'paddle',
    setup: 'credentials',
    fields: [
      secret('api_key', 'API key'),
      secret('client_side_token', 'Client-side token', { required: false, placeholder: 'live_…' }),
      text('redirect_url', 'Redirect URL', {
        required: false,
        target: 'metadata',
        placeholder: 'https://example.com/thanks',
        pattern: {
          test: /^https?:\/\/.+/,
          message: 'Enter a URL starting with http:// or https://.',
        },
      }),
      webhookSecret({ placeholder: 'pdl_ntfset_…' }),
    ],
    sync: [{ ...pushInvoices, defaultOn: true }],
    webhook: { events: ['transaction.completed', 'subscription.activated'] },
  },
  whop: {
    providerType: 'whop',
    setup: 'credentials',
    fields: [
      secret('api_key', 'API key', { placeholder: 'apik_…' }),
      secret('company_id', 'Company ID', { placeholder: 'biz_…' }),
      text('product_id', 'Product ID', {
        required: false,
        hint: 'Leave blank and Flexprice creates one on the first sync.',
      }),
      webhookSecret({ rotatable: true }),
    ],
    sync: [
      {
        ...pushInvoices,
        description: 'Send Flexprice invoices to Whop as payment requests.',
      },
    ],
    webhook: { events: ['payment.succeeded', 'payment.failed'] },
  },
  tabs: {
    providerType: 'tabs',
    setup: 'credentials',
    fields: [secret('api_key', 'API key', { placeholder: 'tabs_sk_…' })],
    sync: [pushInvoices],
  },
  aws_marketplace: {
    providerType: 'aws_marketplace',
    setup: 'credentials',
    fields: [
      text('role_arn', 'IAM role ARN', {
        placeholder: 'arn:aws:iam::123456789012:role/flexprice-metering',
        pattern: {
          test: /^arn:aws:iam::\d{12}:role\/.+$/,
          message: 'Enter a role ARN like arn:aws:iam::123456789012:role/name.',
        },
      }),
      text('region', 'Region', {
        target: 'sync',
        defaultValue: 'us-east-1',
        placeholder: 'us-east-1',
      }),
    ],
    sync: [],
    prerequisites: [
      'Create an IAM role that allows aws-marketplace:BatchMeterUsage and trusts the Flexprice account with the external ID shown below.',
    ],
    credentialHelp: DOCS.integrations.awsMarketplace,
  },
  gcp_marketplace: {
    providerType: 'gcp_marketplace',
    setup: 'credentials',
    fields: [
      {
        key: 'credentials_json',
        label: 'Workload identity credentials',
        kind: 'textarea',
        required: true,
        placeholder: '{ "type": "external_account", … }',
        hint: 'The external_account JSON file from your workload identity federation setup.',
      },
    ],
    sync: [],
    credentialHelp: DOCS.integrations.gcpMarketplace,
  },
  azure_marketplace: {
    providerType: 'azure_marketplace',
    setup: 'credentials',
    fields: [
      secret('tenant_id', 'Directory (tenant) ID'),
      secret('client_id', 'Application (client) ID'),
      secret('client_secret', 'Client secret'),
    ],
    sync: [],
    credentialHelp: DOCS.integrations.azureMarketplace,
  },
}

export function connectionSpecFor(providerType: string): ConnectionSpec | undefined {
  return CONNECTION_SPECS[providerType]
}

/** The steps a provider's sheet shows, in order. A provider with nothing to choose or register skips the step. */
export type ConnectStep = 'credentials' | 'sync' | 'webhook'

/** One submit at the end creates the connection; a per-connection webhook URL uses the id generated up front. */
export function connectSteps(spec: ConnectionSpec): ConnectStep[] {
  const steps: ConnectStep[] = ['credentials']
  if (spec.sync.length > 0) steps.push('sync')
  if (spec.webhook) steps.push('webhook')
  return steps
}

/** With a per-connection webhook, webhook fields the API needs at create move to credentials. */
export function fieldsForStep(
  spec: ConnectionSpec,
  step: 'credentials' | 'webhook',
  perConnectionWebhook = false,
): ConnectionField[] {
  return spec.fields.filter(
    (field) =>
      (field.step === 'webhook' && !(perConnectionWebhook && field.atCreate)
        ? 'webhook'
        : 'credentials') === step,
  )
}

/** A form-safe key (no dot, which react-hook-form reads as nesting). */
export function syncKey(option: SyncOption): string {
  return `${option.entity}:${option.direction}`
}

export const zohoPaymentGatewaysSchema = z
  .object({
    enabled: z.boolean(),
    gateways: z.array(z.string().min(1)),
    paypalPaymentMethod: z.enum(['standard', 'adaptive']),
  })
  .refine((value) => !value.enabled || value.gateways.length > 0, {
    message: 'Choose at least one payment gateway',
    path: ['gateways'],
  })
export type ZohoPaymentGateways = z.infer<typeof zohoPaymentGatewaysSchema>

export function zohoPaymentGateways(connection?: IntegrationConnection): ZohoPaymentGateways {
  const settings = connection?.syncConfig['invoice_sync_settings']?.['payment_gateways'] as
    Record<string, unknown> | undefined
  return {
    enabled: settings?.['enabled'] === true,
    gateways: Array.isArray(settings?.['gateways'])
      ? settings['gateways'].filter((value): value is string => typeof value === 'string')
      : [],
    paypalPaymentMethod:
      settings?.['paypal_payment_method'] === 'adaptive' ? 'adaptive' : 'standard',
  }
}

function withZohoGateways(
  config: Record<string, unknown>,
  value: ZohoPaymentGateways,
): Record<string, unknown> {
  const settings = (config['invoice_sync_settings'] ?? {}) as Record<string, unknown>
  const existing = (settings['payment_gateways'] ?? {}) as Record<string, unknown>
  const { paypal_payment_method: _, ...keep } = existing
  return {
    ...config,
    invoice_sync_settings: {
      ...settings,
      payment_gateways: {
        ...keep,
        enabled: value.enabled,
        gateways: value.gateways,
        ...(value.gateways.includes('paypal')
          ? { paypal_payment_method: value.paypalPaymentMethod }
          : {}),
      },
    },
  }
}

export type ConnectionFormValues = {
  zohoPaymentGateways?: ZohoPaymentGateways

  name: string
  fields: Record<string, string>
  sync: Record<string, boolean>
  /** Set only while billing entities are enabled. */
  billingEntityId?: string
}

export function defaultConnectionValues(
  spec: ConnectionSpec,
  providerName: string,
  environmentType?: 'development' | 'production',
): ConnectionFormValues {
  return {
    name: providerName,
    ...(spec.providerType === 'zoho_books' ? { zohoPaymentGateways: zohoPaymentGateways() } : {}),
    fields: Object.fromEntries(
      spec.fields.map((f) => [
        f.key,
        spec.providerType === 'quickbooks' && f.key === 'environment' && environmentType
          ? environmentType === 'production'
            ? 'production'
            : 'sandbox'
          : (f.defaultValue ?? ''),
      ]),
    ),
    sync: Object.fromEntries(spec.sync.map((o) => [syncKey(o), o.defaultOn ?? false])),
  }
}

function fieldRules(fields: ConnectionField[]) {
  const shape: Record<string, z.ZodType<string>> = {}
  for (const field of fields) {
    let rule = z.string().trim()
    if (field.required) rule = rule.min(1, `${field.label} is required.`)
    shape[field.key] = field.pattern
      ? rule.refine((value) => value === '' || field.pattern!.test.test(value), {
          message: field.pattern.message,
        })
      : rule
  }
  return shape
}

/** The create form's schema. Built from the spec so a field cannot be required in one place and not the other. */
export function connectionFormSchema(spec: ConnectionSpec, { entity = false } = {}) {
  const shape = fieldRules(spec.fields)
  return z.object({
    billingEntityId: entity ? z.string().min(1, 'Choose a billing entity.') : z.string().optional(),
    name: z
      .string()
      .trim()
      .min(1, 'Name is required.')
      .max(255, 'Keep the name under 256 characters.'),
    fields: z.object(shape).superRefine((fields, ctx) => {
      if (spec.providerType !== 'gcp_marketplace') return
      const raw = fields['credentials_json'] ?? ''
      if (raw === '') return
      try {
        const parsed = JSON.parse(raw) as { type?: unknown }
        if (parsed.type !== 'external_account') throw new Error('type')
      } catch {
        ctx.addIssue({
          code: 'custom',
          path: ['credentials_json'],
          message: 'Paste the external_account JSON, including "type": "external_account".',
        })
      }
    }),
    sync: z.record(z.string(), z.boolean()),
    zohoPaymentGateways: zohoPaymentGatewaysSchema.optional(),
  })
}

export interface ConnectionPayload {
  id?: string
  name: string
  provider_type: string
  encrypted_secret_data: Record<string, string>
  metadata?: Record<string, string>
  sync_config?: Record<string, unknown>
  billing_entity_id?: string
}

/** The `POST /connections` (or `/oauth/init`) body for a filled-in form. Blank optional values are left out. */
export function toConnectionPayload(
  spec: ConnectionSpec,
  values: ConnectionFormValues,
  {
    externalId,
    billingEntityId,
    connectionId,
  }: {
    externalId?: string
    billingEntityId?: string | undefined
    connectionId?: string | undefined
  } = {},
): ConnectionPayload {
  const secrets: Record<string, string> = {}
  const metadata: Record<string, string> = {}
  const syncExtra: Record<string, unknown> = {}
  for (const field of spec.fields) {
    const value = (values.fields[field.key] ?? '').trim()
    if (value === '') continue
    if (field.target === 'metadata') metadata[field.key] = value
    else if (field.target === 'sync') syncExtra[field.key] = value
    else secrets[field.key] = value
  }

  let syncConfig: Record<string, unknown> = {}
  for (const option of spec.sync) {
    const on = values.sync[syncKey(option)] ?? false
    const current = (syncConfig[option.entity] ?? {}) as Record<string, boolean>
    syncConfig[option.entity] = { ...current, [option.direction]: on }
  }
  if (spec.providerType === 'zoho_books' && values.zohoPaymentGateways)
    syncConfig = withZohoGateways(syncConfig, values.zohoPaymentGateways)
  if (spec.providerType === 'aws_marketplace') {
    syncConfig['aws_marketplace'] = syncExtra
    // The role's trust policy names this value; the API checks it with STS AssumeRole.
    if (externalId) secrets['external_id'] = externalId
  }

  return {
    ...(connectionId ? { id: connectionId } : {}),
    name: values.name.trim(),
    provider_type: spec.providerType,
    encrypted_secret_data: secrets,
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    ...(Object.keys(syncConfig).length > 0 ? { sync_config: syncConfig } : {}),
    ...(billingEntityId ? { billing_entity_id: billingEntityId } : {}),
  }
}

/** True when the provider posts webhooks and this connection cannot verify them yet. */
export function webhookMissing(connection: IntegrationConnection): boolean {
  return (
    connection.webhookSecretSet === false && !!connectionSpecFor(connection.providerType)?.webhook
  )
}

/** Providers whose webhook route takes the connection id, so each connection gets its own address. */
export const PER_CONNECTION_WEBHOOK_PROVIDERS: readonly string[] = [
  'stripe',
  'hubspot',
  'razorpay',
  'chargebee',
  'quickbooks',
  'nomod',
  'moyasar',
  'paddle',
  'zoho_books',
  'whop',
]

/** The connection a billing entity owns for this provider; one without an entity is the default's. */
export function connectionForEntity(
  integration: { connections: readonly IntegrationConnection[] },
  entityId: string,
  entities: readonly Pick<BillingEntity, 'id' | 'isDefault'>[],
): IntegrationConnection | null {
  return (
    integration.connections.find(
      (connection) => effectiveEntityId(connection, entities) === entityId,
    ) ?? null
  )
}

/** The address the provider posts events to. The API does not return it; it is built from the tenant, environment and, where the route takes it, the connection. */
export function webhookUrl(
  apiBase: string,
  providerType: string,
  tenantId: string,
  environmentId: string,
  connectionId?: string,
): string {
  const base = `${apiBase.replace(/\/+$/, '')}/webhooks/${providerType}/${tenantId}/${environmentId}`
  return connectionId && PER_CONNECTION_WEBHOOK_PROVIDERS.includes(providerType)
    ? `${base}/${connectionId}`
    : base
}

/** Events to subscribe to for this provider, widened by what the reader chose to sync. */
export function webhookEvents(spec: ConnectionSpec, sync: Record<string, boolean>): string[] {
  const events = [...(spec.webhook?.events ?? [])]
  if (spec.providerType === 'stripe') {
    if (sync['plan:inbound']) events.push('product.created', 'product.updated', 'product.deleted')
    if (sync['invoice:outbound']) events.push('invoice_payment.paid')
    if (sync['subscription:inbound'])
      events.push(
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
      )
  }
  return events
}

/** The redirect URI QuickBooks and Zoho send the reader back to. It has to be registered at the provider. */
export function oauthRedirectUri(origin: string): string {
  return `${origin.replace(/\/+$/, '')}/tools/integrations/oauth/callback`
}

/** The fields of a spec the API lets an existing connection replace. */
export function rotatableFields(spec: ConnectionSpec): ConnectionField[] {
  return spec.fields.filter((field) => field.rotatable)
}

/** What the manage form can set: the rotatable keys and, with a per-connection webhook, every webhook field. */
export function editableFields(
  spec: ConnectionSpec,
  perConnectionWebhook: boolean,
): ConnectionField[] {
  const webhook = perConnectionWebhook ? fieldsForStep(spec, 'webhook', true) : []
  return spec.fields.filter((field) => field.rotatable || webhook.includes(field))
}

/** The manage form's starting point: the saved name and switches, every secret blank. */
export function connectionToFormValues(
  spec: ConnectionSpec,
  connection: IntegrationConnection,
  perConnectionWebhook = false,
): ConnectionFormValues {
  return {
    name: connection.name,
    ...(spec.providerType === 'zoho_books'
      ? { zohoPaymentGateways: zohoPaymentGateways(connection) }
      : {}),
    fields: Object.fromEntries(editableFields(spec, perConnectionWebhook).map((f) => [f.key, ''])),
    sync: Object.fromEntries(
      spec.sync.map((o) => [syncKey(o), connection.syncConfig[o.entity]?.[o.direction] ?? false]),
    ),
  }
}

/** Manage-form rules: a name, and Chargebee's webhook login changes as a pair or not at all. */
export function manageFormSchema(spec: ConnectionSpec) {
  return z.object({
    billingEntityId: z.string().optional(),
    name: z
      .string()
      .trim()
      .min(1, 'Name is required.')
      .max(255, 'Keep the name under 256 characters.'),
    fields: z.record(z.string(), z.string().trim()).superRefine((fields, ctx) => {
      if (spec.providerType !== 'chargebee') return
      const user = fields['webhook_username'] ?? ''
      const pass = fields['webhook_password'] ?? ''
      if ((user === '') !== (pass === ''))
        ctx.addIssue({
          code: 'custom',
          path: [user === '' ? 'webhook_username' : 'webhook_password'],
          message: 'Enter both the username and the password to change the webhook login.',
        })
    }),
    sync: z.record(z.string(), z.boolean()),
    zohoPaymentGateways: zohoPaymentGatewaysSchema.optional(),
  })
}

export interface ConnectionChanges {
  name?: string
  sync_config?: Record<string, unknown>
  encrypted_secret_data?: Record<string, string>
  billing_entity_id?: string
}

/**
 * Only what changed, so an untouched secret is never resent and an untouched
 * sync is never rewritten. `entities` (given while they are enabled) adds the
 * move and the per-connection webhook fields.
 */
export function toConnectionChanges(
  spec: ConnectionSpec,
  connection: IntegrationConnection,
  values: ConnectionFormValues,
  entities?: readonly Pick<BillingEntity, 'id' | 'isDefault'>[],
): ConnectionChanges {
  const changes: ConnectionChanges = {}
  if (values.name.trim() !== connection.name) changes.name = values.name.trim()
  if (
    entities &&
    values.billingEntityId &&
    values.billingEntityId !== effectiveEntityId(connection, entities)
  )
    changes.billing_entity_id = values.billingEntityId

  const perConnectionWebhook = entities !== undefined
  const initial = connectionToFormValues(spec, connection, perConnectionWebhook)
  if (spec.sync.some((o) => values.sync[syncKey(o)] !== initial.sync[syncKey(o)])) {
    // Start from what was saved, so provider settings this form does not edit are sent back as they were.
    const next: Record<string, unknown> = { ...connection.syncConfig }
    for (const option of spec.sync) {
      const current = (next[option.entity] ?? {}) as Record<string, boolean>
      next[option.entity] = {
        ...current,
        [option.direction]: values.sync[syncKey(option)] ?? false,
      }
    }
    changes.sync_config = next
  }

  if (
    spec.providerType === 'zoho_books' &&
    values.zohoPaymentGateways &&
    JSON.stringify(values.zohoPaymentGateways) !== JSON.stringify(initial.zohoPaymentGateways)
  ) {
    changes.sync_config = withZohoGateways(
      changes.sync_config ?? connection.syncConfig,
      values.zohoPaymentGateways,
    )
  }

  const secrets: Record<string, string> = {}
  for (const field of editableFields(spec, perConnectionWebhook)) {
    const value = (values.fields[field.key] ?? '').trim()
    if (value !== '') secrets[field.key] = value
  }
  if (Object.keys(secrets).length > 0) changes.encrypted_secret_data = secrets
  return changes
}

/** The ID AWS and GCP marketplace roles must name: one per tenant and environment. */
export function marketplaceExternalId(tenantId: string, environmentId: string): string {
  return `${tenantId}_${environmentId}`
}

/** The IAM permissions policy the AWS Marketplace role needs: metering only. */
export function awsPermissionsPolicy(): string {
  return JSON.stringify(
    {
      Version: '2012-10-17',
      Statement: [{ Effect: 'Allow', Action: 'aws-marketplace:BatchMeterUsage', Resource: '*' }],
    },
    null,
    2,
  )
}

/** The trust relationship that lets Flexprice's AWS account assume the role, bound to the external ID. */
export function awsTrustPolicy(flexpriceAccountId: string, externalId: string): string {
  return JSON.stringify(
    {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: `arn:aws:iam::${flexpriceAccountId}:root` },
          Action: 'sts:AssumeRole',
          Condition: { StringEquals: { 'sts:ExternalId': externalId } },
        },
      ],
    },
    null,
    2,
  )
}

/**
 * The gcloud script the reader runs in Cloud Shell against their own project:
 * it federates Flexprice's AWS role into GCP and writes the credentials file
 * the form asks for. Command for command V1's script.
 */
export function gcpSetupScript(flexpriceAccountId: string, flexpriceRoleName: string): string {
  return `GCP_PROJECT_ID="your-gcp-project-id"
GCP_PROJECT_NUMBER="your-gcp-project-number"
SA_ID="flexprice-metering-sa"
FLEXPRICE_AWS_ACCOUNT_ID="${flexpriceAccountId}"
FLEXPRICE_AWS_ROLE_NAME="${flexpriceRoleName}"

# 1. Create the workload identity pool
gcloud iam workload-identity-pools create "flexprice-pool" \\
  --location="global" --project="$GCP_PROJECT_ID"

# 2. Create the provider inside it, and pin exactly who to trust
gcloud iam workload-identity-pools providers create-aws "flexprice-provider" \\
  --location="global" --workload-identity-pool="flexprice-pool" \\
  --account-id="$FLEXPRICE_AWS_ACCOUNT_ID" \\
  --attribute-mapping="google.subject=assertion.arn,attribute.account=assertion.account,attribute.aws_role=assertion.arn.extract('assumed-role/{role}/')" \\
  --attribute-condition="attribute.aws_role == '$FLEXPRICE_AWS_ROLE_NAME'" \\
  --project="$GCP_PROJECT_ID"

# 3. Create the service account
gcloud iam service-accounts create "$SA_ID" --project="$GCP_PROJECT_ID"

# 4. Grant it exactly one permission: report usage
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \\
  --role="roles/servicemanagement.serviceController" \\
  --member="serviceAccount:$SA_ID@$GCP_PROJECT_ID.iam.gserviceaccount.com"

# 5. Let Flexprice's AWS identity impersonate the service account
gcloud iam service-accounts add-iam-policy-binding \\
  "$SA_ID@$GCP_PROJECT_ID.iam.gserviceaccount.com" \\
  --role="roles/iam.workloadIdentityUser" \\
  --member="principalSet://iam.googleapis.com/projects/$GCP_PROJECT_NUMBER/locations/global/workloadIdentityPools/flexprice-pool/attribute.account/$FLEXPRICE_AWS_ACCOUNT_ID" \\
  --project="$GCP_PROJECT_ID"

# 6. Generate the credentials JSON
gcloud iam workload-identity-pools create-cred-config \\
  "projects/$GCP_PROJECT_NUMBER/locations/global/workloadIdentityPools/flexprice-pool/providers/flexprice-provider" \\
  --service-account="$SA_ID@$GCP_PROJECT_ID.iam.gserviceaccount.com" \\
  --aws --output-file="flexprice-gcp-creds.json"
`
}

export type WebhookFormValues = { fields: Record<string, string> }

/** The per-connection webhook step's schema: the fields saved on the new connection beside its URL. */
export function webhookFormSchema(spec: ConnectionSpec) {
  return z.object({ fields: z.object(fieldRules(fieldsForStep(spec, 'webhook', true))) })
}

/** The per-connection webhook step's `PUT /connections/:id` body; blank values are left out. */
export function toWebhookChanges(
  spec: ConnectionSpec,
  values: WebhookFormValues,
): ConnectionChanges {
  const secrets: Record<string, string> = {}
  for (const field of fieldsForStep(spec, 'webhook', true)) {
    const value = (values.fields[field.key] ?? '').trim()
    if (value !== '') secrets[field.key] = value
  }
  return Object.keys(secrets).length > 0 ? { encrypted_secret_data: secrets } : {}
}
