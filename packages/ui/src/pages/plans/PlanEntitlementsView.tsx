import { GaugeIcon, PlusIcon, SlidersHorizontalIcon, ToggleRightIcon, TypeIcon } from 'lucide-react'
import { EntityLink } from '../shared/cells'
import { type Entitlement, FeatureType, USAGE_RESET_PERIOD_LABEL } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ui/components/primitives/table'
import { RowActionsMenu } from '../shared/RowActionsMenu'
import { PlanTabCard } from './PlanTabCard'

export interface PlanEntitlementsViewProps {
  entitlements: Entitlement[]
  /** The plan's usage price for this entitlement's feature, or null when it has none. */
  usagePrice: (entitlement: Entitlement) => string | null
  onAdd: () => void
  onEdit: (entitlement: Entitlement) => void
  onDelete: (entitlement: Entitlement) => void
  onOpenFeature?: (featureId: string) => void
}

const TYPE_LABEL: Record<FeatureType, string> = {
  [FeatureType.Metered]: 'Metered',
  [FeatureType.Boolean]: 'Boolean',
  [FeatureType.Static]: 'Static',
  [FeatureType.Config]: 'Config',
}

function valueOf(e: Entitlement): string {
  switch (e.featureType) {
    case FeatureType.Metered:
      return e.usageLimit == null ? 'Unlimited' : e.usageLimit.toLocaleString()
    case FeatureType.Boolean:
      return e.isEnabled ? 'Yes' : 'No'
    case FeatureType.Static:
      return e.staticValue ?? '—'
    case FeatureType.Config:
      return 'Configured'
  }
}

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

const TYPE_ICON: Record<FeatureType, typeof GaugeIcon> = {
  [FeatureType.Metered]: GaugeIcon,
  [FeatureType.Boolean]: ToggleRightIcon,
  [FeatureType.Static]: TypeIcon,
  [FeatureType.Config]: SlidersHorizontalIcon,
}

function includedOf(e: Entitlement): string {
  if (e.featureType === FeatureType.Metered && e.usageLimit != null) {
    return compact.format(e.usageLimit)
  }
  return valueOf(e)
}

/** Entitlements card; the last column shows what happens past the value. */
export function PlanEntitlementsView({
  entitlements,
  usagePrice,
  onAdd,
  onEdit,
  onDelete,
  onOpenFeature,
}: PlanEntitlementsViewProps) {
  const add = (
    <Button type="button" size="sm" onClick={onAdd}>
      <PlusIcon aria-hidden className="size-4" />
      Add entitlement
    </Button>
  )
  return (
    <PlanTabCard
      title="Entitlements"
      description="What subscribers get: feature access and included allowances"
      action={entitlements.length > 0 ? add : undefined}
    >
      {entitlements.length === 0 ? (
        <div className="flex flex-col items-center gap-3 border-t px-6 py-12 text-center">
          <p className="text-muted-foreground text-sm">
            No entitlements yet. Add the features this plan includes.
          </p>
          {add}
        </div>
      ) : (
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="px-6 text-xs tracking-wide uppercase">Feature</TableHead>
              <TableHead className="text-xs tracking-wide uppercase">Type</TableHead>
              <TableHead className="text-xs tracking-wide uppercase">Included</TableHead>
              <TableHead className="text-xs tracking-wide uppercase">Usage resets</TableHead>
              <TableHead className="text-xs tracking-wide uppercase">
                Usage beyond the value
              </TableHead>
              <TableHead className="w-12 pr-6">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entitlements.map((e) => {
              const price =
                e.featureType === FeatureType.Metered && e.usageLimit != null ? usagePrice(e) : null
              const Icon = TYPE_ICON[e.featureType]
              const label = e.featureName ?? e.featureId
              return (
                <TableRow key={e.id} className="h-14">
                  <TableCell className="px-6">
                    <span className="flex items-center gap-2.5">
                      <Icon aria-hidden className="text-muted-foreground size-4" />
                      {onOpenFeature ? (
                        <EntityLink label={label} onOpen={() => onOpenFeature(e.featureId)} />
                      ) : (
                        label
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {TYPE_LABEL[e.featureType]}
                  </TableCell>
                  <TableCell className="tabular-nums">{includedOf(e)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.featureType !== FeatureType.Metered
                      ? '—'
                      : e.usageResetPeriod
                        ? USAGE_RESET_PERIOD_LABEL[e.usageResetPeriod]
                        : 'Every billing period'}
                  </TableCell>
                  <TableCell className="text-[13px]">
                    {e.featureType !== FeatureType.Metered || e.usageLimit == null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : price ? (
                      <>
                        Billed <span className="text-muted-foreground">{price}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">No usage price on this plan</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-6">
                    <RowActionsMenu
                      label={e.featureName ?? 'entitlement'}
                      onEdit={() => onEdit(e)}
                      onRemove={() => onDelete(e)}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </PlanTabCard>
  )
}
