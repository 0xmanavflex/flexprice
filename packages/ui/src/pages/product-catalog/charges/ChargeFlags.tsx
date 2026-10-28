import { ChargeSection, chargeFlags, type ChargeDetail, type ChargeFlag } from '@fp/domain'
import { Badge } from '@ui/components/reui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/components/primitives/tooltip'
import { BellIcon, CircleDollarSignIcon, ClockIcon, ScaleIcon, TicketPercentIcon } from '@ui/icons'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * The flags on a charge row.
 *
 * Neutral outline chips with one coloured icon each: the colour carries which
 * flag it is at a glance, the label says it in words, and neither carries a
 * value. A chip that read "20% off" would be read *instead of* the sheet, and
 * five of those turn the row back into the nested table this replaced.
 *
 * Every chip is a button: clicking one opens the charge sheet already scrolled
 * to that part, which is the whole bargain: the row stays one line because
 * the detail is one click away, in a known place.
 */
export const ChargeFlagsProvenance = provenance({
  source: 'composition',
  composes: ['reui/badge', 'ui/tooltip'],
  note: 'The five charge flags as clickable chips, each opening the charge sheet at its section.',
})

/**
 * Icon and tint per flag.
 *
 * The `-foreground` tints rather than the raw `text-info`/`text-warning`: these
 * sit at 14px on a tinted row, and the raw tokens are tuned for a filled chip,
 * not for text on the row's own background.
 */
const APPEARANCE: Record<ChargeSection, { icon: typeof ScaleIcon; tone: string }> = {
  [ChargeSection.Price]: { icon: CircleDollarSignIcon, tone: 'text-info-foreground' },
  [ChargeSection.Discount]: { icon: TicketPercentIcon, tone: 'text-success-foreground' },
  [ChargeSection.Commitment]: { icon: ScaleIcon, tone: 'text-primary' },
  [ChargeSection.Alerts]: { icon: BellIcon, tone: 'text-warning-foreground' },
  [ChargeSection.History]: { icon: ClockIcon, tone: 'text-muted-foreground' },
}

export interface ChargeFlagsProps {
  /** What is special about the charge. No flags when absent. */
  detail: ChargeDetail | undefined
  /** Names the charge in each chip's accessible label, so a screen reader hears which row it is on. */
  chargeName: string
  onOpen: (section: ChargeSection) => void
  /**
   * The narrow table beside a side rail.
   *
   * Keeps the row on one line: the first two chips keep their label and the
   * rest shrink to the icon alone, which names itself on hover and carries the
   * same accessible label either way.
   */
  compact?: boolean
}

export function ChargeFlags({ detail, chargeName, onOpen, compact = false }: ChargeFlagsProps) {
  const flags = chargeFlags(detail)
  if (flags.length === 0) return null

  return (
    <span className={cn('flex gap-1', compact ? 'flex-nowrap' : 'flex-wrap')}>
      {flags.map((flag, index) => (
        <FlagChip
          key={flag.section}
          flag={flag}
          chargeName={chargeName}
          onOpen={onOpen}
          iconOnly={compact && index >= 2}
        />
      ))}
    </span>
  )
}

function FlagChip({
  flag,
  chargeName,
  onOpen,
  iconOnly,
}: {
  flag: ChargeFlag
  chargeName: string
  onOpen: (section: ChargeSection) => void
  iconOnly: boolean
}) {
  const { icon: Icon, tone } = APPEARANCE[flag.section]
  const label = `${flag.label}: open ${chargeName}`
  const open = (event: { stopPropagation: () => void }) => {
    // The row itself opens the sheet at the top; this one opens it at a part.
    event.stopPropagation()
    onOpen(flag.section)
  }

  const chip = (
    <Badge
      variant="outline"
      size="lg"
      className={cn('hover:bg-muted shrink-0 cursor-pointer font-normal', iconOnly && 'px-1.5')}
      render={<button type="button" aria-label={label} onClick={open} />}
    >
      <Icon aria-hidden className={cn('size-3.5', tone)} />
      {iconOnly ? null : flag.label}
    </Badge>
  )

  if (!iconOnly) return chip

  return (
    <Tooltip>
      <TooltipTrigger render={chip} />
      <TooltipContent>{flag.label}</TooltipContent>
    </Tooltip>
  )
}
