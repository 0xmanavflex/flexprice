import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleIcon,
  CircleMinusIcon,
  CircleSlashIcon,
} from 'lucide-react'
import { InvoiceStatus, needsAttention } from '@fp/domain'
import { Badge } from '@ui/components/reui/badge'
import { provenance } from '@ui/provenance'

/**
 * A billing status: an icon in colour, on a surface that stays neutral.
 *
 * Colour is carried by the glyph rather than a fill. With five statuses down
 * eighteen dense rows, tinted fills turn the status column into a traffic
 * light — every row shouting at once, which is the same as none of them
 * shouting. A ring of neutral pills with one red glyph in it reads instantly.
 *
 * The shape also does work colour cannot: dashed for draft, hollow for open,
 * a tick for paid, a slash for void. Someone who cannot distinguish the hues
 * can still tell the six apart, and so can a printed page.
 *
 * Only a status needing action gets the destructive colour. If several shout,
 * the one row a billing operator has to act on stops standing out.
 *
 * Solid variants were tried and dropped: white on `success` measures 2.47:1
 * against a 4.5:1 threshold. The accessibility check caught that, not the eye.
 */
export const StatusBadgeProvenance = provenance({
  source: 'composition',
  composes: ['@reui/badge'],
  note: 'Colour on the glyph, neutral surface — so a dense column is not a traffic light.',
})

/** The colour each status carries, on its icon only. */
const INVOICE_TONE: Record<InvoiceStatus, string> = {
  [InvoiceStatus.Draft]: 'text-muted-foreground',
  [InvoiceStatus.Open]: 'text-info',
  [InvoiceStatus.Paid]: 'text-success',
  [InvoiceStatus.Overdue]: 'text-destructive',
  [InvoiceStatus.Void]: 'text-muted-foreground',
  [InvoiceStatus.Skipped]: 'text-muted-foreground',
}

/** Shape, so the six are distinguishable without colour at all. */
const INVOICE_ICON: Record<InvoiceStatus, typeof CircleIcon> = {
  [InvoiceStatus.Draft]: CircleDashedIcon,
  [InvoiceStatus.Open]: CircleIcon,
  [InvoiceStatus.Paid]: CircleCheckIcon,
  [InvoiceStatus.Overdue]: CircleAlertIcon,
  [InvoiceStatus.Void]: CircleSlashIcon,
  [InvoiceStatus.Skipped]: CircleMinusIcon,
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
  const Icon = INVOICE_ICON[status]

  return (
    <Badge
      variant="outline"
      size="sm"
      radius="full"
      className="border-border/60 bg-transparent px-2 font-normal text-foreground dark:bg-transparent"
    >
      <Icon aria-hidden className={INVOICE_TONE[status]} />
      {INVOICE_LABEL[status]}
      {/* Colour alone cannot carry "this one needs you". */}
      {needsAttention(status) ? <span className="sr-only"> — needs attention</span> : null}
    </Badge>
  )
}
