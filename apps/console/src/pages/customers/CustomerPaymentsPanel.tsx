import { BillingEntityMode, gatewayCandidates, preferredGateway, type Customer } from '@fp/domain'
import {
  useBillingEntityMode,
  useClearPreferredConnection,
  useConnections,
  useSetPreferredConnection,
} from '@fp/query'
import { CustomerPaymentsSection } from '@fp/ui/pages'

/** Wires a customer's preferred payment gateway: the candidates, and set or clear on change. */
export function CustomerPaymentsPanel({
  customer,
}: {
  customer: Pick<Customer, 'id' | 'billingEntityId' | 'preferredConnectionId'>
}) {
  const integrations = useConnections()
  const { mode, entities } = useBillingEntityMode()
  const set = useSetPreferredConnection(customer.id)
  const clear = useClearPreferredConnection(customer.id)

  const gateways = gatewayCandidates(
    (integrations.data ?? []).flatMap((integration) => integration.connections),
    customer,
    entities ?? [],
    mode === 'enabled' ? BillingEntityMode.Enabled : BillingEntityMode.Off,
  )

  return (
    <CustomerPaymentsSection
      gateways={gateways}
      value={preferredGateway(customer.preferredConnectionId, gateways)}
      onChange={(connectionId) => (connectionId ? set.mutate(connectionId) : clear.mutate())}
      disabled={
        integrations.isPending ||
        mode === 'loading' ||
        mode === 'error' ||
        set.isPending ||
        clear.isPending
      }
    />
  )
}
