import { BILLING_PERIOD_LABEL, type BillingPeriod } from '@fp/domain'
import {
  FormPreview,
  PreviewAmount,
  PreviewRow,
  PreviewRows,
  PreviewSection,
} from '@ui/compositions/FormPreview'
import { provenance } from '@ui/provenance'

/**
 * The summary rail beside the subscription form: who is being subscribed to
 * what, how it bills, and how many overrides and credit grants the draft
 * carries. Driven by the draft only.
 */
export const SubscriptionPreviewCardProvenance = provenance({
  source: 'composition',
  composes: ['compositions/form-preview'],
  note: 'Live subscription summary of the draft; fetches nothing. Rendered in the solution-billing-8 rail.',
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

export function SubscriptionPreviewCard(props: SubscriptionPreviewCardProps) {
  const every =
    props.billingPeriodCount > 1
      ? `Every ${props.billingPeriodCount} × ${BILLING_PERIOD_LABEL[props.billingPeriod]}`
      : BILLING_PERIOD_LABEL[props.billingPeriod]

  return (
    <FormPreview title="Subscription summary" label="Subscription preview">
      <PreviewAmount
        label={props.plan || 'No plan chosen'}
        value={props.currency.toUpperCase() || '—'}
        hint={props.customer || 'No customer chosen'}
      />
      <PreviewSection title="Billing">
        <PreviewRows>
          <PreviewRow label="Cycle" value={every} />
          <PreviewRow label="Starts" value={props.startDate || 'Now'} />
          <PreviewRow
            label="Trial"
            value={props.trialPeriodDays ? `${props.trialPeriodDays} days` : 'None'}
          />
        </PreviewRows>
      </PreviewSection>
      <PreviewSection title="Changes from the plan">
        <PreviewRows>
          <PreviewRow label="Price overrides" value={String(props.priceOverrides)} />
          <PreviewRow label="Entitlement overrides" value={String(props.entitlementOverrides)} />
          <PreviewRow label="Credit grants" value={String(props.creditGrants)} />
        </PreviewRows>
      </PreviewSection>
    </FormPreview>
  )
}
