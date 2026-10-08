import { CUSTOMER_TAX_TREATMENT_LABEL, CustomerTaxTreatment } from '@fp/domain'
import { Avatar, AvatarFallback } from '@ui/components/primitives/avatar'
import { Badge } from '@ui/components/reui/badge'
import { FormPreview, PreviewRow, PreviewRows, PreviewSection } from '@ui/compositions/FormPreview'
import { provenance } from '@ui/provenance'

/**
 * The profile rail beside the customer form (solution-billing-8 rail): initials, name,
 * email, external ID, and the billing address and tax treatment as they are being entered. Driven by
 * the draft only.
 */
export const CustomerPreviewCardProvenance = provenance({
  source: 'composition',
  composes: ['ui/avatar', '@reui/badge', 'compositions/form-preview'],
  note: 'Live customer profile summary of the draft; fetches nothing.',
})

export interface CustomerPreviewCardProps {
  name: string
  externalId: string
  email?: string | undefined
  phone?: string | undefined
  addressLine1?: string | undefined
  addressLine2?: string | undefined
  addressCity?: string | undefined
  addressState?: string | undefined
  addressPostalCode?: string | undefined
  addressCountry?: string | undefined
  timezone?: string | undefined
  taxTreatment?: CustomerTaxTreatment | undefined
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = words[0] ?? ''
  const last = words.length > 1 ? (words[words.length - 1] ?? '') : ''
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

export function CustomerPreviewCard(props: CustomerPreviewCardProps) {
  const name = props.name.trim()
  const cityLine = [props.addressCity, props.addressState, props.addressPostalCode]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ')
  const addressLines = [
    props.addressLine1?.trim(),
    props.addressLine2?.trim(),
    cityLine,
    props.addressCountry?.trim().toUpperCase(),
  ].filter(Boolean)
  const tax = props.taxTreatment ?? CustomerTaxTreatment.Taxable

  return (
    <FormPreview
      title="Customer profile"
      label="Customer preview"
      badge={<Badge variant="outline">{CUSTOMER_TAX_TREATMENT_LABEL[tax]}</Badge>}
    >
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarFallback>{initialsOf(props.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{name || 'Untitled customer'}</p>
          <p className="text-muted-foreground truncate text-xs">
            {props.email?.trim() || 'No email yet'}
          </p>
        </div>
      </div>
      <PreviewSection title="Identity">
        <PreviewRows>
          <PreviewRow label="External ID" value={props.externalId.trim() || '—'} />
          {props.phone?.trim() ? <PreviewRow label="Phone" value={props.phone.trim()} /> : null}
          {props.timezone?.trim() ? (
            <PreviewRow label="Timezone" value={props.timezone.trim()} />
          ) : null}
        </PreviewRows>
      </PreviewSection>
      <PreviewSection title="Billing address">
        {addressLines.length > 0 ? (
          <div className="flex flex-col gap-0.5 text-sm">
            {addressLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Not set yet</p>
        )}
      </PreviewSection>
    </FormPreview>
  )
}
