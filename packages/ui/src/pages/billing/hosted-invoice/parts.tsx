import type { HostedInvoice } from '@fp/domain'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { Pill, type PillTone } from '../../shared/cells'

/** Pieces the hosted invoice page and its drawer share: the state pill, the amount's label and the merchant's mark. */
export const HostedInvoicePartsProvenance = provenance({
  source: 'composition',
  composes: ['shared/cells'],
  note: 'Hosted invoice state pill and merchant mark, as the customer portal shows them.',
})

const STATE: Record<HostedInvoice['state'], [PillTone, string]> = {
  open: ['warning', 'Due'],
  processing: ['info', 'Processing'],
  paid: ['success', 'Paid'],
  voided: ['neutral', 'Void'],
}

export function HostedInvoiceStatePill({ state }: { state: HostedInvoice['state'] }) {
  const [tone, label] = STATE[state]
  return <Pill tone={tone}>{label}</Pill>
}

export function amountLabelOf(state: HostedInvoice['state']): string {
  switch (state) {
    case 'paid':
      return 'Invoice paid'
    case 'voided':
      return 'Invoice voided'
    case 'processing':
      return 'Payment processing'
    case 'open':
      return 'Amount due'
  }
}

/** The merchant's initial on the primary tile, like the customer portal's header. */
export function TenantMark({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-medium',
        className,
      )}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}
