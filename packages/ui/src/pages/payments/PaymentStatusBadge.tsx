import { PAYMENT_STATUS_LABEL, PaymentStatus } from '@fp/domain'
import { provenance } from '@ui/provenance'
import { Pill, type PillTone } from '../shared/cells'

/**
 * A payment's state, as the shared dot pill (reference `Status`): the same
 * object as an invoice's or a subscription's. Only a failure gets the
 * destructive dot; an overpayment is worth noting, not alarming, so it takes
 * `info`; pending is a warning, and refunded and voided stay neutral.
 */
export const PaymentStatusBadgeProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/cells'],
  note: 'The shared dot pill, mapped to a payment status. One status language across the console.',
})

const PAYMENT_TONE: Record<PaymentStatus, PillTone> = {
  [PaymentStatus.Pending]: 'warning',
  [PaymentStatus.Succeeded]: 'success',
  [PaymentStatus.Overpaid]: 'info',
  [PaymentStatus.Failed]: 'danger',
  [PaymentStatus.Refunded]: 'neutral',
  [PaymentStatus.Voided]: 'neutral',
}

export interface PaymentStatusBadgeProps {
  status: PaymentStatus
}

export function PaymentStatusBadge({ status }: PaymentStatusBadgeProps) {
  return <Pill tone={PAYMENT_TONE[status]}>{PAYMENT_STATUS_LABEL[status]}</Pill>
}
