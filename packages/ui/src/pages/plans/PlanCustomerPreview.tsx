import type { ReactNode } from 'react'
import {
  BILLING_PERIOD_SHORT,
  BillingModel,
  type BillingPeriod,
  type Charge,
  type CreditGrant,
  CreditGrantCadence,
  type Entitlement,
  FeatureType,
  PriceType,
  USAGE_RESET_PERIOD_LABEL,
  chargeToDraft,
} from '@fp/domain'
import { Card, CardContent, CardHeader, CardTitle } from '@ui/components/primitives/card'
import { chargeLabel, money, pricingSummary } from './PlanPreviewCard'

export interface PlanCustomerPreviewProps {
  name: string
  charges: Charge[]
  entitlements: Entitlement[]
  grants: CreditGrant[]
}

const MAX_LINES = 3

function Group({ title, lines }: { title: string; lines: { key: string; left: ReactNode; right?: ReactNode }[] }) {
  if (lines.length === 0) return null
  const shown = lines.slice(0, MAX_LINES)
  const extra = lines.length - shown.length
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      {shown.map((line) => (
        <div key={line.key} className="flex items-baseline justify-between gap-3 text-sm">
          <span className="min-w-0 truncate">{line.left}</span>
          {line.right ? (
            <span className="shrink-0 text-left text-muted-foreground tabular-nums">{line.right}</span>
          ) : null}
        </div>
      ))}
      {extra > 0 ? <span className="text-xs text-muted-foreground">and {extra} more</span> : null}
    </div>
  )
}

function entitlementLine(e: Entitlement): string {
  const name = e.featureName ?? e.featureId
  switch (e.featureType) {
    case FeatureType.Metered: {
      if (e.usageLimit == null) return `Unlimited ${name}`
      const reset = e.usageResetPeriod ? ` / ${USAGE_RESET_PERIOD_LABEL[e.usageResetPeriod].toLowerCase()}` : ''
      return `${e.usageLimit.toLocaleString()} ${name}${reset}`
    }
    case FeatureType.Static:
      return `${name}: ${e.staticValue ?? '—'}`
    default:
      return name
  }
}

/** "What customers see": the plan as a customer reads it, each section capped at three lines. */
export function PlanCustomerPreview({ name, charges, entitlements, grants }: PlanCustomerPreviewProps) {
  const meterName = (id: string) => charges.find((c) => c.meterId === id)?.meterName ?? id
  const currency = (charges.find((c) => c.currency)?.currency ?? 'USD').toUpperCase()
  const fixed = charges.filter((c) => c.type === PriceType.Fixed)
  const usage = charges.filter((c) => c.type === PriceType.Usage)
  const headline =
    fixed.find((c) => c.billingModel === BillingModel.FlatFee) ?? fixed[0] ?? null
  const alsoBilled = fixed.filter((c) => c !== headline)

  const charged = (c: Charge) => {
    const draft = chargeToDraft(c)
    return {
      key: c.id,
      left: chargeLabel(draft, meterName),
      right: pricingSummary(draft, currency),
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="truncate font-medium">What customers see</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="truncate text-sm text-muted-foreground">{name || 'Untitled plan'}</span>
          {headline ? (
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-medium tabular-nums">
                {headline.billingModel === BillingModel.FlatFee
                  ? money(Number(headline.amount || 0), currency)
                  : pricingSummary(chargeToDraft(headline), currency)}
              </span>
              <span className="text-sm text-muted-foreground">
                {BILLING_PERIOD_SHORT[headline.billingPeriod as BillingPeriod]
                  ? `/${BILLING_PERIOD_SHORT[headline.billingPeriod as BillingPeriod]}`
                  : ''}
              </span>
            </div>
          ) : (
            <span className="text-2xl font-medium text-muted-foreground">
              {usage.length > 0 ? 'Usage-based' : '—'}
            </span>
          )}
        </div>
        <Group title="Also billed" lines={alsoBilled.map(charged)} />
        <Group title="Usage" lines={usage.map(charged)} />
        <Group
          title="Included"
          lines={entitlements.map((e) => ({ key: e.id, left: entitlementLine(e) }))}
        />
        <Group
          title="Credits"
          lines={grants.map((g) => ({
            key: g.id,
            left: g.name,
            right: `${Number(g.credits).toLocaleString()}${
              g.cadence === CreditGrantCadence.Recurring ? ' recurring' : ''
            }`,
          }))}
        />
      </CardContent>
    </Card>
  )
}
