import { BILLING_PERIOD_LABEL, type BillingPeriod } from '@fp/domain'
import { provenance } from '@ui/provenance'

/**
 * The summary rail beside the subscription form: who is being subscribed to
 * what, how it bills, and how many overrides and credit grants the draft
 * carries. Driven by the draft only.
 */
export const SubscriptionPreviewCardProvenance = provenance({
  source: 'composition',
  composes: [],
  note: 'Live subscription summary of the draft; fetches nothing. Same rail idiom as CustomerPreviewCard.',
})

export interface SubscriptionPreviewCardProps {
  customer?: string | undefined
  plan?: string | undefined
  currency: string
  billingPeriod: BillingPeriod
  billingPeriodCount: number
  startDate?: string | undefined
  trialPeriodDays?: number | undefined
  priceOverrides: number
  entitlementOverrides: number
  creditGrants: number
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  )
}

export function SubscriptionPreviewCard(props: SubscriptionPreviewCardProps) {
  const every =
    props.billingPeriodCount > 1
      ? `Every ${props.billingPeriodCount} × ${BILLING_PERIOD_LABEL[props.billingPeriod]}`
      : BILLING_PERIOD_LABEL[props.billingPeriod]

  return (
    <aside aria-label="Subscription preview" className="bg-background rounded-xl border">
      <div className="flex flex-col gap-3 p-4">
        <p className="text-muted-foreground text-xs">Subscription summary</p>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{props.plan || 'No plan chosen'}</p>
          <p className="text-muted-foreground truncate text-xs">
            {props.customer || 'No customer chosen'}
          </p>
        </div>
        <div className="flex flex-col gap-2 border-t pt-3">
          <Row label="Billing" value={`${props.currency.toUpperCase() || '—'} · ${every}`} />
          <Row label="Starts" value={props.startDate || 'Now'} />
          <Row
            label="Trial"
            value={props.trialPeriodDays ? `${props.trialPeriodDays} days` : 'None'}
          />
        </div>
        <div className="flex flex-col gap-2 border-t pt-3">
          <Row label="Price overrides" value={String(props.priceOverrides)} />
          <Row label="Entitlement overrides" value={String(props.entitlementOverrides)} />
          <Row label="Credit grants" value={String(props.creditGrants)} />
        </div>
      </div>
    </aside>
  )
}
