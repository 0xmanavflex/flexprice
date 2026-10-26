import { type AccessRequirement, RBAC_ENTITY as E, type RbacEntity } from '@fp/domain'

/**
 * What each console route needs, in one table: V1's `requirePermission`
 * handles (`core/routes/Routes.tsx`), mapped onto V2's routes.
 *
 * - `require` gates the page: a loader while access loads, "Access denied"
 *   in place when not met. Absent means the page is open to anyone signed in
 *   (V1 leaves home, revenue, events, usage syncs, the pricing widget and
 *   settings ungated; settings gates its own panels).
 * - `writes` is the entity the page's controls write to. The kit's create
 *   buttons, row actions, detail menus and editable cards disable themselves,
 *   with the reason, when the principal cannot write it.
 *
 * Create and edit pages need write, as V1's. Credit memos and payments accept
 * read *or* write, as V1's do (a write-only role can still reach them).
 *
 * Keys are TanStack Router full paths. `routeAccess.test.ts` checks every
 * route in the router has an entry, so a new route cannot ship ungoverned.
 */
export interface RouteAccess {
  require?: AccessRequirement
  writes?: RbacEntity
}

const read = (entity: RbacEntity): RouteAccess => ({
  require: { entity, action: 'read' },
  writes: entity,
})
const write = (entity: RbacEntity): RouteAccess => ({
  require: { entity, action: 'write' },
  writes: entity,
})
const readOrWrite = (entity: RbacEntity): RouteAccess => ({
  require: { entity, action: ['read', 'write'] },
  writes: entity,
})
const OPEN: RouteAccess = {}

export const ROUTE_ACCESS: Readonly<Record<string, RouteAccess>> = {
  '/': OPEN,
  '/reports': OPEN,
  // The old address of Reports; it redirects there.
  '/revenue': OPEN,

  // Product catalog
  '/features': read(E.Feature),
  '/features/$featureId': read(E.Feature),
  '/features/new': write(E.Feature),
  '/features/$featureId/edit': write(E.Feature),
  '/plans': read(E.Plan),
  '/plans/$planId': read(E.Plan),
  '/plans/new': write(E.Plan),
  '/plans/$planId/edit': write(E.Plan),
  // V1 offers "Create with AI" only with plan and feature write.
  '/plans/ai': write(E.Plan),
  '/addons': read(E.Addon),
  '/addons/$addonId': read(E.Addon),
  '/addons/new': write(E.Addon),
  '/addons/$addonId/edit': write(E.Addon),
  '/coupons': read(E.Coupon),
  '/coupons/$couponId': read(E.Coupon),
  '/coupons/new': write(E.Coupon),
  '/coupons/$couponId/edit': write(E.Coupon),
  '/price-units': read(E.Price),
  '/price-units/$priceUnitId': read(E.Price),
  '/price-units/new': write(E.Price),
  '/groups': read(E.Group),
  '/groups/$groupId': read(E.Group),
  '/groups/new': write(E.Group),
  '/cost-sheets': read(E.CostSheet),
  '/cost-sheets/$costSheetId': read(E.CostSheet),
  '/cost-sheets/new': write(E.CostSheet),
  '/cost-sheets/$costSheetId/edit': write(E.CostSheet),
  '/pricing-widget': OPEN,

  // Customers and billing
  '/customers': read(E.Customer),
  '/customers/$customerId': read(E.Customer),
  '/customers/new': write(E.Customer),
  '/customers/$customerId/edit': write(E.Customer),
  '/customers/$customerId/contracts/new': write(E.Subscription),
  '/customers/$customerId/subscriptions/new': write(E.Subscription),
  '/contracts': read(E.Subscription),
  '/contracts/$subscriptionId': read(E.Subscription),
  '/contracts/new': write(E.Subscription),
  '/invoices': read(E.Invoice),
  '/invoices/$invoiceId': read(E.Invoice),
  '/invoices/new': write(E.Invoice),
  '/invoices/$invoiceId/edit': write(E.Invoice),
  '/payments': readOrWrite(E.Payment),
  '/payments/$paymentId': readOrWrite(E.Payment),
  '/payments/new': write(E.Payment),
  '/credit-memos': readOrWrite(E.CreditNote),
  '/credit-memos/$creditNoteId': readOrWrite(E.CreditNote),
  '/credit-memos/new': write(E.CreditNote),
  '/taxes': read(E.Tax),
  '/taxes/new': write(E.Tax),
  '/taxes/$taxRateId/edit': write(E.Tax),

  // Developers
  '/events': OPEN,
  '/usage-syncs': OPEN,
  '/workflows': { require: { entity: E.Workflow, action: 'read' } },
  '/api-keys': read(E.Secret),
  '/service-accounts': read(E.User),
  '/webhooks': read(E.Webhook),
  '/webhooks/$endpointId': read(E.Webhook),
  '/webhooks/new': write(E.Webhook),
  '/exports': read(E.Task),
  '/exports/s3': read(E.Connection),
  '/exports/s3/$connectionId': read(E.Task),
  '/exports/s3/$connectionId/$exportId': read(E.Task),

  // Integrations
  '/integrations': read(E.Connection),
  '/tools/integrations/oauth/callback': OPEN,

  // Settings gates each panel itself (`SettingsPage`), as V1's tabs do.
  '/settings': OPEN,
  // The tenant's own Flexprice account: open to anyone signed in, and to a
  // locked account above all: paying is its way back.
  '/settings/usage-billing': OPEN,
  '/settings/usage-billing/go-live': OPEN,
  '/billing/checkout/success': OPEN,
  '/billing/checkout/failure': OPEN,
  '/billing/checkout': OPEN,
  '/environments/new': OPEN,
  '/labels': OPEN,
}

/** The access for a route's full path; an unlisted path is open (the test keeps the list whole). */
export function routeAccessFor(fullPath: string | undefined): RouteAccess {
  if (!fullPath) return OPEN
  return ROUTE_ACCESS[fullPath.replace(/\/$/, '') || '/'] ?? OPEN
}
