import { BillingEntityMode, effectiveEntityId, type BillingEntity } from './billingEntity'
import type { IntegrationConnection } from './integration'

/** Providers a customer can prefer for payments; the backend's `PaymentGatewayFromSecretProvider`. */
export const PAYMENT_GATEWAY_PROVIDERS: ReadonlySet<string> = new Set([
  'stripe',
  'razorpay',
  'nomod',
  'moyasar',
  'paddle',
  'whop',
  'chargebee',
])

/**
 * The connections a customer's preferred payment gateway can be: the
 * environment's payment connections, narrowed to the customer's entity while
 * entities are enabled.
 */
export function gatewayCandidates(
  connections: readonly IntegrationConnection[],
  customer: { billingEntityId?: string | null | undefined },
  entities: readonly Pick<BillingEntity, 'id' | 'isDefault'>[],
  mode: BillingEntityMode | undefined,
): IntegrationConnection[] {
  const gateways = connections.filter((item) => PAYMENT_GATEWAY_PROVIDERS.has(item.providerType))
  if (mode !== BillingEntityMode.Enabled) return gateways
  const entityId = effectiveEntityId(customer, entities)
  return gateways.filter((item) => effectiveEntityId(item, entities) === entityId)
}

/** The preferred connection to show; null (Automatic) when there is none or it is no longer a candidate. */
export function preferredGateway(
  preferredConnectionId: string | null | undefined,
  candidates: readonly Pick<IntegrationConnection, 'id'>[],
): string | null {
  return candidates.some((item) => item.id === preferredConnectionId)
    ? (preferredConnectionId ?? null)
    : null
}
