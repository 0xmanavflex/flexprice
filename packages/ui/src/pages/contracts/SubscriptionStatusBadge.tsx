import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleIcon,
  CirclePauseIcon,
  CircleSlashIcon,
} from '@ui/icons'
import { SUBSCRIPTION_STATUS_LABEL, SubscriptionStatus } from '@fp/domain'
import { provenance } from '@ui/provenance'
import { GlyphBadge } from '../shared/StatusBadge'
import { SUBSCRIPTION_STATUS_TONE, TONE_TEXT } from '../shared/statusTones'

/**
 * A subscription's lifecycle, drawn like every status here: colour on the glyph,
 * neutral surface. It composes the shared {@link GlyphBadge} rather than a new
 * pill, so a subscription's status reads as the same object as an invoice's or a
 * catalogue's: one system across the console.
 *
 * The shape carries meaning colour cannot: a tick for active, dashes for a
 * trial, a slash for cancelled. The colour comes from the shared registry,
 * `SUBSCRIPTION_STATUS_TONE`, so the badge and the contracts grid agree.
 */
export const SubscriptionStatusBadgeProvenance = provenance({
  source: 'composition',
  composes: ['@reui/badge'],
  note: 'The shared glyph badge, mapped to a contract lifecycle. Colour on the glyph only.',
})

/** The shape each status carries; its colour comes from the shared registry. */
const SUBSCRIPTION_STATUS_ICON: Record<SubscriptionStatus, typeof CircleIcon> = {
  [SubscriptionStatus.Active]: CircleCheckIcon,
  [SubscriptionStatus.Trialing]: CircleDashedIcon,
  [SubscriptionStatus.Paused]: CirclePauseIcon,
  [SubscriptionStatus.Cancelled]: CircleSlashIcon,
  [SubscriptionStatus.Incomplete]: CircleAlertIcon,
  // An empty circle: saved, nothing started yet.
  [SubscriptionStatus.Draft]: CircleIcon,
}

export interface SubscriptionStatusBadgeProps {
  status: SubscriptionStatus
}

export function SubscriptionStatusBadge({ status }: SubscriptionStatusBadgeProps) {
  return (
    <GlyphBadge
      icon={SUBSCRIPTION_STATUS_ICON[status]}
      tone={TONE_TEXT[SUBSCRIPTION_STATUS_TONE[status]]}
      label={SUBSCRIPTION_STATUS_LABEL[status]}
    />
  )
}
