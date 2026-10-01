import { Section } from '../../compositions'
import { SimpleTable } from '../../compositions/DetailKit'

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
    <Section
      className="gap-0 p-0 [&>header]:p-5"
      title="Redemptions"
      description="Subscriptions this coupon is applied to. Sample data: redemption history is not yet available from the API."
    >
      <SimpleTable
        rows={redemptions}
        getRowId={(r) => r.id}
        empty="This coupon has not been redeemed yet."
        columns={[
          { key: 'c', header: 'Customer', cell: (r) => r.customer },
          { key: 's', header: 'Plan', cell: (r) => r.plan },
          { key: 'd', header: 'Applied', cell: (r) => r.appliedAt },
          { key: 'a', header: 'Discounted so far', cell: (r) => r.discount },
        ]}
      />
    </Section>
  )
}
