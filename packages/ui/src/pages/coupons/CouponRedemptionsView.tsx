import { Section } from '../../compositions'
import { SimpleTable } from '../../compositions/DetailKit'

export interface CouponRedemption {
  id: string
  customer: string
  subscription: string
  redeemedAt: string
  discount: string
}

/** DEMO data: no redemption-history endpoint exists yet. Replace with a query when one does. */
export const DEMO_COUPON_REDEMPTIONS: CouponRedemption[] = [
  { id: 'r1', customer: 'Acme Corp', subscription: 'Pro monthly', redeemedAt: 'Sep 12, 2026', discount: '$24.00' },
  { id: 'r2', customer: 'Globex', subscription: 'Scale annual', redeemedAt: 'Sep 3, 2026', discount: '$120.00' },
  { id: 'r3', customer: 'Initech', subscription: 'Pro monthly', redeemedAt: 'Aug 27, 2026', discount: '$24.00' },
]

export function CouponRedemptionsView({
  redemptions = DEMO_COUPON_REDEMPTIONS,
}: {
  redemptions?: CouponRedemption[]
}) {
  return (
    <Section title="Redemptions" description="Sample data: redemption history is not yet available from the API.">
      <SimpleTable
        rows={redemptions}
        getRowId={(r) => r.id}
        empty="This coupon has not been redeemed yet."
        columns={[
          { key: 'c', header: 'Customer', cell: (r) => r.customer },
          { key: 's', header: 'Subscription', cell: (r) => r.subscription },
          { key: 'd', header: 'Redeemed', cell: (r) => r.redeemedAt },
          { key: 'a', header: 'Discount', cell: (r) => r.discount },
        ]}
      />
    </Section>
  )
}
