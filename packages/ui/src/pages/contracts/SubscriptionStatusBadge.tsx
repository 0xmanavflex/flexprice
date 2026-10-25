import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  type CircleIcon,
  CirclePauseIcon,
  CircleSlashIcon,
} from '@ui/icons'
import { SUBSCRIPTION_STATUS_LABEL, SubscriptionStatus } from '@fp/domain'
import { provenance } from '@ui/provenance'
import { GlyphBadge } from '../shared/StatusBadge'

/**
 * A subscription's lifecycle, drawn like every status here: colour on the glyph,
 * neutral surface. It composes the shared {@link GlyphBadge} rather than a new
 * pill, so a subscription's status reads as the same object as an invoice's or a
 * catalogue's: one system across the console.
 *
 * The shape carries meaning colour cannot: a tick for active, dashes for a
 * trial, a slash for cancelled. Only Incomplete gets the destructive colour,
 * because it is the one state a subscription should not be left sitting in.
 */
export const SubscriptionStatusBadgeProvenance = provenance({
  source: 'composition',
  composes: ['@reui/badge'],
  note: 'The shared glyph badge, mapped to a contract lifecycle. Colour on the glyph only.',
})

const SUBSCRIPTION_STATUS: Record<SubscriptionStatus, { icon: typeof CircleIcon; tone: string }> = {
  [SubscriptionStatus.Active]: { icon: CircleCheckIcon, tone: 'text-success' },
  [SubscriptionStatus.Trialing]: { icon: CircleDashedIcon, tone: 'text-info' },
  [SubscriptionStatus.Paused]: { icon: CirclePauseIcon, tone: 'text-muted-foreground' },
  [SubscriptionStatus.Cancelled]: { icon: CircleSlashIcon, tone: 'text-muted-foreground' },
  [SubscriptionStatus.Incomplete]: { icon: CircleAlertIcon, tone: 'text-destructive' },
}

export interface SubscriptionStatusBadgeProps {
  status: SubscriptionStatus
}

export function SubscriptionStatusBadge({ status }: SubscriptionStatusBadgeProps) {
  const { icon, tone } = SUBSCRIPTION_STATUS[status]
  return <GlyphBadge icon={icon} tone={tone} label={SUBSCRIPTION_STATUS_LABEL[status]} />
}
