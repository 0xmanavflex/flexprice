import { GaugeIcon, PlusIcon, SlidersHorizontalIcon, ToggleRightIcon, TypeIcon } from 'lucide-react'
import { USAGE_RESET_PERIOD_LABEL, type Entitlement, FeatureType } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { Section } from '@ui/compositions/Section'
import { SimpleTable } from '@ui/compositions/DetailKit'
import { provenance } from '@ui/provenance'
import { EmDash, EntityLink } from '../shared/cells'
import { RowActionsMenu } from '../shared/RowActionsMenu'

/**
 * An entitlements section: a flush `Section` with a `SimpleTable`.
 *
 * The "Included" column reads per feature type — a metered allowance as a number
 * or "Unlimited", a boolean as Yes/No, a static value as itself — because "what
 * does this include of this feature" is answered differently for each.
 */
export const EntitlementTableProvenance = provenance({
  source: 'composition',
  composes: ['compositions/section', 'compositions/detail-kit', 'ui/button'],
  note: 'Flush entitlements section for add-on and plan-like detail pages.',
})

export interface EntitlementTableProps {
  entitlements: Entitlement[]
  onAdd?: () => void
  onEdit?: (entitlement: Entitlement) => void
  onDelete?: (entitlement: Entitlement) => void
  onOpenFeature?: (featureId: string) => void
  /** Section heading; defaults to "Entitlements". */
  title?: string
  /** Section sub-heading under the title. */
  description?: string
}

const TYPE_ICON: Record<FeatureType, typeof GaugeIcon> = {
  [FeatureType.Metered]: GaugeIcon,
  [FeatureType.Boolean]: ToggleRightIcon,
  [FeatureType.Static]: TypeIcon,
  [FeatureType.Config]: SlidersHorizontalIcon,
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
  title = 'Entitlements',
  description = 'What subscribers get: feature access and included allowances',
}: EntitlementTableProps) {
  const hasActions = Boolean(onEdit || onDelete)
  const addButton = onAdd ? (
    <Button type="button" size="sm" className="h-8 px-3" onClick={onAdd}>
      <PlusIcon aria-hidden />
      Add entitlement
    </Button>
  ) : null

  if (entitlements.length === 0) {
    return (
      <Section title={title} description={description} flush>
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <p className="text-sm font-medium">No entitlements yet</p>
          <p className="text-muted-foreground max-w-md text-[13px]">
            Entitlements decide what is included of each feature: an allowance, a flag, or a value.
            {onAdd ? ' Add one to define what subscribers get.' : ''}
          </p>
          {addButton}
        </div>
      </Section>
    )
  }

  return (
    <Section
      title={title}
      description={description}
      flush
      {...(addButton ? { action: addButton } : {})}
    >
      <SimpleTable
        rows={entitlements}
        columns={[
          {
            key: 'feature',
            header: 'Feature',
            cell: (entitlement) => {
              const Icon = TYPE_ICON[entitlement.featureType]
              const label = entitlement.featureName ?? entitlement.featureId
              return (
                <span className="flex items-center gap-2.5">
                  <Icon aria-hidden className="text-muted-foreground size-4" />
                  {onOpenFeature ? (
                    <span className="min-w-0 font-medium">
                      <EntityLink
                        label={label}
                        onOpen={() => onOpenFeature(entitlement.featureId)}
                      />
                    </span>
                  ) : (
                    <span className="font-medium">{label}</span>
                  )}
                </span>
              )
            },
          },
          {
            key: 'type',
            header: 'Type',
            cell: (entitlement) => (
              <span className="text-muted-foreground">{TYPE_LABEL[entitlement.featureType]}</span>
            ),
          },
          {
            key: 'included',
            header: 'Included',
            cell: (entitlement) => <span className="tabular-nums">{valueOf(entitlement)}</span>,
          },
          {
            key: 'reset',
            header: 'Usage resets',
            cell: (entitlement) =>
              entitlement.usageResetPeriod ? (
                <span className="text-muted-foreground">
                  {USAGE_RESET_PERIOD_LABEL[entitlement.usageResetPeriod]}
                </span>
              ) : (
                <EmDash />
              ),
          },
          ...(hasActions
            ? [
                {
                  key: 'actions',
                  header: '',
                  className: 'w-12',
                  cell: (entitlement: Entitlement) => (
                    <RowActionsMenu
                      label={entitlement.featureName ?? 'entitlement'}
                      onEdit={onEdit ? () => onEdit(entitlement) : undefined}
                      onRemove={onDelete ? () => onDelete(entitlement) : undefined}
                    />
                  ),
                },
              ]
            : []),
        ]}
      />
    </Section>
  )
}
