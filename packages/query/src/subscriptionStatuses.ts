import type { FlexpriceModels } from '@fp/api'

/**
 * The subscription statuses a search must name.
 *
 * `POST /subscriptions/search` returns only **active** subscriptions when the
 * request names no `subscription_status` (backend `subscription.go`: "Default
 * to active when the client did not constrain subscription_status"). So a
 * search that leaves it out silently drops every trialing, paused, draft,
 * incomplete and cancelled contract: a trialing contract's own page reads
 * "not found", and lists and counts come up short. Every search names one of
 * these instead.
 */

/** Every status the API has. For a read by id, and a list with no status chosen. */
export const ALL_SUBSCRIPTION_STATUSES: FlexpriceModels.SubscriptionStatus[] = [
  'active',
  'trialing',
  'paused',
  'incomplete',
  'draft',
  'cancelled',
]

/** Every status but cancelled: the contracts a customer or plan still has. */
export const LIVE_SUBSCRIPTION_STATUSES: FlexpriceModels.SubscriptionStatus[] =
  ALL_SUBSCRIPTION_STATUSES.filter((status) => status !== 'cancelled')
