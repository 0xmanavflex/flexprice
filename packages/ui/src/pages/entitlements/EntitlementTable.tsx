import {
  USAGE_RESET_PERIOD_LABEL,
  type Entitlement,
  FeatureType,
} from '@fp/domain'
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
import { EmptyState } from '@ui/compositions/EmptyState'
import { provenance } from '@ui/provenance'
import { EntityLink } from '../shared/cells'
import { RowActionsMenu } from '../shared/RowActionsMenu'

/**
 * A plan's entitlements, as a read table.
 *
 * The "Value" column reads per feature type — a metered allowance as a number or
 * "Unlimited", a boolean as Yes/No, a static value as itself — because "what does
 * this plan include of this feature" is answered differently for each.
 */
export const EntitlementTableProvenance = provenance({
  source: 'composition',
  composes: ['ui/table', '@reui/badge', 'ui/button'],
  note: 'Read-only entitlements table for the plan Entitlements tab.',
})

export interface EntitlementTableProps {
  entitlements: Entitlement[]
  onAdd?: () => void
  onEdit?: (entitlement: Entitlement) => void
  onDelete?: (entitlement: Entitlement) => void
  onOpenFeature?: (featureId: string) => void
}

const TYPE_LABEL: Record<FeatureType, string> = {
  [FeatureType.Metered]: 'Metered',
  [FeatureType.Boolean]: 'Boolean',
  [FeatureType.Static]: 'Static',
  [FeatureType.Config]: 'Config',
}

/** What the plan grants of this feature, in the feature type's own terms. */
function valueOf(entitlement: Entitlement): string {
  switch (entitlement.featureType) {
    case FeatureType.Metered:
      return entitlement.usageLimit == null
        ? 'Unlimited'
        : entitlement.usageLimit.toLocaleString()
    case FeatureType.Boolean:
      return entitlement.isEnabled ? 'Yes' : 'No'
    case FeatureType.Static:
      return entitlement.staticValue ?? '—'
    case FeatureType.Config:
      return 'Configured'
  }
}

export function EntitlementTable({
  entitlements,
  onAdd,
  onEdit,
  onDelete,
  onOpenFeature,
}: EntitlementTableProps) {
  const hasActions = Boolean(onEdit || onDelete)
  if (entitlements.length === 0) {
    return (
      <EmptyState
        title="No entitlements yet"
        description="Entitlements decide what a plan includes of each feature — an allowance, a flag, or a value. Add one to define what subscribers get."
        {...(onAdd
          ? {
              action: (
                <Button type="button" onClick={onAdd}>
                  Add entitlement
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
            Add entitlement
          </Button>
        </div>
      ) : null}
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Feature</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Usage reset</TableHead>
              <TableHead>Value</TableHead>
              {hasActions ? (
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {entitlements.map((entitlement) => (
              <TableRow key={entitlement.id}>
                <TableCell>
                  {onOpenFeature ? (
                    <EntityLink
                      label={entitlement.featureName ?? entitlement.featureId}
                      onOpen={() => onOpenFeature(entitlement.featureId)}
                    />
                  ) : (
                    (entitlement.featureName ?? entitlement.featureId)
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{TYPE_LABEL[entitlement.featureType]}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {entitlement.usageResetPeriod
                    ? USAGE_RESET_PERIOD_LABEL[entitlement.usageResetPeriod]
                    : '—'}
                </TableCell>
                <TableCell className="tabular-nums">{valueOf(entitlement)}</TableCell>
                {hasActions ? (
                  <TableCell>
                    <RowActionsMenu
                      label={entitlement.featureName ?? 'entitlement'}
                      onEdit={onEdit ? () => onEdit(entitlement) : undefined}
                      onRemove={onDelete ? () => onDelete(entitlement) : undefined}
                    />
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
