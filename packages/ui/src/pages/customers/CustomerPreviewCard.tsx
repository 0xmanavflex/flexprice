import { CUSTOMER_TAX_TREATMENT_LABEL, CustomerTaxTreatment } from '@fp/domain'
import { Avatar, AvatarFallback } from '@ui/components/primitives/avatar'
import { Card, CardContent } from '@ui/components/primitives/card'
import { Badge } from '@ui/components/reui/badge'
import { provenance } from '@ui/provenance'

/**
 * The profile rail beside the customer form: initials, name, email, external ID,
 * and the billing address and tax treatment as they are being entered. Driven by
 * the draft only.
 */
export const CustomerPreviewCardProvenance = provenance({
  source: 'composition',
  composes: ['ui/card', 'ui/avatar', '@reui/badge'],
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
    <Card className="gap-0 p-0 shadow-xs">
      <CardContent className="flex flex-col gap-3 p-4">
        <p className="text-muted-foreground text-xs">Customer profile</p>
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
        <p className="text-muted-foreground font-mono text-xs break-all">
          {props.externalId.trim() || 'external_id'}
        </p>
        <div className="flex flex-col gap-1 border-t pt-3 text-sm">
          <p className="text-muted-foreground text-xs">Billing address</p>
          {addressLines.length > 0 ? (
            addressLines.map((line) => <p key={line}>{line}</p>)
          ) : (
            <p className="text-muted-foreground text-xs">Not set yet</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <Badge variant="outline">{CUSTOMER_TAX_TREATMENT_LABEL[tax]}</Badge>
          {props.timezone?.trim() ? (
            <span className="text-muted-foreground text-xs">{props.timezone.trim()}</span>
          ) : null}
          {props.phone?.trim() ? (
            <span className="text-muted-foreground text-xs">{props.phone.trim()}</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
