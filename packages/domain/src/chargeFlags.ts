import type { BillingPeriod, Tier } from './price'
import type { CommitmentType } from './subscription'

/**
 * What is special about a charge, as the charges table and sheet show it.
 *
 * The table carries the charge, its price and nothing else; everything that
 * makes one charge differ from another: the override, the coupon, the
 * commitment, the alert thresholds, the earlier versions: is a *flag*, and the
 * detail lives in the side sheet the flag opens.
 *
 * A flag says only that something is there. Never "20% off", never "2,000,000
 * units": a value on a chip is a value someone reads instead of opening the
 * sheet, and five of them turn a row back into the nested table this replaced.
 *
 * The shapes below follow the API's, not the prototype's: a commitment is
 * `SubscriptionLineItemResponse`'s `commitment_*` fields, a window is a
 * `TimeOfDayBucket`, a version is a price's `start_date`/`end_date` pair. A
 * plan's charge is a bare `Price` and carries none of it.
 */

/** A part of the charge sheet, and the flag that opens it. */
export const ChargeSection = {
  Price: 'price',
  Discount: 'discount',
  Commitment: 'commitment',
  Alerts: 'alerts',
  History: 'history',
} as const
export type ChargeSection = (typeof ChargeSection)[keyof typeof ChargeSection]

/**
 * A window of the day with its own commitment and price (`TimeOfDayBucket`).
 *
 * The hours are UTC on the wire and shown as such: a window that moved with
 * the reader's timezone would not be the window the contract agreed.
 */
export interface ChargeCommitmentWindow {
  id: string
  /** `HH:MM`, UTC. */
  start: string
  /** `HH:MM`, UTC. */
  end: string
  /** The committed figure with its unit, already formatted. */
  value: string
  overageFactor: number
  trueUp: boolean
  /**
   * The window's own price bands, when the line included them.
   *
   * `TimeOfDayBucket` returns `priceId` and not the price, so this is empty
   * until a response embeds the bands. An id is not rendered as a tier.
   */
  tiers?: Tier[]
}

/**
 * A commitment on a line, in whichever of its three states it is in.
 *
 * Not windowed: a figure per billing period, or per `duration` when one is set.
 * Windowed with no windows: the same figure applies to every bucket, all day.
 * Windowed with windows: those windows have their own figure and price, and
 * the rest of the day keeps the charge's.
 */
/**
 * Named `…Detail` because `ChargeCommitment` is already the *write* shape: the
 * contract form's schema for setting one. This is what the API sends back,
 * which is a different thing: it carries the windows, and its figures arrive
 * formatted rather than as fields to validate.
 */
export interface ChargeCommitmentDetail {
  type: CommitmentType
  /** `commitment_amount` or `commitment_quantity`, formatted with its unit. */
  value: string
  /** `commitment_duration`; null means the billing period. */
  duration: BillingPeriod | null
  /** `commitment_overage_factor`, e.g. 1.2 for "×1.2". */
  overageFactor: number
  trueUp: boolean
  /** `commitment_windowed`: the figure applies per bucket rather than per period. */
  windowed: boolean
  /** `commitment_time_buckets`; empty when the commitment covers the whole day. */
  windows: ChargeCommitmentWindow[]
}

/** A coupon on this line. */
export interface ChargeCoupon {
  code: string
  name: string
  /** What it takes off, formatted ("20%", "$50.00"). */
  discount: string
  endsAt: Date | null
}

/** One usage alert threshold set on this line. */
export interface ChargeAlert {
  /** What it is called ("Warning", "Critical"). */
  condition?: string | undefined
  level: string
  /** The threshold, formatted ("80%", "1,000,000 units"). */
  value: string
  /** The alert setting this threshold belongs to, when the page can edit it. */
  settingId?: string | undefined
  /** `percentage` or `absolute`, shared by every threshold of the setting. */
  thresholdType?: 'percentage' | 'absolute' | undefined
  /** The unformatted threshold, so Edit starts from the stored number. */
  threshold?: string | undefined
}

/**
 * One version of a charge.
 *
 * Every price edit ends one version and starts the next, so each is a full
 * snapshot with its own window. The current one has no `endDate`.
 */
export interface ChargeVersion {
  id: string
  /** The price this version charged, formatted. */
  price: string
  startDate: Date | null
  endDate: Date | null
  updatedAt: Date | null
  /** `updated_by`, resolved to a name when the console could. */
  actor?: string | undefined
}

/**
 * What the console knows about a charge beyond the price itself.
 *
 * Supplied per charge by the page, not read off `Charge`: a plan's charge is a
 * `Price` and carries none of this, while a contract's is a subscription line
 * item that carries most of it. The table takes the same shape either way, and
 * a page that cannot read a part leaves it out rather than sending `false`:
 * absent and "known to be absent" are the same to a flag, and pretending
 * otherwise would invent a certainty the page does not have.
 */
export interface ChargeDetail {
  /**
   * The charge was overridden here. This may only change quantity or commitment.
   *
   * Separate from `overriddenFrom` because the two are known at different
   * costs: `parent_price_id` on the line says *that* it changed and comes
   * free with the line, while *what it changed from* needs the parent price
   * fetched. A page that knows only the first still flags the row honestly,
   * and the sheet simply does not state a previous price.
   */
  overridden?: boolean | undefined
  /** The plan's price, formatted, when this charge's differs from it. */
  overriddenFrom?: string | undefined
  /** What the line bills, when it is not simply one of something. */
  quantity?: string | undefined
  coupon?: ChargeCoupon | undefined
  coupons?: readonly ChargeCoupon[] | undefined
  commitment?: ChargeCommitmentDetail | undefined
  alerts?: readonly ChargeAlert[] | undefined
  /** Every version, newest first. One entry is the charge itself, not history. */
  versions?: readonly ChargeVersion[] | undefined
}

/**
 * A charge's versions as read from the API when its sheet opens:
 * `GET /prices/{id}/history` for a plan's charge,
 * `GET /subscriptions/lineitems/{id}/history` for a contract's.
 * Replaces `ChargeDetail.versions` in the sheet once given.
 */
export interface ChargeHistory {
  /** Every version, any order; the sheet sorts newest first. */
  versions?: readonly ChargeVersion[] | undefined
  isLoading?: boolean | undefined
  /** Why the read failed, shown in place of the list. */
  error?: string | null | undefined
  onRetry?: (() => void) | undefined
}

export interface ChargeFlag {
  section: ChargeSection
  label: string
}

/**
 * The flags on a charge, always in this order.
 *
 * Fixed, so the same charge reads the same on every page and the eye learns
 * the positions rather than re-reading the row. History is last because it is
 * the only one that is about the past.
 */
export function chargeFlags(detail: ChargeDetail | undefined): ChargeFlag[] {
  if (!detail) return []
  const flags: ChargeFlag[] = []
  if (detail.overridden || detail.overriddenFrom) {
    flags.push({
      section: ChargeSection.Price,
      label: detail.overriddenFrom ? 'Price changed' : 'Changed here',
    })
  }
  if (detail.coupon || detail.coupons?.length)
    flags.push({ section: ChargeSection.Discount, label: 'Discount' })
  if (detail.commitment) flags.push({ section: ChargeSection.Commitment, label: 'Commitment' })
  if (detail.alerts && detail.alerts.length > 0) {
    flags.push({ section: ChargeSection.Alerts, label: 'Alerts' })
  }
  // One version is the charge as it stands, which is not history.
  if ((detail.versions?.length ?? 0) > 1) {
    flags.push({ section: ChargeSection.History, label: 'History' })
  }
  return flags
}

/** A charge changed from what its plan sets. History alone is not a change. */
export function isChargeCustomised(detail: ChargeDetail | undefined): boolean {
  return chargeFlags(detail).some((flag) => flag.section !== ChargeSection.History)
}
