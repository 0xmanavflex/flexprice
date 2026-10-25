import { RBAC_ENTITY } from '@fp/domain'
import { AccessScope, WriteGate } from '@ui/compositions/access/Access'
import { PlusIcon } from '@ui/icons'
import { FEATURE_TYPE_GLYPH } from '../../shared/cells'
import { SubTabState, type SubTabQuery } from '@ui/compositions/detail/SubTabState'
import { EmDash } from '../../shared/cells'
import { type Entitlement, FeatureType, USAGE_RESET_PERIOD_LABEL } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { Section } from '@ui/compositions/layout/Section'

import { RowActionsMenu } from '../../shared/RowActionsMenu'
import { DetailTable } from '../../shared/DetailTable'

export interface PlanEntitlementsViewProps extends Partial<SubTabQuery> {
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

/** The agreed glyph per feature type, shared with every other catalogue table. */
const TYPE_ICON: Record<FeatureType, (typeof FEATURE_TYPE_GLYPH)[keyof typeof FEATURE_TYPE_GLYPH]> =
  FEATURE_TYPE_GLYPH

function includedOf(e: Entitlement): string {
  if (e.featureType === FeatureType.Metered && e.usageLimit != null) {
    return compact.format(e.usageLimit)
  }
  return valueOf(e)
}

/** Entitlements section; the last column shows what happens past the value. */
function PlanEntitlementsViewInner({
  entitlements,
  usagePrice,
  onAdd,
  onEdit,
  onDelete,
  onOpenFeature,
  isLoading,
  error,
  errorKind,
  retryAfterMs,
  onRetry,
  isRetrying,
}: PlanEntitlementsViewProps) {
  const add = (
    <WriteGate>
      <Button type="button" variant="outline" size="sm" className="h-8 px-3" onClick={onAdd}>
        <PlusIcon aria-hidden />
        Add entitlement
      </Button>
    </WriteGate>
  )
  if (entitlements.length === 0) {
    return (
      <Section table showTitle title="Entitlements" action={add}>
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
            description: 'Add the features this plan includes.',
          }}
        >
          {null}
        </SubTabState>
      </Section>
    )
  }

  return (
    <Section table showTitle title="Entitlements" action={add}>
      <DetailTable
        compact
        label="Entitlements"

        facet={{ label: 'Type', value: (e) => TYPE_LABEL[e.featureType] }}
        noun="entitlements"
        rows={entitlements}
        {...(onOpenFeature ? { onRowClick: (e: Entitlement) => onOpenFeature(e.featureId) } : {})}
        columns={[
          {
            key: 'feature',
            header: 'Feature',
            sortBy: (e) => e.featureName ?? e.featureId,
            cell: (e) => {
              const Icon = TYPE_ICON[e.featureType]
              return (
                <span className="flex min-w-0 items-center gap-2.5">
                  <Icon aria-hidden className="text-muted-foreground size-4 shrink-0" />
                  <span className="min-w-0 truncate font-medium">
                    {e.featureName ?? e.featureId}
                  </span>
                </span>
              )
            },
          },
          {
            key: 'type',
            header: 'Type',
            sortBy: (e) => TYPE_LABEL[e.featureType],
            cell: (e) => <span className="text-muted-foreground">{TYPE_LABEL[e.featureType]}</span>,
          },
          { key: 'included', header: 'Included', cell: (e) => includedOf(e) },
          {
            key: 'reset',
            header: 'Usage resets',
            cell: (e) => (
              <span className="text-muted-foreground">
                {e.featureType !== FeatureType.Metered
                  ? '—'
                  : e.usageResetPeriod
                    ? USAGE_RESET_PERIOD_LABEL[e.usageResetPeriod]
                    : 'Every billing period'}
              </span>
            ),
          },
          {
            key: 'beyond',
            header: 'Overage',
            cell: (e) => {
              if (e.featureType !== FeatureType.Metered || e.usageLimit == null) return <EmDash />
              const price = usagePrice(e)
              return price ? (
                <span className="text-[13px]">
                  Billed <span className="text-muted-foreground">{price}</span>
                </span>
              ) : (
                <span className="text-muted-foreground text-[13px]">
                  No usage price on this plan
                </span>
              )
            },
          },
          {
            key: 'actions',
            header: '',
            className: 'w-12',
            cell: (e) => (
              <div onClick={(event) => event.stopPropagation()}>
                <RowActionsMenu
                  label={e.featureName ?? 'entitlement'}
                  onEdit={() => onEdit(e)}
                  onRemove={() => onDelete(e)}
                />
              </div>
            ),
          },
        ]}
      />
    </Section>
  )
}

/** `PlanEntitlementsView`, scoped to the entity it writes (Entitlement). */
export function PlanEntitlementsView(props: Parameters<typeof PlanEntitlementsViewInner>[0]) {
  return (
    <AccessScope entity={RBAC_ENTITY.Entitlement}>
      <PlanEntitlementsViewInner {...props} />
    </AccessScope>
  )
}
