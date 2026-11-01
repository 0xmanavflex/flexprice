import { useState, type ReactNode } from 'react'
import { FeatureType } from '@fp/domain'
import {
  CoinsIcon,
  GaugeIcon,
  MailIcon,
  MessageSquareTextIcon,
  SmartphoneIcon,
  SparklesIcon,
  ZapIcon,
} from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * A plan as a pricing page shows it: V1's pricing card (flexprice-front
 * `PricingCard`, modern chrome), shared by the pricing widget and the plan
 * preview so the two read the same.
 *
 * Name, the fee and its period, then what the plan includes and the credits
 * it grants, each line led by an icon picked from the feature as V1 picks it.
 * The widget adds "View plan" and shows three lines a section with "+N more";
 * a preview (`preview`) also lists the usage charges, shows every line and
 * has no button.
 */
export const PricingPlanCardProvenance = provenance({
  source: 'composition',
  composes: ['ui/button'],
  note: 'V1 PricingCard (modern chrome): name, price per period, View plan, Included, Credits.',
})

export interface PricingPlanIncluded {
  key: string
  /** The whole line: "10,000 AI message". */
  label: ReactNode
  featureType: FeatureType
  /** The feature's name, which picks the icon as V1 does. */
  featureName: string
}

export interface PricingPlanCredit {
  key: string
  /** "100 credits". */
  amount: string
  /** The grant's name, or null when it only repeats the cadence. */
  name: string | null
  /** "one-time", or the period it recurs on: "monthly". */
  cadence: string
  recurring: boolean
}

export interface PricingPlanUsage {
  key: string
  name: string
  /** "$0.01/unit", "from $0.002/unit". */
  price: string
}

export interface PricingPlanCardProps {
  name: string
  /** "$29", "$0". */
  price: string
  /** "month", "year". Omitted for a plan with no period. */
  per?: string | null | undefined
  /** Usage bills on top of the fee: a preview says "+ Usage" after the period. */
  hasUsage?: boolean
  usage?: PricingPlanUsage[]
  /** One-time fees, listed in a preview: never part of the price per period. */
  oneTime?: PricingPlanUsage[]
  included: PricingPlanIncluded[]
  credits: PricingPlanCredit[]
  /** The widget's button. Left out of a preview. */
  onViewPlan?: (() => void) | undefined
  /** The plan preview: usage lines, every line, no button. */
  preview?: boolean
  /**
   * Makes the section headings links, for a preview that sits beside the
   * tables it summarises: a heading goes to its table.
   */
  sectionHref?: ((section: PricingPlanSection) => string) | undefined
  /** Called as a heading link is followed, for a page that scrolls itself. */
  onSection?: ((section: PricingPlanSection) => void) | undefined
  /** The name's heading level, to follow the page's outline. */
  as?: 'h2' | 'h3'
  className?: string
}

export type PricingPlanSection = 'price' | 'usage' | 'oneTime' | 'included' | 'credits'

type Icon = typeof GaugeIcon

/** V1's `getEntitlementVisual`: a metered feature by what it counts, anything else a spark. */
export function includedIcon(featureType: FeatureType, name: string): { Icon: Icon; tone: string } {
  const n = name.toLowerCase()
  if (featureType === FeatureType.Metered) {
    if (n.includes('email') || n.includes('mail')) return { Icon: MailIcon, tone: 'text-info' }
    if (n.includes('sms') || n.includes('chat') || n.includes('message'))
      return { Icon: MessageSquareTextIcon, tone: 'text-trial' }
    if (n.includes('phone') || n.includes('call') || n.includes('minute'))
      return { Icon: SmartphoneIcon, tone: 'text-success' }
    if (n.includes('api') || n.includes('request') || n.includes('agent'))
      return { Icon: ZapIcon, tone: 'text-warning' }
    return { Icon: GaugeIcon, tone: 'text-trial' }
  }
  return { Icon: SparklesIcon, tone: 'text-success' }
}

const LIMIT = 3

const HEADING = 'text-muted-foreground mb-2.5 text-[10px] font-medium tracking-wide uppercase'

function Heading({
  children,
  href,
  onClick,
}: {
  children: ReactNode
  href?: string
  onClick?: () => void
}) {
  return href ? (
    <a
      href={href}
      onClick={
        onClick
          ? (event) => {
              event.preventDefault()
              onClick()
            }
          : undefined
      }
      className={cn(HEADING, 'hover:text-foreground block w-fit transition-colors')}
    >
      {children}
    </a>
  ) : (
    <p className={HEADING}>{children}</p>
  )
}

/** "+N more" and "Show less", for a widget card's capped list. */
function useCapped<T>(items: readonly T[], all: boolean) {
  const [open, setOpen] = useState(false)
  const shown = all || open ? items : items.slice(0, LIMIT)
  const hidden = all ? 0 : items.length - LIMIT
  const toggle =
    hidden > 0 ? (
      <li>
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => setOpen((value) => !value)}
          className="text-muted-foreground hover:text-foreground h-auto p-0 text-xs font-normal"
        >
          {open ? 'Show less' : `+${hidden} more`}
        </Button>
      </li>
    ) : null
  return { shown, toggle }
}

export function PricingPlanCard({
  name,
  price,
  per,
  hasUsage = false,
  usage = [],
  oneTime = [],
  included,
  credits,
  onViewPlan,
  preview = false,
  sectionHref,
  onSection,
  as: Title = 'h2',
  className,
}: PricingPlanCardProps) {
  const jump = (section: PricingPlanSection): { href?: string; onClick?: () => void } =>
    sectionHref
      ? {
          href: sectionHref(section),
          ...(onSection ? { onClick: () => onSection(section) } : {}),
        }
      : {}
  const charges = useCapped(usage, preview)
  const fees = useCapped(oneTime, preview)
  const lines = useCapped(included, preview)
  const grants = useCapped(credits, preview)

  return (
    <article
      aria-label={name}
      className={cn(
        'from-card to-muted/40 rounded-2xl border bg-linear-to-b p-5 shadow-xs',
        className,
      )}
    >
      <Title className="text-lg font-light">{name}</Title>

      <div className="mt-5 space-y-3">
        {(() => {
          const body = (
            <>
              <span className="text-[28px] font-normal tabular-nums">{price}</span>
              {per ? (
                <span className="text-muted-foreground ms-2 text-xs">
                  /{per}
                  {preview && hasUsage ? (
                    <span className="text-trial ms-1 text-[11px] font-medium">+ Usage</span>
                  ) : null}
                </span>
              ) : null}
            </>
          )
          // Beside the tables it summarises, the price goes to Charges.
          const link = jump('price')
          return link.href ? (
            <a
              href={link.href}
              onClick={
                link.onClick
                  ? (event) => {
                      event.preventDefault()
                      link.onClick?.()
                    }
                  : undefined
              }
              className="flex w-fit items-baseline"
            >
              {body}
            </a>
          ) : (
            <p className="flex items-baseline">{body}</p>
          )
        })()}

        {preview && usage.length > 0 ? (
          <div className="border-t pt-3.5">
            <Heading {...jump('usage')}>Usage</Heading>
            <ul className="space-y-2">
              {charges.shown.map((charge) => (
                <li
                  key={charge.key}
                  className="flex items-start justify-between gap-2 text-[11px] leading-snug"
                >
                  <span className="text-muted-foreground min-w-0 flex-1">{charge.name}</span>
                  <span className="shrink-0 font-medium whitespace-nowrap tabular-nums">
                    {charge.price}
                  </span>
                </li>
              ))}
              {charges.toggle}
            </ul>
          </div>
        ) : null}
        {preview && oneTime.length > 0 ? (
          <div className="border-t pt-3.5">
            <Heading {...jump('oneTime')}>One-time</Heading>
            <ul className="space-y-2">
              {fees.shown.map((charge) => (
                <li
                  key={charge.key}
                  className="flex items-start justify-between gap-2 text-[11px] leading-snug"
                >
                  <span className="text-muted-foreground min-w-0 flex-1">{charge.name}</span>
                  <span className="shrink-0 font-medium whitespace-nowrap tabular-nums">
                    {charge.price}
                  </span>
                </li>
              ))}
              {fees.toggle}
            </ul>
          </div>
        ) : null}
      </div>

      {onViewPlan && !preview ? (
        <Button type="button" variant="outline" className="mt-5 w-full" onClick={onViewPlan}>
          View plan
        </Button>
      ) : null}

      {included.length > 0 || credits.length > 0 ? (
        <div className="mt-4 border-t pt-4">
          {included.length > 0 ? (
            <>
              <Heading {...jump('included')}>Included</Heading>
              <ul className="space-y-2.5" aria-label={`Included in ${name}`}>
                {lines.shown.map((line) => {
                  const { Icon, tone } = includedIcon(line.featureType, line.featureName)
                  return (
                    <li key={line.key} className="flex items-center gap-2">
                      <Icon aria-hidden className={cn('size-3.5 shrink-0', tone)} />
                      <span className="text-muted-foreground min-w-0 flex-1 text-[11px] leading-snug">
                        {line.label}
                      </span>
                    </li>
                  )
                })}
                {lines.toggle}
              </ul>
            </>
          ) : null}

          {credits.length > 0 ? (
            <div className={cn(included.length > 0 && 'mt-3 border-t pt-3')}>
              <Heading {...jump('credits')}>Credits</Heading>
              <ul className="space-y-2.5" aria-label={`Credits in ${name}`}>
                {grants.shown.map((grant) => (
                  <li key={grant.key} className="flex items-center gap-2">
                    <CoinsIcon aria-hidden className="text-muted-foreground size-3.5 shrink-0" />
                    <span className="text-muted-foreground min-w-0 flex-1 text-[11px] leading-snug">
                      <span className="text-foreground font-medium">{grant.amount}</span>
                      {grant.name ? <span> · {grant.name}</span> : null}
                      {grant.recurring && grant.cadence !== 'recurring' ? (
                        <span> /{grant.cadence}</span>
                      ) : (
                        <span> · {grant.cadence}</span>
                      )}
                    </span>
                  </li>
                ))}
                {grants.toggle}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
