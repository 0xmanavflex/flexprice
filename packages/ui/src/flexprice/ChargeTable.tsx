import {
  BILLING_PERIOD_LABEL,
  BillingModel,
  type BillingPeriod,
  type Charge,
  InvoiceCadence,
  PriceType,
} from '@fp/domain'
import { Badge } from '@ui/components/reui/badge'
import { Button } from '@ui/primitives/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ui/primitives/table'
import { GaugeIcon, RepeatIcon, Trash2Icon } from 'lucide-react'
import { EmptyState } from '@ui/compositions/EmptyState'
import { provenance } from '@ui/provenance'

/**
 * A plan's charges, as a read table.
 *
 * The Overview tab's list: what the plan bills, at a glance. Charge type and
 * timing read together the way V1's price table shows them — a fixed charge as
 * "Recurring · Advance/Arrears", a usage charge as "Usage-based" — because the
 * two facts a person scans for are *is it recurring* and *when is it billed*.
 *
 * Presentational: it takes `Charge[]` and reports intent. Adding and terminating
 * are the page's to wire, so this can render in a story without a network.
 */
export const ChargeTableProvenance = provenance({
  source: 'composition',
  composes: ['ui/table', '@reui/badge', 'ui/button'],
  note: 'Read-only charges table for the plan Overview tab.',
})

export interface ChargeTableProps {
  charges: Charge[]
  onAdd?: () => void
  onTerminate?: (charge: Charge) => void
  locale?: string
}

/** The "value" a charge bills, summarised for the table. */
function valueOf(charge: Charge): string {
  const display = charge.displayAmount || charge.amount
  switch (charge.billingModel) {
    case BillingModel.FlatFee:
      return display || '—'
    case BillingModel.Package:
      return `${display || '0'} per ${charge.transformQuantity?.divideBy?.toLocaleString() ?? '?'}`
    case BillingModel.Tiered:
      return `${charge.tiers.length} tier${charge.tiers.length === 1 ? '' : 's'} · ${
        charge.tierMode === 'SLAB' ? 'Slab' : 'Volume'
      }`
  }
}

export function ChargeTable({ charges, onAdd, onTerminate }: ChargeTableProps) {
  if (charges.length === 0) {
    return (
      <EmptyState
        title="No charges yet"
        description="A plan bills nothing until it has a charge. Add a fixed base or a usage charge to price it."
        {...(onAdd
          ? {
              action: (
                <Button type="button" onClick={onAdd}>
                  Add charges
                </Button>
              ),
            }
          : {})}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {onAdd ? (
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={onAdd}>
            Add charges
          </Button>
        </div>
      ) : null}
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Charge</TableHead>
              <TableHead>Type &amp; timing</TableHead>
              <TableHead>Billing period</TableHead>
              <TableHead>Value</TableHead>
              {onTerminate ? (
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {charges.map((charge) => (
              <TableRow key={charge.id}>
                <TableCell className="font-medium">
                  {charge.displayName || charge.meterName || 'Charge'}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {charge.type === PriceType.Usage ? (
                      <Badge variant="secondary">
                        <GaugeIcon aria-hidden className="size-3" />
                        Usage-based
                      </Badge>
                    ) : (
                      <>
                        <Badge variant="secondary">
                          <RepeatIcon aria-hidden className="size-3" />
                          Recurring
                        </Badge>
                        <Badge variant="outline">
                          {charge.invoiceCadence === InvoiceCadence.Advance ? 'Advance' : 'Arrears'}
                        </Badge>
                      </>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {BILLING_PERIOD_LABEL[charge.billingPeriod as BillingPeriod] ?? charge.billingPeriod}
                </TableCell>
                <TableCell className="tabular-nums">{valueOf(charge)}</TableCell>
                {onTerminate ? (
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Terminate ${charge.displayName || 'charge'}`}
                      onClick={() => onTerminate(charge)}
                    >
                      <Trash2Icon aria-hidden className="size-4" />
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
