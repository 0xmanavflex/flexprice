import { PlusIcon } from 'lucide-react'
import { type Entitlement, FeatureType, USAGE_RESET_PERIOD_LABEL } from '@fp/domain'
import { Badge } from '@ui/components/reui/badge'
import { Button } from '@ui/components/primitives/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ui/components/primitives/table'
import { EmptyState } from '../../compositions/EmptyState'
import { RowActionsMenu } from '../shared/RowActionsMenu'

export interface PlanEntitlementsViewProps {
  entitlements: Entitlement[]
  /** The plan's usage price for this entitlement's feature, or null when it has none. */
  usagePrice: (entitlement: Entitlement) => string | null
  onAdd: () => void
  onEdit: (entitlement: Entitlement) => void
  onDelete: (entitlement: Entitlement) => void
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

/** Entitlements table; the last column shows what happens past the value. */
export function PlanEntitlementsView({
  entitlements,
  usagePrice,
  onAdd,
  onEdit,
  onDelete,
}: PlanEntitlementsViewProps) {
  if (entitlements.length === 0) {
    return (
      <EmptyState
        title="No entitlements yet"
        description="Entitlements decide what a plan includes of each feature — an allowance, a flag, or a value. Add one to define what subscribers get."
        action={
          <Button type="button" onClick={onAdd}>
            Add entitlement
          </Button>
        }
      />
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button type="button" onClick={onAdd}>
          <PlusIcon aria-hidden className="size-4" />
          Add entitlement
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Feature</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Usage reset</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Usage beyond the value</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entitlements.map((e) => {
              const price = e.featureType === FeatureType.Metered ? usagePrice(e) : null
              return (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.featureName ?? e.featureId}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{TYPE_LABEL[e.featureType]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.usageResetPeriod ? USAGE_RESET_PERIOD_LABEL[e.usageResetPeriod] : '—'}
                  </TableCell>
                  <TableCell className="text-left tabular-nums">{valueOf(e)}</TableCell>
                  <TableCell className="text-left tabular-nums">
                    {e.featureType !== FeatureType.Metered ? (
                      <span className="text-muted-foreground">—</span>
                    ) : price ? (
                      price
                    ) : (
                      <span className="text-muted-foreground">No usage price on this plan</span>
                    )}
                  </TableCell>
                  <TableCell>
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
      </div>
    </div>
  )
}
