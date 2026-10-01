import { GaugeIcon, PlusIcon, RepeatIcon } from 'lucide-react'
import {
  BILLING_PERIOD_LABEL,
  type BillingPeriod,
  BILLING_MODEL_LABEL,
  BillingModel,
  type Charge,
  InvoiceCadence,
  PriceType,
  TierMode,
  chargeToDraft,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { cn } from '@ui/lib/cn'
import { RowActionsMenu } from '../shared/RowActionsMenu'
import { PlanTabCard } from './PlanTabCard'
import { chargeLabel, pricingSummary } from './PlanPreviewCard'

export interface PlanChargesViewProps {
  charges: Charge[]
  onAdd: () => void
  onEdit: (charge: Charge) => void
  onTerminate: (charge: Charge) => void
  readOnly?: boolean
  /** Singular unit of a meter ("call"), for "per call" wording. */
  meterUnit?: (meterId: string) => string | undefined
}

const GROUPS = [
  {
    type: PriceType.Fixed,
    title: 'Fixed charges',
    note: 'Billed at the start of each period',
    icon: RepeatIcon,
    band: 'bg-sky-50 dark:bg-sky-950/30',
    iconTile: 'bg-sky-100 text-sky-600 dark:bg-sky-900/50 dark:text-sky-300',
    rail: 'border-l-sky-300 dark:border-l-sky-700',
  },
  {
    type: PriceType.Usage,
    title: 'Usage charges',
    note: 'Billed at the end of the period the usage happened in',
    icon: GaugeIcon,
    band: 'bg-violet-50 dark:bg-violet-950/30',
    iconTile: 'bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-300',
    rail: 'border-l-violet-300 dark:border-l-violet-700',
  },
] as const

/** "Flat fee", "Volume tiered", "Slab tiered", "Package". */
function modelLabel(charge: Charge): string {
  if (charge.billingModel === BillingModel.Tiered) {
    return charge.tierMode === TierMode.Slab ? 'Slab tiered' : 'Volume tiered'
  }
  return BILLING_MODEL_LABEL[charge.billingModel]
}

/** "Monthly, in advance" / "Monthly, in arrears". */
function cadenceLabel(charge: Charge): string {
  const period = BILLING_PERIOD_LABEL[charge.billingPeriod as BillingPeriod] ?? charge.billingPeriod
  return `${period}, ${charge.invoiceCadence === InvoiceCadence.Advance ? 'in advance' : 'in arrears'}`
}

/** A plan's charges, grouped and colour-coded by when they bill. */
export function PlanChargesView({
  charges,
  onAdd,
  onEdit,
  onTerminate,
  readOnly,
  meterUnit,
}: PlanChargesViewProps) {
  const meterName = (id: string) => charges.find((c) => c.meterId === id)?.meterName ?? id

  return (
    <PlanTabCard
      title="Charges"
      description="What this plan bills, and when"
      action={
        readOnly || charges.length === 0 ? undefined : (
          <Button type="button" size="sm" onClick={onAdd}>
            <PlusIcon aria-hidden className="size-4" />
            Add charge
          </Button>
        )
      }
    >
      {charges.length === 0 ? (
        <div className="flex flex-col items-center gap-3 border-t px-6 py-12 text-center">
          <p className="text-muted-foreground max-w-sm text-sm">
            Nothing is billed until there is a charge. Add a fixed fee or a usage charge to price
            this plan.
          </p>
          {readOnly ? null : (
            <Button type="button" size="sm" onClick={onAdd}>
              <PlusIcon aria-hidden className="size-4" />
              Add charge
            </Button>
          )}
        </div>
      ) : (
        GROUPS.map((group) => {
          const rows = charges.filter((c) => c.type === group.type)
          if (rows.length === 0) return null
          const Icon = group.icon
          return (
            <div key={group.type} role="group" aria-label={group.title}>
              <header
                className={cn('flex items-center gap-3 border-t px-6 py-2.5 text-sm', group.band)}
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex size-6 items-center justify-center rounded-md',
                    group.iconTile,
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                <span className="font-medium">{group.title}</span>
                <span className="text-muted-foreground">{rows.length}</span>
                <span className="text-muted-foreground ml-auto text-xs">{group.note}</span>
              </header>
              <ul className="divide-y border-t">
                {rows.map((charge) => {
                  const draft = chargeToDraft(charge)
                  const currency = (charge.currency || 'usd').toUpperCase()
                  return (
                    <li
                      key={charge.id}
                      className={cn(
                        'flex items-center gap-4 border-l-2 px-6 py-4 text-sm',
                        group.rail,
                      )}
                    >
                      <span className="min-w-0 flex-1 basis-1/4 truncate">
                        {chargeLabel(draft, meterName)}
                      </span>
                      <span className="text-muted-foreground hidden flex-1 basis-1/5 sm:block">
                        {modelLabel(charge)}
                      </span>
                      <span className="text-muted-foreground hidden flex-1 basis-1/5 md:block">
                        {cadenceLabel(charge)}
                      </span>
                      <span className="flex-1 basis-1/4 text-left tabular-nums">
                        {charge.displayAmount && charge.billingModel === BillingModel.FlatFee
                          ? charge.displayAmount
                          : pricingSummary(
                              draft,
                              currency,
                              undefined,
                              charge.meterId ? meterUnit?.(charge.meterId) : undefined,
                            )}
                      </span>
                      {readOnly ? (
                        <span className="w-9" />
                      ) : (
                        <RowActionsMenu
                          label={charge.displayName || charge.meterName || 'charge'}
                          onEdit={() => onEdit(charge)}
                          onRemove={() => onTerminate(charge)}
                          removeLabel="Terminate"
                        />
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })
      )}
    </PlanTabCard>
  )
}
