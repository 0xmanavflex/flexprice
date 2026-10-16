import { EmptyState, Section } from '../../../compositions'
import { DetailTable } from '../../shared/DetailTable'

export interface CouponRedemption {
  id: string
  /** The contract the coupon is applied to. */
  contractId?: string
  customer: string
  plan: string
  appliedAt: string
  /** When the discount stops, or "Ongoing". */
  endsAt?: string
  /** Whether the coupon is still applied. */
  status?: string
}

/**
 * Where a coupon is applied: one row per contract, from
 * `GET /coupons/associations`. Without `redemptions` (still loading) it says
 * so instead of showing sample rows; an empty array means none.
 */
export function CouponRedemptionsView({
  redemptions,
  onOpenContract,
}: {
  redemptions?: CouponRedemption[] | undefined
  onOpenContract?: ((contractId: string) => void) | undefined
}) {
  if (!redemptions) {
    return (
      <Section title="Redemptions">
        <EmptyState
          scene="settings"
          size="inline"
          title="Loading where this coupon is applied"
          description="The contracts using it appear here once they load."
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
        {...(onOpenContract
          ? {
              onRowClick: (r: CouponRedemption) => {
                if (r.contractId) onOpenContract(r.contractId)
              },
            }
          : {})}
        facet={{ label: 'Status', value: (r) => r.status ?? '' }}
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
            key: 'e',
            header: 'Ends',
            cell: (r) => <span className="text-muted-foreground">{r.endsAt ?? 'Ongoing'}</span>,
          },
          {
            key: 'st',
            header: 'Status',
            cell: (r) => <span className="text-muted-foreground">{r.status ?? '—'}</span>,
          },
        ]}
      />
    </Section>
  )
}
