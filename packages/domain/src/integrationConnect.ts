import { z } from 'zod'
import type { IntegrationConnection } from './integration'

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
    credentialHelp: 'https://docs.flexprice.io/integrations/stripe/',
  },
  razorpay: {
    providerType: 'razorpay',
    setup: 'credentials',
    fields: [
      text('key_id', 'Key ID', { placeholder: 'rzp_live_…' }),
      secret('secret_key', 'Key secret'),
      webhookSecret({ required: false }),
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
    credentialHelp: 'https://docs.flexprice.io/integrations/razorpay/',
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
        hint: 'Chargebee signs webhooks with HTTP Basic auth. Choose any username and password, then enter the same pair on the webhook.',
        rotatable: true,
      }),
      secret('webhook_password', 'Webhook password', { step: 'webhook', rotatable: true }),
    ],
    sync: [pushInvoices],
    webhook: { events: ['payment_succeeded'] },
    credentialHelp: 'https://docs.flexprice.io/integrations/chargebee/',
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
      webhookSecret({ required: false, rotatable: true }),
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
    fields: [
      secret('api_key', 'API key', { placeholder: 'sk_live_…' }),
      webhookSecret({ required: false }),
    ],
    sync: [pushInvoices],
    webhook: { events: ['invoice.paid', 'payment_link.paid'] },
    credentialHelp: 'https://docs.flexprice.io/integrations/nomod/',
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
      webhookSecret({ required: false }),
    ],
    sync: [{ ...pushInvoices, defaultOn: true }],
    webhook: { events: ['payment_paid', 'payment_failed'] },
    credentialHelp: 'https://docs.flexprice.io/integrations/moyasar/',
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
    credentialHelp: 'https://docs.flexprice.io/marketplace-integration/aws/connection-setup',
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
    credentialHelp: 'https://docs.flexprice.io/marketplace-integration/gcp/connection-setup',
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
    credentialHelp: 'https://docs.flexprice.io/marketplace-integration/azure/connection-setup',
  },
}

export function connectionSpecFor(providerType: string): ConnectionSpec | undefined {
  return CONNECTION_SPECS[providerType]
}

/** The steps a provider's sheet shows, in order. A provider with nothing to choose or register skips the step. */
export type ConnectStep = 'credentials' | 'sync' | 'webhook'

export function connectSteps(spec: ConnectionSpec): ConnectStep[] {
  const steps: ConnectStep[] = ['credentials']
  if (spec.sync.length > 0) steps.push('sync')
  if (spec.webhook) steps.push('webhook')
  return steps
}

export function fieldsForStep(
  spec: ConnectionSpec,
  step: 'credentials' | 'webhook',
): ConnectionField[] {
  return spec.fields.filter((field) => (field.step ?? 'credentials') === step)
}

/** A form-safe key (no dot, which react-hook-form reads as nesting). */
export function syncKey(option: SyncOption): string {
  return `${option.entity}:${option.direction}`
}

export type ConnectionFormValues = {
  name: string
  fields: Record<string, string>
  sync: Record<string, boolean>
}

export function defaultConnectionValues(
  spec: ConnectionSpec,
  providerName: string,
): ConnectionFormValues {
  return {
    name: providerName,
    fields: Object.fromEntries(spec.fields.map((f) => [f.key, f.defaultValue ?? ''])),
    sync: Object.fromEntries(spec.sync.map((o) => [syncKey(o), o.defaultOn ?? false])),
  }
}

/** The schema a provider's form validates against. Built from the spec so a field cannot be required in one place and not the other. */
export function connectionFormSchema(spec: ConnectionSpec) {
  const shape: Record<string, z.ZodType<string>> = {}
  for (const field of spec.fields) {
    let rule = z.string().trim()
    if (field.required) rule = rule.min(1, `${field.label} is required.`)
    shape[field.key] = field.pattern
      ? rule.refine((value) => value === '' || field.pattern!.test.test(value), {
          message: field.pattern.message,
        })
      : rule
  }
  return z.object({
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
  })
}

export interface ConnectionPayload {
  name: string
  provider_type: string
  encrypted_secret_data: Record<string, string>
  metadata?: Record<string, string>
  sync_config?: Record<string, unknown>
}

/** The `POST /connections` (or `/oauth/init`) body for a filled-in form. Blank optional values are left out. */
export function toConnectionPayload(
  spec: ConnectionSpec,
  values: ConnectionFormValues,
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

  const syncConfig: Record<string, unknown> = {}
  for (const option of spec.sync) {
    const on = values.sync[syncKey(option)] ?? false
    const current = (syncConfig[option.entity] ?? {}) as Record<string, boolean>
    syncConfig[option.entity] = { ...current, [option.direction]: on }
  }
  if (spec.providerType === 'aws_marketplace') syncConfig['aws_marketplace'] = syncExtra

  return {
    name: values.name.trim(),
    provider_type: spec.providerType,
    encrypted_secret_data: secrets,
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    ...(Object.keys(syncConfig).length > 0 ? { sync_config: syncConfig } : {}),
  }
}

/** The address the provider posts events to. The API does not return it; it is built from the tenant and environment. */
export function webhookUrl(
  apiBase: string,
  providerType: string,
  tenantId: string,
  environmentId: string,
): string {
  return `${apiBase.replace(/\/+$/, '')}/webhooks/${providerType}/${tenantId}/${environmentId}`
}

/** Events to subscribe to for this provider, widened by what the reader chose to sync. */
export function webhookEvents(spec: ConnectionSpec, sync: Record<string, boolean>): string[] {
  const events = [...(spec.webhook?.events ?? [])]
  if (spec.providerType === 'stripe') {
    if (sync['plan:inbound']) events.push('product.created', 'product.updated', 'product.deleted')
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

/** The manage form's starting point: the saved name and switches, every secret blank. */
export function connectionToFormValues(
  spec: ConnectionSpec,
  connection: IntegrationConnection,
): ConnectionFormValues {
  return {
    name: connection.name,
    fields: Object.fromEntries(rotatableFields(spec).map((f) => [f.key, ''])),
    sync: Object.fromEntries(
      spec.sync.map((o) => [syncKey(o), connection.syncConfig[o.entity]?.[o.direction] ?? false]),
    ),
  }
}

/** Manage-form rules: a name, and Chargebee's webhook login changes as a pair or not at all. */
export function manageFormSchema(spec: ConnectionSpec) {
  return z.object({
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
  })
}

export interface ConnectionChanges {
  name?: string
  sync_config?: Record<string, unknown>
  encrypted_secret_data?: Record<string, string>
}

/** Only what changed, so an untouched secret is never resent and an untouched sync is never rewritten. */
export function toConnectionChanges(
  spec: ConnectionSpec,
  connection: IntegrationConnection,
  values: ConnectionFormValues,
): ConnectionChanges {
  const changes: ConnectionChanges = {}
  if (values.name.trim() !== connection.name) changes.name = values.name.trim()

  const initial = connectionToFormValues(spec, connection)
  if (spec.sync.some((o) => values.sync[syncKey(o)] !== initial.sync[syncKey(o)])) {
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

  const secrets: Record<string, string> = {}
  for (const field of rotatableFields(spec)) {
    const value = (values.fields[field.key] ?? '').trim()
    if (value !== '') secrets[field.key] = value
  }
  if (Object.keys(secrets).length > 0) changes.encrypted_secret_data = secrets
  return changes
}
