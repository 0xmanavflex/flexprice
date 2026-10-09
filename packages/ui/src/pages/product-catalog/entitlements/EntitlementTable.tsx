import { GaugeIcon, PlusIcon, SlidersHorizontalIcon, ToggleRightIcon, TypeIcon } from 'lucide-react'
import { SectionEmpty } from '@ui/compositions/SectionEmpty'
import { USAGE_RESET_PERIOD_LABEL, type Entitlement, FeatureType } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { Section } from '@ui/compositions/Section'

import { provenance } from '@ui/provenance'
import { EmDash, EntityLink } from '../../shared/cells'
import { RowActionsMenu } from '../../shared/RowActionsMenu'
import { DetailTable } from '../../shared/DetailTable'

/**
 * An entitlements section: a flush `Section` with a `SimpleTable`.
 *
 * The "Included" column reads per feature type — a metered allowance as a number
 * or "Unlimited", a boolean as Yes/No, a static value as itself — because "what
 * does this include of this feature" is answered differently for each.
 */
export const EntitlementTableProvenance = provenance({
  source: 'composition',
  composes: ['compositions/section', 'pages/shared/DetailTable', 'ui/button'],
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
      return entitlement.usageLimit == null ? 'Unlimited' : entitlement.usageLimit.toLocaleString()
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
}: EntitlementTableProps) {
  const hasActions = Boolean(onEdit || onDelete)
  const addButton = onAdd ? (
    <Button type="button" size="sm" className="h-9 px-3" onClick={onAdd}>
      <PlusIcon aria-hidden />
      Add entitlement
    </Button>
  ) : null

  if (entitlements.length === 0) {
    return (
      <Section title={title} flush>
        <SectionEmpty
          title="No entitlements yet"
          description={`Entitlements decide what is included of each feature: an allowance, a flag, or a value.${onAdd ? ' Add one to define what subscribers get.' : ''}`}
          action={addButton}
        />
      </Section>
    )
  }

  return (
    <Section title={title} flush bare>
      <DetailTable
        {...(addButton ? { action: addButton } : {})}
        label="Entitlements"
        facet={{ label: 'Type', value: (entitlement) => TYPE_LABEL[entitlement.featureType] }}
        noun="entitlements"
        rows={entitlements}
        columns={[
          {
            key: 'feature',
            header: 'Feature',
            sortBy: (entitlement) => entitlement.featureName ?? entitlement.featureId,
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
            sortBy: (entitlement) => TYPE_LABEL[entitlement.featureType],
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
