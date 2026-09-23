import { InvoiceStatus, needsAttention } from '@fp/domain'
import { Badge } from '@ui/components/reui/badge'
import { provenance } from '@ui/provenance'

/**
 * A billing status, coloured by what it asks of the reader.
 *
 * The rule is that only a status needing action is destructive. If several
 * shout at once, none of them does, and the one row a billing operator has to
 * act on stops standing out.
 *
 * The `-light` variants are used rather than the solid ones because the solid
 * ones fail WCAG AA at this size — white on `success` measures 2.47:1 against a
 * 4.5:1 threshold. That was caught by the accessibility check, not by eye.
 */
export const StatusBadgeProvenance = provenance({
  source: 'composition',
  composes: ['@reui/badge'],
  note: 'Maps domain billing statuses to accessible badge variants in one place.',
})

type Variant = 'secondary' | 'info-light' | 'success-light' | 'destructive-light'

const INVOICE_VARIANT: Record<InvoiceStatus, Variant> = {
  [InvoiceStatus.Draft]: 'secondary',
  [InvoiceStatus.Open]: 'info-light',
  [InvoiceStatus.Paid]: 'success-light',
  [InvoiceStatus.Overdue]: 'destructive-light',
  [InvoiceStatus.Void]: 'secondary',
  [InvoiceStatus.Skipped]: 'secondary',
}

const INVOICE_LABEL: Record<InvoiceStatus, string> = {
  [InvoiceStatus.Draft]: 'Draft',
  [InvoiceStatus.Open]: 'Open',
  [InvoiceStatus.Paid]: 'Paid',
  [InvoiceStatus.Overdue]: 'Overdue',
  [InvoiceStatus.Void]: 'Void',
  [InvoiceStatus.Skipped]: 'Skipped',
}

export interface InvoiceStatusBadgeProps {
  status: InvoiceStatus
}

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  return (
    <Badge variant={INVOICE_VARIANT[status]} size="sm">
      {INVOICE_LABEL[status]}
      {/* Colour alone cannot carry "this one needs you". */}
      {needsAttention(status) ? <span className="sr-only"> — needs attention</span> : null}
    </Badge>
  )
}
