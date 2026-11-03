import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  BILLING_MODEL_LABEL,
  BILLING_PERIOD_LABEL,
  BillingModel,
  type BillingPeriod,
  type Charge,
  type ChargeCommitmentDetail,
  type ChargeDetail,
  type ChargeHistory,
  ChargeSection,
  CommitmentType,
  InvoiceCadence,
  PriceType,
  PriceWindowSize,
  TierMode,
  type VersionStatus,
  versionStatus,
  tierUnitLabel,
  periodNoun,
} from '@fp/domain'
import { Badge } from '@ui/components/reui/badge'
import { Frame, FrameHeader, FramePanel, FrameTitle } from '@ui/components/reui/frame'
import { Button } from '@ui/components/primitives/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@ui/components/primitives/sheet'
import { ActivityLog, type ActivityLogEntry } from '@ui/compositions/detail/ActivityLog'
import {
  BellIcon,
  ClockIcon,
  CircleDollarSignIcon,
  PlusIcon,
  RotateCcwIcon,
  ScaleIcon,
  TicketPercentIcon,
} from '@ui/icons'
import { ConfirmDialog } from '@ui/compositions/feedback/ConfirmDialog'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { Pill } from '../../shared/cells'
import { VERSION_STATUS_TONE } from '../../shared/statusTones'

/**
 * One charge, opened from its row or from one of its flags.
 *
 * The bargain the charges table makes is that a row stays one line because
 * everything else is one click away *in a known place*. This is that place: a
 * box per part that exists: Price, Commitment, Discount, Alerts: and the
 * version history under them. Opened from a flag, it scrolls to that box and
 * rings it, so the click lands where the eye already was.
 *
 * Boxes appear only for parts that exist. A charge with a price and nothing
 * else is one box, not five empty ones, and no box explains in a paragraph
 * what its own figures already say.
 *
 * The boxes run in the same order as the flags: Price, Discount, Commitment,
 * Alerts, History: because a flag is a promise about where its click lands.
 * The prototype put Commitment second and the handoff calls that out as a
 * quirk to fix rather than copy: two orders for the same five things is one
 * order too many.
 */
/** Current is the active green, Upcoming blue, History muted grey. */
const VERSION_LABEL: Record<VersionStatus, string> = {
  current: 'Current',
  upcoming: 'Upcoming',
  history: 'History',
}

export const ChargeSheetProvenance = provenance({
  source: 'composition',
  composes: ['ui/sheet', 'reui/frame', 'reui/badge', 'compositions/ActivityLog'],
  note: 'Side sheet for one charge: price, commitment, discount, alerts and version history, opened at a section.',
})

export interface ChargeSheetProps {
  /** The charge to show. `null` closes the sheet. */
  charge: Charge | null
  /** What else is known about it; without this the sheet is the price alone. */
  detail?: ChargeDetail | undefined
  /** Which box to scroll to and ring: the flag that was clicked. */
  section?: ChargeSection | undefined
  onClose: () => void
  /** Wires each box's "Edit". A box with no handler shows no button. */
  onEdit?: ((section: ChargeSection) => void) | undefined
  locale?: string
  priceLabel?: string | undefined
  editableSections?: readonly ChargeSection[] | undefined
  /**
   * Bring back the version just before the current one. Resolves when saved;
   * rejects with an Error whose message is shown. Omitted, no revert is offered.
   */
  onRevert?: ((versionId: string) => Promise<unknown>) | undefined
  /**
   * The versions read from the history API as the sheet opened. Given, it
   * replaces `detail.versions`, and its loading and error states show in the
   * History section.
   */
  history?: ChargeHistory | undefined
}

function modelLabel(charge: Charge): string {
  if (charge.billingModel === BillingModel.Tiered) {
    return charge.tierMode === TierMode.Slab ? 'Slab tiered' : 'Volume tiered'
  }
  return BILLING_MODEL_LABEL[charge.billingModel]
}

function billedLabel(charge: Charge): string {
  const period = BILLING_PERIOD_LABEL[charge.billingPeriod as BillingPeriod] ?? charge.billingPeriod
  return `${period}, ${charge.invoiceCadence === InvoiceCadence.Advance ? 'in advance' : 'in arrears'}`
}

/** A big figure and what it is. */
function Lead({ value, label }: { value: string; label?: string | undefined }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2">
      <span className="text-xl font-medium tracking-tight tabular-nums">{value}</span>
      {label ? <span className="text-muted-foreground text-xs">{label}</span> : null}
    </p>
  )
}

/** Small labelled figures in a row under a rule. */
function Facts({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl
      className="grid gap-3 border-t pt-3"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map(([term, value]) => (
        <div key={term} className="min-w-0 space-y-0.5">
          <dt className="text-muted-foreground text-xs">{term}</dt>
          <dd className="truncate text-[13px] tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Box({
  section,
  icon,
  title,
  badge,
  onEdit,
  addLabel,
  focused,
  children,
}: {
  section: ChargeSection
  icon: ReactNode
  title: string
  badge?: string | undefined
  onEdit?: (() => void) | undefined
  /**
   * Set when the part is empty and editing it creates it: the header action
   * is then the section Add button ("Add alerts") rather than Edit.
   */
  addLabel?: string | undefined
  focused: boolean
  children: ReactNode
}) {
  // A `section` around the frame, not a bare `div`: `FrameHeader` renders a
  // `<header>`, and a `<header>` outside sectioning content is a *banner*
  // landmark: four boxes would mean four banners on one page, which axe
  // rightly refuses. Inside a named section it is the section's header.
  return (
    <section
      id={`charge-${section}`}
      tabIndex={-1}
      aria-labelledby={`charge-${section}-title`}
      className="scroll-mt-4"
    >
      <Frame spacing="sm" className={cn('transition-shadow', focused && 'ring-ring/40 ring-2')}>
        <FrameHeader className="flex-row items-center justify-between gap-3">
          <FrameTitle
            id={`charge-${section}-title`}
            className="flex items-center gap-2 font-medium [&_svg]:size-4"
          >
            {icon}
            {title}
            {badge ? (
              <Badge variant="outline" size="sm" className="font-normal">
                {badge}
              </Badge>
            ) : null}
          </FrameTitle>
          {onEdit && addLabel ? (
            <Button variant="outline" size="sm" className="h-8 px-3" onClick={onEdit}>
              <PlusIcon aria-hidden />
              {addLabel}
            </Button>
          ) : onEdit ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground -mr-1.5 h-6 px-2 text-xs"
              onClick={onEdit}
            >
              Edit
            </Button>
          ) : null}
        </FrameHeader>
        <FramePanel className="space-y-3">{children}</FramePanel>
      </Frame>
    </section>
  )
}

/**
 * The tier bands.
 *
 * `upTo` is the top of a band and `null` is the unbounded last one, so each
 * range is built from the one before rather than stored.
 */
function TierRows({ charge }: { charge: Charge }) {
  return <TierList tiers={charge.tiers} />
}

function TierList({ tiers }: { tiers: Charge['tiers'] }) {
  let floor = 0
  return (
    <ul className="divide-border/60 divide-y rounded-md border text-[13px]">
      {tiers.map((tier, index) => {
        const from = floor
        floor = tier.upTo ?? floor
        return (
          <li key={index} className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="text-muted-foreground tabular-nums">
              {from.toLocaleString()} – {tier.upTo === null ? '∞' : tier.upTo.toLocaleString()}
            </span>
            <span className="tabular-nums">
              {tier.unitAmount}
              {tier.transformQuantity?.divideBy ? ` ${tierUnitLabel(tier)}` : ''}
              {tier.flatAmount && Number(tier.flatAmount) > 0 ? ` + ${tier.flatAmount}` : ''}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The commitment, in whichever of its three states it is in.
 *
 * Per period: one figure, per the billing period or its own duration.
 * Per bucket, all day: the same figure applies to every bucket.
 * Per bucket with windows: those windows carry their own figure, and a dashed
 * row says what the rest of the day does: which is the question a reader asks
 * the moment they see a window, and the prototype answers in the same place.
 */
/** "every hour" when the charge has a bucket; otherwise the billing period ("every month"). */
const WINDOW_EVERY: Record<PriceWindowSize, string> = {
  [PriceWindowSize.Minute]: 'minute',
  [PriceWindowSize.FifteenMin]: '15 minutes',
  [PriceWindowSize.ThirtyMin]: '30 minutes',
  [PriceWindowSize.Hour]: 'hour',
  [PriceWindowSize.ThreeHour]: '3 hours',
  [PriceWindowSize.SixHour]: '6 hours',
  [PriceWindowSize.TwelveHour]: '12 hours',
  [PriceWindowSize.Day]: 'day',
}

function windowEvery(charge: Charge): string {
  if (charge.bucketSize && charge.bucketSize in WINDOW_EVERY) {
    return WINDOW_EVERY[charge.bucketSize as PriceWindowSize]
  }
  return charge.billingPeriod ? periodNoun(charge.billingPeriod) : 'period'
}

function CommitmentBody({
  commitment,
  charge,
}: {
  commitment: ChargeCommitmentDetail
  charge: Charge
}) {
  const facts: Array<[string, ReactNode]> = [
    ['Type', commitment.type === CommitmentType.Amount ? 'Amount' : 'Quantity'],
    ['Overage factor', `×${commitment.overageFactor}`],
    ['True-up', commitment.trueUp ? 'Enabled' : 'Disabled'],
  ]

  if (!commitment.windowed) {
    const period = commitment.duration ? periodNoun(commitment.duration) : 'billing period'
    return (
      <>
        <Lead value={commitment.value} label={`per ${period}`} />
        <Facts items={facts} />
      </>
    )
  }

  const every = windowEvery(charge)

  return (
    <>
      <Lead
        value={commitment.value}
        label={commitment.windows.length > 0 ? `every ${every}` : `every ${every}, all day`}
      />
      {commitment.windows.length > 0 ? (
        <ul className="space-y-2">
          {commitment.windows.map((window) => (
            <li key={window.id} className="bg-muted/40 space-y-2 rounded-md border p-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-medium tabular-nums">
                  {window.start} – {window.end} UTC
                </span>
                <span className="text-[13px] tabular-nums">
                  {window.value} every {every}
                </span>
              </div>
              {window.tiers && window.tiers.length > 0 ? <TierList tiers={window.tiers} /> : null}
            </li>
          ))}
          <li className="text-muted-foreground flex items-baseline justify-between gap-3 rounded-md border border-dashed px-3 py-2 text-xs">
            <span>Rest of the day</span>
            <span className="tabular-nums">
              {commitment.value} every {every}
              {charge.displayAmount ? ` · ${charge.displayAmount}` : ''}
            </span>
          </li>
        </ul>
      ) : null}
      <Facts items={[...facts, ['Applies', `Per ${every}`]]} />
    </>
  )
}

export function ChargeSheet({
  charge,
  detail,
  section,
  onClose,
  onEdit,
  locale,
  priceLabel,
  editableSections,
  onRevert,
  history: fetched,
}: ChargeSheetProps) {
  const body = useRef<HTMLDivElement>(null)
  const [reverting, setReverting] = useState<{ id: string; price: string; from: string } | null>(
    null,
  )
  const [revertPending, setRevertPending] = useState(false)
  const [revertError, setRevertError] = useState<string | null>(null)

  // Opened from a flag: bring that box into view once the sheet has settled.
  useEffect(() => {
    if (!charge || !section) return
    let frame = 0
    let cancelled = false
    const focusSection = () => {
      if (cancelled) return
      const target = body.current?.querySelector<HTMLElement>(`#charge-${section}`)
      if (!target && body.current) return
      if (!target) {
        frame = window.requestAnimationFrame(focusSection)
        return
      }
      target.focus({ preventScroll: true })
      target.scrollIntoView({ block: 'start', behavior: 'instant' })
    }
    frame = window.requestAnimationFrame(focusSection)
    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
    }
  }, [charge, section])

  if (!charge) {
    return <Sheet open={false} onOpenChange={() => onClose()} />
  }

  const name = charge.displayName || charge.meterName || 'Charge'
  const price = priceLabel || charge.displayAmount || charge.amount || '—'
  const dates = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const versions = [...(fetched?.versions ?? detail?.versions ?? [])].sort(
    (a, b) =>
      (b.startDate?.getTime() ?? b.updatedAt?.getTime() ?? 0) -
      (a.startDate?.getTime() ?? a.updatedAt?.getTime() ?? 0),
  )

  // Each version by its dates: the one billing now, ones scheduled to start
  // later, and ones that have ended. A future end date is still current.
  const now = Date.now()
  const statusOf = (version: (typeof versions)[number]) => versionStatus(version, now)
  // Only the version that ended last can be brought back.
  const revertible = versions.find((version) => statusOf(version) === 'history')

  const history: ActivityLogEntry[] = versions.map((version) => {
    const status = statusOf(version)
    return {
      id: version.id,
      title: version.price,
      tag: (
        <Pill tone={VERSION_STATUS_TONE[status]} size="sm">
          {VERSION_LABEL[status]}
        </Pill>
      ),
      at: version.startDate
        ? `${status === 'upcoming' ? 'Starts' : 'From'} ${dates.format(version.startDate)}`
        : '—',
      summary: [
        version.endDate
          ? `${status === 'history' ? 'Ended' : 'Ends'} ${dates.format(version.endDate)}`
          : 'No end date',
        version.updatedAt ? `Last updated ${dates.format(version.updatedAt)}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
      ...(version.actor ? { by: version.actor } : {}),
      ...(version === revertible && onRevert
        ? {
            action: (
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3"
                onClick={() => {
                  setRevertError(null)
                  setReverting({
                    id: version.id,
                    price: version.price,
                    from: version.startDate ? dates.format(version.startDate) : '',
                  })
                }}
              >
                <RotateCcwIcon aria-hidden />
                Revert to this version
              </Button>
            ),
          }
        : {}),
    }
  })

  const coupons = detail?.coupons ?? (detail?.coupon ? [detail.coupon] : [])
  const editAt = (part: ChargeSection) =>
    onEdit && (!editableSections || editableSections.includes(part))
      ? () => onEdit(part)
      : undefined

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
      >
        <SheetHeader className="border-b">
          <SheetTitle>{name}</SheetTitle>
          <SheetDescription>
            {charge.type === PriceType.Usage ? 'Usage' : 'Fixed'} · {modelLabel(charge)} ·{' '}
            {billedLabel(charge)}
          </SheetDescription>
        </SheetHeader>

        {/*
          `tabIndex` because this scrolls: a region a mouse can scroll and a
          keyboard cannot is unreachable for anyone not using a pointer, and
          the boxes below the fold are most of the sheet.
        */}
        <div ref={body} tabIndex={0} className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
          <Box
            section={ChargeSection.Price}
            icon={<CircleDollarSignIcon aria-hidden className="text-info-foreground" />}
            title="Price"
            badge={detail?.overridden || detail?.overriddenFrom ? 'Changed here' : undefined}
            onEdit={editAt(ChargeSection.Price)}
            focused={section === ChargeSection.Price}
          >
            <Lead value={price} label={detail?.quantity ? `× ${detail.quantity}` : undefined} />
            {/* Grey, under, no strikethrough: the old price is context, not a correction. */}
            {detail?.overriddenFrom ? (
              <p className="text-muted-foreground text-xs">Plan price {detail.overriddenFrom}</p>
            ) : null}
            {charge.tiers.length > 0 ? <TierRows charge={charge} /> : null}
            <Facts
              items={[
                ['Model', modelLabel(charge)],
                ['Billed', billedLabel(charge)],
                ...(charge.bucketSize
                  ? ([['Bucket', charge.bucketSize]] as Array<[string, ReactNode]>)
                  : []),
              ]}
            />
          </Box>

          {coupons.length > 0 ? (
            <Box
              section={ChargeSection.Discount}
              icon={<TicketPercentIcon aria-hidden className="text-success-foreground" />}
              title="Discount"
              onEdit={editAt(ChargeSection.Discount)}
              focused={section === ChargeSection.Discount}
            >
              {coupons.map((coupon, index) => (
                <div key={`${coupon.code}-${index}`} className="space-y-3">
                  <Lead value={coupon.discount} label={coupon.name} />
                  <Facts
                    items={[
                      ['Code', <span className="font-mono text-xs">{coupon.code}</span>],
                      ['Ends', coupon.endsAt ? dates.format(coupon.endsAt) : 'Never'],
                    ]}
                  />
                </div>
              ))}
            </Box>
          ) : null}

          {detail?.commitment ? (
            <Box
              section={ChargeSection.Commitment}
              icon={<ScaleIcon aria-hidden className="text-primary" />}
              title="Commitment"
              onEdit={editAt(ChargeSection.Commitment)}
              focused={section === ChargeSection.Commitment}
            >
              <CommitmentBody commitment={detail.commitment} charge={charge} />
            </Box>
          ) : null}

          {/* Shown empty only where alerts can be added from here. */}
          {(detail?.alerts && detail.alerts.length > 0) || editAt(ChargeSection.Alerts) ? (
            <Box
              section={ChargeSection.Alerts}
              icon={<BellIcon aria-hidden className="text-warning-foreground" />}
              title="Alerts"
              onEdit={editAt(ChargeSection.Alerts)}
              {...(detail?.alerts?.length ? {} : { addLabel: 'Add alerts' })}
              focused={section === ChargeSection.Alerts}
            >
              {detail?.alerts?.length ? (
                <Facts
                  items={detail.alerts.map((alert) => [
                    `${alert.level}, ${alert.condition ?? 'above'}`,
                    alert.value,
                  ])}
                />
              ) : (
                <p className="text-muted-foreground text-sm">
                  No alerts on this charge. Add thresholds to be told when its usage crosses them.
                </p>
              )}
            </Box>
          ) : null}

          {fetched?.isLoading && history.length <= 1 ? (
            <p role="status" className="text-muted-foreground flex items-center gap-2 pt-2 text-xs">
              <ClockIcon aria-hidden className="size-3.5" />
              Loading history…
            </p>
          ) : fetched?.error ? (
            <div
              role="alert"
              className="text-muted-foreground flex flex-wrap items-center gap-2 pt-2 text-xs"
            >
              <ClockIcon aria-hidden className="size-3.5" />
              {fetched.error}
              {fetched.onRetry ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5"
                  onClick={fetched.onRetry}
                >
                  <RotateCcwIcon aria-hidden />
                  Try again
                </Button>
              ) : null}
            </div>
          ) : null}

          {history.length > 1 ? (
            <section
              id={`charge-${ChargeSection.History}`}
              tabIndex={-1}
              aria-label="History"
              className="scroll-mt-4 space-y-4 pt-2"
            >
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <ClockIcon aria-hidden className="text-muted-foreground size-4" />
                History
                <span className="text-muted-foreground text-xs font-normal tabular-nums">
                  {history.length} versions
                </span>
              </h3>
              <ActivityLog entries={history} />
            </section>
          ) : null}
        </div>
      </SheetContent>
      <ConfirmDialog
        open={reverting !== null}
        onOpenChange={(open) => (open ? undefined : setReverting(null))}
        title={
          reverting?.from
            ? `Revert to the version from ${reverting.from}?`
            : 'Revert to the earlier version?'
        }
        description={`${name} goes back to ${reverting?.price ?? 'its previous price'}, as a new version starting now. The current price is kept in the history as inactive, and invoices already issued keep the price they were billed at.`}
        confirmLabel="Revert"
        isPending={revertPending}
        error={revertError}
        onConfirm={() => {
          if (!reverting || !onRevert) return
          setRevertPending(true)
          onRevert(reverting.id)
            .then(() => {
              setReverting(null)
              onClose()
            })
            .catch((caught: unknown) =>
              setRevertError(
                caught instanceof Error && caught.message
                  ? caught.message
                  : 'The price could not be reverted. Try again.',
              ),
            )
            .finally(() => setRevertPending(false))
        }}
      />
    </Sheet>
  )
}
