import { Section } from '../../../compositions'
import { DetailTable } from '../../shared/DetailTable'

export interface CouponRedemption {
  id: string
  customer: string
  plan: string
  appliedAt: string
  discount: string
}

/** DEMO data: no redemption-history endpoint exists yet. Replace with a query when one does. */
export const DEMO_COUPON_REDEMPTIONS: CouponRedemption[] = [
  {
    id: 'r1',
    customer: 'Acme Robotics',
    plan: 'Starter',
    appliedAt: 'Jan 10, 2026',
    discount: '$84.00',
  },
  { id: 'r2', customer: 'Globex AI', plan: 'Pro', appliedAt: 'Feb 11, 2026', discount: '$120.00' },
  {
    id: 'r3',
    customer: 'Initech Cloud',
    plan: 'Team',
    appliedAt: 'Mar 12, 2026',
    discount: '$24.00',
  },
]

export function CouponRedemptionsView({
  redemptions = DEMO_COUPON_REDEMPTIONS,
}: {
  redemptions?: CouponRedemption[]
}) {
  return (
    <Section table title="Redemptions">
      <DetailTable
        compact
        label="Redemptions"
        noun="redemptions"
        rows={redemptions}
        getRowId={(r) => r.id}
        empty="This coupon has not been redeemed yet."
        columns={[
          {
            key: 'c',
            header: 'Customer',
            sortBy: (r) => r.customer,
            cell: (r) => <span className="font-medium">{r.customer}</span>,
          },
          {
            key: 's',
            header: 'Plan',
            sortBy: (r) => r.plan,
            cell: (r) => <span className="text-muted-foreground">{r.plan}</span>,
          },
          {
            key: 'd',
            header: 'Applied',
            cell: (r) => <span className="text-muted-foreground">{r.appliedAt}</span>,
          },
          {
            key: 'a',
            header: 'Discounted so far',
            cell: (r) => <span className="tabular-nums">{r.discount}</span>,
          },
        ]}
      />
    </Section>
  )
}
