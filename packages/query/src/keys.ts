/**
 * Query keys, in one place.
 *
 * Keys assembled inline drift — `['customer', id]` in one file and
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
    environments: () => ['session', 'environments'] as const,
  },
  customers: {
    all: () => ['customers'] as const,
    list: (filter: Readonly<Record<string, unknown>> = {}) =>
      ['customers', 'list', filter] as const,
    detail: (id: string) => ['customers', 'detail', id] as const,
  },
  subscriptions: {
    all: () => ['subscriptions'] as const,
    list: (filter: Readonly<Record<string, unknown>> = {}) =>
      ['subscriptions', 'list', filter] as const,
    detail: (id: string) => ['subscriptions', 'detail', id] as const,
  },
  counts: {
    all: () => ['counts'] as const,
    of: (entity: string) => ['counts', entity] as const,
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
  // A plan's money lives in three separate record types, so each has its own
  // key: invalidating `prices.all()` refreshes every charge list without
  // touching entitlements or grants.
  prices: {
    all: () => ['prices'] as const,
    list: (filter: Readonly<Record<string, unknown>> = {}) => ['prices', 'list', filter] as const,
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
  },
  alertSettings: {
    all: () => ['alertSettings'] as const,
    list: (filter: Readonly<Record<string, unknown>> = {}) =>
      ['alertSettings', 'list', filter] as const,
    detail: (id: string) => ['alertSettings', 'detail', id] as const,
  },
} as const
