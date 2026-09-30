import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  type CircleIcon,
  CircleMinusIcon,
  CircleSlashIcon,
} from 'lucide-react'
import { PAYMENT_STATUS_LABEL, PaymentStatus } from '@fp/domain'
import { provenance } from '@ui/provenance'
import { GlyphBadge } from '../shared/StatusBadge'

/**
 * A payment's state, drawn the way every status here is: an outline pill with
 * colour on the glyph, not a fill.
 *
 * Composed from the shared `GlyphBadge` rather than a badge of its own, so a
 * payment's status reads as the same object as an invoice's or a coupon's. Only
 * a failure gets the destructive colour — an overpayment is worth noting, not
 * alarming, so it takes `info`; pending, refunded and voided stay neutral, and
 * the glyph shape keeps the six apart without relying on hue.
 */
export const PaymentStatusBadgeProvenance = provenance({
  source: 'composition',
  composes: ['@reui/badge'],
  note: 'The shared glyph chip, mapped to a payment status. Colour on the glyph, one system across the console.',
})

const PAYMENT_STATUS: Record<PaymentStatus, { icon: typeof CircleIcon; tone: string }> = {
  [PaymentStatus.Pending]: { icon: CircleDashedIcon, tone: 'text-muted-foreground' },
  [PaymentStatus.Succeeded]: { icon: CircleCheckIcon, tone: 'text-success' },
  [PaymentStatus.Overpaid]: { icon: CircleAlertIcon, tone: 'text-info' },
  [PaymentStatus.Failed]: { icon: CircleAlertIcon, tone: 'text-destructive' },
  [PaymentStatus.Refunded]: { icon: CircleMinusIcon, tone: 'text-muted-foreground' },
  [PaymentStatus.Voided]: { icon: CircleSlashIcon, tone: 'text-muted-foreground' },
}

export interface PaymentStatusBadgeProps {
  status: PaymentStatus
}

export function PaymentStatusBadge({ status }: PaymentStatusBadgeProps) {
  const { icon, tone } = PAYMENT_STATUS[status]
  return <GlyphBadge icon={icon} tone={tone} label={PAYMENT_STATUS_LABEL[status]} />
}
