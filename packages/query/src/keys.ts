/**
 * Query keys, in one place.
 *
 * Keys assembled inline drift: `['customer', id]` in one file and
 * `['customers', id]` in another means an invalidation that silently misses,
 * and a stale screen nobody can reproduce. A factory makes the key structure a
 * single fact, and `as const` makes a typo a type error.
 *
 * Structured hierarchically so that invalidating a prefix invalidates
 * everything below it: `queryClient.invalidateQueries({ queryKey:
 * queryKeys.customers.all() })` covers every customer list and detail.
 */
export const queryKeys = {
  session: {
    all: () => ['session'] as const,
    current: () => ['session', 'current'] as const,
    /**
     * The role catalogue the signed-in principal's access is resolved from.
     * Under the unscoped `session` root: roles are tenant-wide, so switching
     * environment must not drop them and re-show a loading gate.
     */
    accessRoles: (token: string, audience: string) =>
      ['session', 'accessRoles', token, audience] as const,
    environments: () => ['session', 'environments'] as const,
    /** Keyed by server URL: the region picker can switch deployments mid-session. */
    capabilities: (serverURL: string) => ['session', 'capabilities', serverURL] as const,
  },
  customers: {
    all: () => ['customers'] as const,
    list: (filter: Readonly<Record<string, unknown>> = {}) =>
      ['customers', 'list', filter] as const,
    detail: (id: string) => ['customers', 'detail', id] as const,
    /** Every customer's entitlement usage, whole or narrowed to a contract. */
    usageAll: () => ['customers', 'usage'] as const,
    /** Entitlement usage for one customer: `GET /customers/usage`. */
    usage: (id: string) => ['customers', 'usage', id] as const,
    /** The same read narrowed to one contract: `?subscription_ids=`. Under `usage(id)`. */
    contractUsage: (id: string, subscriptionId: string) =>
      ['customers', 'usage', id, { subscriptionId }] as const,
  },
  subscriptions: {
    all: () => ['subscriptions'] as const,
    list: (filter: Readonly<Record<string, unknown>> = {}) =>
      ['subscriptions', 'list', filter] as const,
    detail: (id: string) => ['subscriptions', 'detail', id] as const,
    lines: (id: string) => ['subscriptions', 'lines', id] as const,
    lineHistory: (id: string) => ['subscriptions', 'lines', id, 'history'] as const,
    /** One line item's versions: `GET /subscriptions/lineitems/{id}/history`. */
    lineVersions: (lineId: string) => ['subscriptions', 'lineVersions', lineId] as const,
    usage: (id: string) => ['subscriptions', 'usage', id] as const,
    schedules: (id: string) => ['subscriptions', 'schedules', id] as const,
    invoices: (id: string, filter: Readonly<Record<string, unknown>> = {}) =>
      ['subscriptions', 'invoices', id, filter] as const,
    entitlements: (id: string) => ['subscriptions', 'entitlements', id] as const,
    preview: (id: string, hideZero: boolean) => ['subscriptions', 'preview', id, hideZero] as const,
    addons: (id: string) => ['subscriptions', 'addons', id] as const,
    coupons: (id: string) => ['subscriptions', 'coupons', id] as const,
    taxes: (id: string) => ['subscriptions', 'taxes', id] as const,
  },
  counts: {
    all: () => ['counts'] as const,
    of: (entity: string) => ['counts', entity] as const,
  },
  revenue: {
    all: () => ['revenue'] as const,
    overview: (filter: Readonly<Record<string, unknown>> = {}) =>
      ['revenue', 'overview', filter] as const,
    series: (filter: Readonly<Record<string, unknown>> = {}) =>
      ['revenue', 'series', filter] as const,
  },
  revenueRecognition: {
    all: () => ['revenueRecognition'] as const,
    enabled: (environmentId: string | null) =>
      ['revenueRecognition', 'enabled', environmentId] as const,
    subscription: (environmentId: string | null, subscriptionId: string) =>
      ['revenueRecognition', 'subscription', environmentId, subscriptionId] as const,
    customers: (environmentId: string | null, filter: Readonly<Record<string, unknown>>) =>
      ['revenueRecognition', 'customers', environmentId, filter] as const,
    rollforward: (environmentId: string | null, filter: Readonly<Record<string, unknown>>) =>
      ['revenueRecognition', 'rollforward', environmentId, filter] as const,
    contracts: (environmentId: string | null, contractIds: readonly string[]) =>
      ['revenueRecognition', 'contracts', environmentId, contractIds] as const,
    subscriptionContract: (environmentId: string | null, subscriptionId: string) =>
      ['revenueRecognition', 'subscriptionContract', environmentId, subscriptionId] as const,
    entries: (environmentId: string | null, filter: Readonly<Record<string, unknown>>) =>
      ['revenueRecognition', 'entries', environmentId, filter] as const,
    journal: (environmentId: string | null, contractId: string) =>
      ['revenueRecognition', 'journal', environmentId, contractId] as const,
    recognizedThrough: (environmentId: string | null) =>
      ['revenueRecognition', 'recognizedThrough', environmentId] as const,
  },
  events: {
    all: () => ['events'] as const,
    analytics: (filter: Readonly<Record<string, unknown>> = {}) =>
      ['events', 'analytics', filter] as const,
    /** One event's trace. Keyed by both ids, because the route needs both. */
    debug: (eventId: string, externalCustomerId: string) =>
      ['events', 'debug', eventId, externalCustomerId] as const,
  },
  features: {
    all: () => ['features'] as const,
    list: (filter: Readonly<Record<string, unknown>> = {}) => ['features', 'list', filter] as const,
    detail: (id: string) => ['features', 'detail', id] as const,
  },
  plans: {
    all: () => ['plans'] as const,
    list: (filter: Readonly<Record<string, unknown>> = {}) => ['plans', 'list', filter] as const,
    detail: (id: string) => ['plans', 'detail', id] as const,
  },
  addons: {
    all: () => ['addons'] as const,
    list: (filter: Readonly<Record<string, unknown>> = {}) => ['addons', 'list', filter] as const,
    detail: (id: string) => ['addons', 'detail', id] as const,
  },
  coupons: {
    all: () => ['coupons'] as const,
    list: (filter: Readonly<Record<string, unknown>> = {}) => ['coupons', 'list', filter] as const,
    detail: (id: string) => ['coupons', 'detail', id] as const,
    associations: (couponId: string) => ['coupons', 'associations', couponId] as const,
  },
  fxRates: {
    all: () => ['fxRates'] as const,
    list: (filter: Readonly<Record<string, unknown>> = {}) => ['fxRates', 'list', filter] as const,
  },
  taxAssociations: {
    all: () => ['taxAssociations'] as const,
    forEntity: (entityType: string, entityId: string) =>
      ['taxAssociations', entityType, entityId] as const,
  },
  priceUnits: {
    all: () => ['priceUnits'] as const,
    list: (filter: Readonly<Record<string, unknown>> = {}) =>
      ['priceUnits', 'list', filter] as const,
    detail: (id: string) => ['priceUnits', 'detail', id] as const,
  },
  groups: {
    all: () => ['groups'] as const,
    list: (filter: Readonly<Record<string, unknown>> = {}) => ['groups', 'list', filter] as const,
    detail: (id: string) => ['groups', 'detail', id] as const,
  },
  costSheets: {
    all: () => ['costSheets'] as const,
    list: (filter: Readonly<Record<string, unknown>> = {}) =>
      ['costSheets', 'list', filter] as const,
    detail: (id: string) => ['costSheets', 'detail', id] as const,
  },
  wallets: {
    all: () => ['wallets'] as const,
    forCustomer: (customerId: string) => ['wallets', 'customer', customerId] as const,
    transactions: (walletId: string) => ['wallets', 'transactions', walletId] as const,
    balance: (walletId: string) => ['wallets', 'balance', walletId] as const,
  },
  invoices: {
    all: () => ['invoices'] as const,
    list: (filter: Readonly<Record<string, unknown>> = {}) => ['invoices', 'list', filter] as const,
    detail: (id: string) => ['invoices', 'detail', id] as const,
  },
  payments: {
    all: () => ['payments'] as const,
    list: (filter: Readonly<Record<string, unknown>> = {}) => ['payments', 'list', filter] as const,
    detail: (id: string) => ['payments', 'detail', id] as const,
  },
  taxRates: {
    all: () => ['taxRates'] as const,
    list: (filter: Readonly<Record<string, unknown>> = {}) => ['taxRates', 'list', filter] as const,
    detail: (id: string) => ['taxRates', 'detail', id] as const,
  },
  creditNotes: {
    all: () => ['creditNotes'] as const,
    list: (filter: Readonly<Record<string, unknown>> = {}) =>
      ['creditNotes', 'list', filter] as const,
    detail: (id: string) => ['creditNotes', 'detail', id] as const,
  },
  usageSyncs: {
    all: () => ['usageSyncs'] as const,
    list: (filter: Record<string, unknown>) => ['usageSyncs', 'list', filter] as const,
  },
  integrations: {
    all: () => ['integrations'] as const,
  },
  billingEntities: {
    all: () => ['billingEntities'] as const,
    status: () => ['billingEntities', 'status'] as const,
    list: (filter: Readonly<Record<string, unknown>> = {}) =>
      ['billingEntities', 'list', filter] as const,
    detail: (id: string) => ['billingEntities', 'detail', id] as const,
  },
  /** A customer's provider mappings: `GET /integrations/mappings`. */
  integrationLinks: {
    all: () => ['integrationLinks'] as const,
    forCustomer: (customerId: string) => ['integrationLinks', 'customer', customerId] as const,
  },
  dataExports: {
    all: () => ['dataExports'] as const,
    list: (filter: Record<string, unknown>) => ['dataExports', 'list', filter] as const,
    detail: (id: string) => ['dataExports', 'detail', id] as const,
    runs: (id: string, filter: Record<string, unknown>) =>
      ['dataExports', 'runs', id, filter] as const,
    counts: () => ['dataExports', 'counts'] as const,
  },
  eventImports: {
    all: () => ['eventImports'] as const,
    list: (filter: Record<string, unknown>) => ['eventImports', 'list', filter] as const,
    detail: (id: string) => ['eventImports', 'detail', id] as const,
  },
  s3Connections: {
    all: () => ['s3Connections'] as const,
  },
  workflowRuns: {
    all: () => ['workflowRuns'] as const,
    list: (filter: Record<string, unknown>) => ['workflowRuns', 'list', filter] as const,
  },
  rawEvents: {
    all: () => ['rawEvents'] as const,
    list: (filter: Readonly<Record<string, unknown>> = {}) =>
      ['rawEvents', 'list', filter] as const,
  },
  // A plan's money lives in three separate record types, so each has its own
  // key: invalidating `prices.all()` refreshes every charge list without
  // touching entitlements or grants.
  prices: {
    all: () => ['prices'] as const,
    list: (filter: Readonly<Record<string, unknown>> = {}) => ['prices', 'list', filter] as const,
    history: (filter: Readonly<Record<string, unknown>> = {}) =>
      ['prices', 'history', filter] as const,
    /** One plan price's versions: `GET /prices/{id}/history`. */
    versions: (id: string) => ['prices', 'versions', id] as const,
  },
  entitlements: {
    all: () => ['entitlements'] as const,
    list: (filter: Readonly<Record<string, unknown>> = {}) =>
      ['entitlements', 'list', filter] as const,
  },
  creditGrants: {
    all: () => ['creditGrants'] as const,
    list: (filter: Readonly<Record<string, unknown>> = {}) =>
      ['creditGrants', 'list', filter] as const,
  },
  // Settings. People and service accounts share one key space because they
  // share one endpoint: inviting a member and creating a service account both
  // have to invalidate the other screen's list, and a single prefix is what
  // makes that one call rather than two that can drift apart.
  members: {
    all: () => ['members'] as const,
    list: (filter: Readonly<Record<string, unknown>> = {}) => ['members', 'list', filter] as const,
    /** The signed-in member's own record, which has no id in its route. */
    me: () => ['members', 'me'] as const,
  },
  roles: {
    all: () => ['roles'] as const,
    list: (filter: Readonly<Record<string, unknown>> = {}) => ['roles', 'list', filter] as const,
    detail: (id: string) => ['roles', 'detail', id] as const,
  },
  apiKeys: {
    all: () => ['apiKeys'] as const,
    list: (filter: Readonly<Record<string, unknown>> = {}) => ['apiKeys', 'list', filter] as const,
  },
  // The organisation and the bill Flexprice sends it are one prefix: editing
  // the tenant can change the billing contact the usage panel prints.
  tenant: {
    all: () => ['tenant'] as const,
    detail: (id: string) => ['tenant', 'detail', id] as const,
    billingUsage: () => ['tenant', 'billingUsage'] as const,
    /** Self-billing: the tenant's own Flexprice account, the same in every environment. */
    selfBilling: () => ['tenant', 'selfBilling'] as const,
    selfBillingStatus: () => ['tenant', 'selfBilling', 'status'] as const,
    selfBillingSummary: () => ['tenant', 'selfBilling', 'summary'] as const,
    selfBillingCheckout: (id: string) => ['tenant', 'selfBilling', 'checkout', id] as const,
  },
  /**
   * The `/settings/{key}` family, keyed by environment first.
   *
   * The environment id is in the key because these records **are** per
   * environment: the sandbox and production have different invoice prefixes,
   * different portal trees, different currencies. Keying only by the settings
   * key would file both under one entry, and switching environments would
   * render the previous one's configuration: briefly, believably, and into a
   * form whose next save would write it to the wrong environment.
   *
   * It is not enough that the console invalidates everything on a switch.
   * Invalidation marks an entry stale; it does not remove it. A settings
   * screen mounted after a switch still renders the stale entry while the
   * refetch is in flight, which is exactly the window a form is filled in.
   */
  settings: {
    all: () => ['settings'] as const,
    of: (environmentId: string) => ['settings', environmentId] as const,
    detail: (environmentId: string, key: string) => ['settings', environmentId, key] as const,
    /** The Svix portal handoff. Environment-scoped like the rest. */
    webhookDashboard: (environmentId: string) =>
      ['settings', environmentId, 'webhookDashboard'] as const,
  },
  /**
   * The Svix webhook portal. Environment-scoped, because each environment is
   * its own Svix application. `portal` holds the app-portal token; everything
   * read *with* that token sits under `data`, so a mutation can refresh the
   * portal's contents without minting a new token.
   */
  webhooks: {
    all: () => ['webhooks'] as const,
    portal: (environmentId: string) => ['webhooks', environmentId, 'portal'] as const,
    data: (environmentId: string) => ['webhooks', environmentId, 'data'] as const,
    of: (environmentId: string, ...parts: readonly unknown[]) =>
      ['webhooks', environmentId, 'data', ...parts] as const,
  },
  activity: {
    all: () => ['activity'] as const,
    list: (filter: Readonly<Record<string, unknown>> = {}) => ['activity', 'list', filter] as const,
  },
  alertSettings: {
    all: () => ['alertSettings'] as const,
    list: (filter: Readonly<Record<string, unknown>> = {}) =>
      ['alertSettings', 'list', filter] as const,
    detail: (id: string) => ['alertSettings', 'detail', id] as const,
  },
  hostedInvoice: {
    detail: (apiOrigin: string, token: string) => ['hostedInvoice', apiOrigin, token] as const,
  },
  /** Every key starts with the portal session, so one invalidation refreshes the portal. */
  customerPortal: {
    all: (apiOrigin: string, token: string) => ['customerPortal', apiOrigin, token] as const,
    part: (apiOrigin: string, token: string, ...rest: readonly unknown[]) =>
      ['customerPortal', apiOrigin, token, ...rest] as const,
  },
} as const
