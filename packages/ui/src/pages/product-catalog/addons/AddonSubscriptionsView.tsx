import { EmptyState, Section } from '../../../compositions'

import { Status } from '../../shared/cells'
import { DetailTable } from '../../shared/DetailTable'

export interface AddonSubscriber {
  id: string
  customer: string
  plan: string
  since: string
  status: string
}

/**
 * The contracts using an add-on. Flexprice has no add-on contracts endpoint
 * yet, so the console passes no `subscriptions` and this says so; it never
 * shows sample rows. Pass the rows (an empty array means none) once a source
 * exists.
 */
export function AddonSubscriptionsView({
  subscriptions,
}: {
  subscriptions?: AddonSubscriber[] | undefined
}) {
  if (!subscriptions) {
    return (
      <Section title="Contracts">
        <EmptyState
          size="inline"
          title="Contracts using this add-on are not available yet"
          description="Flexprice does not list the contracts that use an add-on, so none are shown."
        />
      </Section>
    )
  }
  return (
    <Section table title="Contracts">
      <DetailTable
        compact
        label="Contracts"
        facet={{ label: 'Status', value: (s) => s.status }}
        noun="subscriptions"
        rows={subscriptions}
        getRowId={(s) => s.id}
        empty="No contract uses this add-on yet."
        columns={[
          {
            key: 'c',
            header: 'Customer',
            sortBy: (s) => s.customer,
            cell: (s) => <span className="font-medium">{s.customer}</span>,
          },
          {
            key: 'p',
            header: 'Plan',
            sortBy: (s) => s.plan,
            cell: (s) => <span className="text-muted-foreground">{s.plan}</span>,
          },
          {
            key: 's',
            header: 'Status',
            sortBy: (s) => s.status,
            cell: (s) => <Status value={s.status} />,
          },
          {
            key: 'd',
            header: 'Added',
            cell: (s) => <span className="text-muted-foreground">{s.since}</span>,
          },
        ]}
      />
    </Section>
  )
}
