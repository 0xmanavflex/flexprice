import { RBAC_ENTITY } from '@fp/domain'
import { AccessScope, WriteGate } from '@ui/compositions/access/Access'
import { PlusIcon } from '@ui/icons'
import { FEATURE_TYPE_GLYPH } from '../../shared/cells'
import { SubTabState, type SubTabQuery } from '@ui/compositions/detail/SubTabState'
import { USAGE_RESET_PERIOD_LABEL, type Entitlement, FeatureType } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { Section } from '@ui/compositions/layout/Section'

import { provenance } from '@ui/provenance'
import { EmDash, EntityLink } from '../../shared/cells'
import { RowActionsMenu } from '../../shared/RowActionsMenu'
import { DetailTable } from '../../shared/DetailTable'

/**
 * An entitlements section: a flush `Section` with a `SimpleTable`.
 *
 * The "Included" column reads per feature type: a metered allowance as a number
 * or "Unlimited", a boolean as Yes/No, a static value as itself: because "what
 * does this include of this feature" is answered differently for each.
 */
export const EntitlementTableProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/section',
    'compositions/SubTabState',
    'pages/shared/DetailTable',
    'ui/button',
  ],
  note: 'Flush entitlements section for add-on and plan-like detail pages.',
})

export interface EntitlementTableProps extends Partial<SubTabQuery> {
  entitlements: Entitlement[]
  onAdd?: () => void
  onEdit?: (entitlement: Entitlement) => void
  onDelete?: (entitlement: Entitlement) => void
  onOpenFeature?: (featureId: string) => void
  /** Section heading; defaults to "Entitlements". */
  title?: string
  /** Show the heading above the box, for a tab that stacks this table with another. */
  showTitle?: boolean
}

/** The agreed glyph per feature type, shared with every other catalogue table. */
const TYPE_ICON: Record<FeatureType, (typeof FEATURE_TYPE_GLYPH)[keyof typeof FEATURE_TYPE_GLYPH]> =
  FEATURE_TYPE_GLYPH

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

function EntitlementTableInner({
  entitlements,
  onAdd,
  onEdit,
  onDelete,
  onOpenFeature,
  title = 'Entitlements',
  showTitle,
  isLoading,
  error,
  errorKind,
  retryAfterMs,
  onRetry,
  isRetrying,
}: EntitlementTableProps) {
  const hasActions = Boolean(onEdit || onDelete)
  const addButton = onAdd ? (
    <WriteGate>
      <Button type="button" variant="outline" size="sm" className="h-8 px-3" onClick={onAdd}>
        <PlusIcon aria-hidden />
        Add entitlement
      </Button>
    </WriteGate>
  ) : null

  if (entitlements.length === 0) {
    return (
      <Section
        table
        title={title}
        {...(showTitle ? { showTitle } : {})}
        {...(addButton ? { action: addButton } : {})}
      >
        <SubTabState
          hasData={false}
          isLoading={isLoading ?? false}
          error={error}
          errorKind={errorKind}
          retryAfterMs={retryAfterMs}
          onRetry={onRetry}
          isRetrying={isRetrying}
          columns={5}
          loadingLabel="Loading entitlements"
          empty={{
            scene: 'catalog',
            title: 'No entitlements yet',
            description: `Entitlements decide what is included of each feature: an allowance, a flag, or a value.${onAdd ? ' Add one to define what subscribers get.' : ''}`,
          }}
        >
          {null}
        </SubTabState>
      </Section>
    )
  }

  return (
    <Section
      table
      title={title}
      {...(showTitle ? { showTitle } : {})}
      {...(addButton ? { action: addButton } : {})}
    >
      <DetailTable
        compact
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
                <span className="flex min-w-0 items-center gap-2.5">
                  <Icon aria-hidden className="text-muted-foreground size-4 shrink-0" />
                  {onOpenFeature ? (
                    <span className="min-w-0 truncate font-medium">
                      <EntityLink
                        label={label}
                        onOpen={() => onOpenFeature(entitlement.featureId)}
                      />
                    </span>
                  ) : (
                    <span className="min-w-0 truncate font-medium">{label}</span>
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

/** `EntitlementTable`, scoped to the entity it writes (Entitlement). */
export function EntitlementTable(props: Parameters<typeof EntitlementTableInner>[0]) {
  return (
    <AccessScope entity={RBAC_ENTITY.Entitlement}>
      <EntitlementTableInner {...props} />
    </AccessScope>
  )
}
