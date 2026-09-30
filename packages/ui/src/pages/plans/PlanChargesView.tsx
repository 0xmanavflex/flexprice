import { PlusIcon } from 'lucide-react'
import {
  BILLING_PERIOD_LABEL,
  type BillingPeriod,
  BillingModel,
  type Charge,
  PriceType,
  chargeToDraft,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { cn } from '@ui/lib/cn'
import { EmptyState } from '../../compositions/EmptyState'
import { RowActionsMenu } from '../shared/RowActionsMenu'
import { chargeLabel, pricingSummary } from './PlanPreviewCard'

export interface PlanChargesViewProps {
  charges: Charge[]
  onAdd: () => void
  onEdit: (charge: Charge) => void
  onTerminate: (charge: Charge) => void
  readOnly?: boolean
}

const GROUPS = [
  {
    type: PriceType.Fixed,
    title: 'Fixed charges',
    note: 'Billed at the start of each period',
    band: 'bg-sky-50 dark:bg-sky-950/30',
    rail: 'border-l-sky-500',
    dot: 'bg-sky-500',
  },
  {
    type: PriceType.Usage,
    title: 'Usage charges',
    note: 'Billed at the end of the period',
    band: 'bg-violet-50 dark:bg-violet-950/30',
    rail: 'border-l-violet-500',
    dot: 'bg-violet-500',
  },
] as const

/** A plan's charges, grouped and colour-coded by when they bill. */
export function PlanChargesView({ charges, onAdd, onEdit, onTerminate, readOnly }: PlanChargesViewProps) {
  const meterName = (id: string) => charges.find((c) => c.meterId === id)?.meterName ?? id

  if (charges.length === 0) {
    return (
      <EmptyState
        title="No charges yet"
        description="Nothing is billed until there is a charge. Add a fixed fee or a usage charge to price this plan."
        action={
          readOnly ? undefined : (
            <Button type="button" onClick={onAdd}>
              Add charge
            </Button>
          )
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {readOnly ? null : (
        <div className="flex justify-end">
          <Button type="button" onClick={onAdd}>
            <PlusIcon aria-hidden className="size-4" />
            Add charge
          </Button>
        </div>
      )}
      {GROUPS.map((group) => {
        const rows = charges.filter((c) => c.type === group.type)
        if (rows.length === 0) return null
        return (
          <section
            key={group.type}
            aria-label={group.title}
            className={cn('overflow-hidden rounded-lg border border-l-4', group.rail)}
          >
            <header className={cn('flex items-center gap-2 px-4 py-2.5 text-sm', group.band)}>
              <span aria-hidden className={cn('size-2 rounded-full', group.dot)} />
              <span className="font-medium">{group.title}</span>
              <span className="text-muted-foreground">{group.note}</span>
            </header>
            <ul className="divide-y">
              {rows.map((charge) => {
                const draft = chargeToDraft(charge)
                const currency = (charge.currency || 'usd').toUpperCase()
                return (
                  <li key={charge.id} className="flex items-center gap-4 px-4 py-3 text-sm">
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {chargeLabel(draft, meterName)}
                    </span>
                    <span className="hidden w-32 text-muted-foreground sm:block">
                      {BILLING_PERIOD_LABEL[charge.billingPeriod as BillingPeriod] ??
                        charge.billingPeriod}
                    </span>
                    <span className="w-44 text-left tabular-nums">
                      {charge.displayAmount && charge.billingModel === BillingModel.FlatFee
                        ? charge.displayAmount
                        : pricingSummary(draft, currency)}
                    </span>
                    {readOnly ? null : (
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
          </section>
        )
      })}
    </div>
  )
}
