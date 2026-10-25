/**
 * The mock corpus, for development and tests only.
 *
 * Exposed through the `@fp/query/fixtures` subpath rather than left for an app
 * to reach into `src/`: a deep import into another package's internals is the
 * kind of thing that works until it doesn't.
 *
 * Import it **dynamically**, inside the branch that decides to use mocks, so it
 * is never pulled into a production bundle.
 *
 * Every row here descends from a response the API actually returned. See
 * `scripts/synthesize.mjs` for the rule: vary values on a real record, never
 * invent the record.
 */
import addons from './__fixtures__/generated/addons.json' with { type: 'json' }
import coupons from './__fixtures__/generated/coupons.json' with { type: 'json' }
import creditgrants from './__fixtures__/generated/creditgrants.json' with { type: 'json' }
import customers from './__fixtures__/generated/customers.json' with { type: 'json' }
import entitlements from './__fixtures__/generated/entitlements.json' with { type: 'json' }
import features from './__fixtures__/generated/features.json' with { type: 'json' }
import invoices from './__fixtures__/generated/invoices.json' with { type: 'json' }
import plans from './__fixtures__/generated/plans.json' with { type: 'json' }
import priceUnits from './__fixtures__/generated/priceUnits.json' with { type: 'json' }
import prices from './__fixtures__/generated/prices.json' with { type: 'json' }
import subscriptions from './__fixtures__/generated/subscriptions.json' with { type: 'json' }

export interface Corpus {
  items: Record<string, unknown>[]
  pagination: { total: number; limit: number; offset: number }
}

/**
 * `coupons`, `priceUnits`, `entitlements` and `creditgrants` are the corpora not
 * descended from a capture: the capture environment had none, so an empty search
 * would leave those surfaces undemonstrable. Their rows are authored: but
 * authored *to shape*, every field matching `@flexprice/sdk`'s response models
 * (snake_case: a coupon's `amount_off` + `currency`; a price unit's `code` /
 * `symbol` / `base_currency` / `conversion_rate`; an entitlement's `usage_limit` /
 * `is_enabled` / `static_value` per feature type; a grant's `cadence` /
 * `expiration_type`), so the mock still cannot silently disagree with the wire.
 * `synthesize.mjs` does not touch them, having no captured source to expand. The
 * plan-scoped prices appended to `prices` share that rule.
 */
export const corpus = {
  addons,
  coupons,
  creditgrants,
  customers,
  entitlements,
  features,
  invoices,
  plans,
  priceUnits,
  prices,
  subscriptions,
} as unknown as Record<string, Corpus>
