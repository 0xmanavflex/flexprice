import { Section } from '../../compositions'
import { SimpleTable } from '../../compositions/DetailKit'
import { Status } from '../shared/cells'

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
    <Section title="Subscriptions" description="Where this add-on is attached" flush>
      <SimpleTable
        rows={subscriptions}
        getRowId={(s) => s.id}
        empty="No subscription uses this add-on yet."
        columns={[
          { key: 'c', header: 'Customer', cell: (s) => <span className="font-medium">{s.customer}</span> },
          { key: 'p', header: 'Plan', cell: (s) => <span className="text-muted-foreground">{s.plan}</span> },
          { key: 's', header: 'Status', cell: (s) => <Status value={s.status} /> },
          { key: 'd', header: 'Added', cell: (s) => <span className="text-muted-foreground">{s.since}</span> },
        ]}
      />
    </Section>
  )
}
