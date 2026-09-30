import { Section } from '../../compositions'
import { SimpleTable } from '../../compositions/DetailKit'

export interface AddonSubscriber {
  id: string
  customer: string
  plan: string
  since: string
  status: string
}

/** DEMO data: no add-on subscriptions endpoint exists yet. Replace with a query when one does. */
export const DEMO_ADDON_SUBSCRIPTIONS: AddonSubscriber[] = [
  { id: 's1', customer: 'Acme Corp', plan: 'Pro monthly', since: 'Aug 2, 2026', status: 'Active' },
  { id: 's2', customer: 'Globex', plan: 'Scale annual', since: 'Jul 14, 2026', status: 'Active' },
  { id: 's3', customer: 'Umbrella', plan: 'Pro monthly', since: 'Jun 30, 2026', status: 'Cancelled' },
]

export function AddonSubscriptionsView({
  subscriptions = DEMO_ADDON_SUBSCRIPTIONS,
}: {
  subscriptions?: AddonSubscriber[]
}) {
  return (
    <Section title="Subscriptions" description="Sample data: add-on subscriptions are not yet available from the API.">
      <SimpleTable
        rows={subscriptions}
        getRowId={(s) => s.id}
        empty="No subscription uses this add-on yet."
        columns={[
          { key: 'c', header: 'Customer', cell: (s) => s.customer },
          { key: 'p', header: 'Plan', cell: (s) => s.plan },
          { key: 'd', header: 'Since', cell: (s) => s.since },
          { key: 's', header: 'Status', cell: (s) => s.status },
        ]}
      />
    </Section>
  )
}
