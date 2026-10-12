import { EmptyState, Section } from '../../../compositions'
import { DetailTable } from '../../shared/DetailTable'

export interface CouponRedemption {
  id: string
  customer: string
  plan: string
  appliedAt: string
  discount: string
}

/**
 * Who has redeemed a coupon. Flexprice has no redemption-history endpoint yet,
 * so the console passes no `redemptions` and this says so; it never shows
 * sample rows. Pass the rows (an empty array means none) once a source exists.
 */
export function CouponRedemptionsView({
  redemptions,
}: {
  redemptions?: CouponRedemption[] | undefined
}) {
  if (!redemptions) {
    return (
      <Section title="Redemptions">
        <EmptyState
          scene="settings"
          size="inline"
          title="Redemption history is not available yet"
          description="Flexprice does not report who has redeemed a coupon, so none are shown."
        />
      </Section>
    )
  }
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
