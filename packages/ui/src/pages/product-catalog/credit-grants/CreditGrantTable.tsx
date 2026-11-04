import { RBAC_ENTITY } from '@fp/domain'
import { AccessScope, WriteGate } from '@ui/compositions/access/Access'
import {
  CREDIT_GRANT_CADENCE_LABEL,
  creditGrantExpiryLabel,
  CREDIT_GRANT_PERIOD_LABEL,
  type CreditGrant,
  CreditGrantCadence,
} from '@fp/domain'
import { SubTabState, type SubTabQuery } from '@ui/compositions/detail/SubTabState'
import { Button } from '@ui/components/primitives/button'
import { PlusIcon } from '@ui/icons'

import { formatStoredDay } from '@ui/compositions/forms/DateInput'
import { Section } from '@ui/compositions/layout/Section'
import { provenance } from '@ui/provenance'
import { RowActionsMenu } from '../../shared/RowActionsMenu'
import { DetailTable } from '../../shared/DetailTable'

/**
 * A plan's or add-on's credit grants: a titled, flush section holding the full table.
 *
 * Cadence carries the period where there is one: "Recurring · Monthly": because
 * a recurring grant only means something with the period it refreshes on beside
 * it.
 */
export const CreditGrantTableProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/Section',
    'compositions/SubTabState',
    'pages/shared/DetailTable',
    'ui/button',
  ],
  note: 'Read-only credit-grants table for the plan Credit Grants tab.',
})

export interface CreditGrantTableProps extends Partial<SubTabQuery> {
  grants: CreditGrant[]
  onAdd?: () => void
  onEdit?: (grant: CreditGrant) => void
  onDelete?: (grant: CreditGrant) => void
  /** Show the heading above the box, for a tab that stacks this table with another. */
  showTitle?: boolean
}

function cadenceLabel(grant: CreditGrant): string {
  if (grant.cadence === CreditGrantCadence.Recurring && grant.period) {
    return `${CREDIT_GRANT_CADENCE_LABEL[grant.cadence]} · ${CREDIT_GRANT_PERIOD_LABEL[grant.period]}`
  }
  return CREDIT_GRANT_CADENCE_LABEL[grant.cadence]
}

function CreditGrantTableInner({
  grants,
  onAdd,
  onEdit,
  onDelete,
  showTitle,
  isLoading,
  error,
  errorKind,
  retryAfterMs,
  onRetry,
  isRetrying,
}: CreditGrantTableProps) {
  const hasActions = Boolean(onEdit || onDelete)
  const addButton = onAdd ? (
    <WriteGate>
      <Button type="button" variant="outline" size="sm" className="h-8 px-3" onClick={onAdd}>
        <PlusIcon aria-hidden="true" />
        Add credit grant
      </Button>
    </WriteGate>
  ) : null
  if (grants.length === 0) {
    return (
      <Section
        table
        title="Credit grants"
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
          loadingLabel="Loading credit grants"
          empty={{
            scene: 'catalog',
            title: 'No credit grants yet',
            description: `Credit grants hand subscribers a balance to spend against usage: a one-time top-up or a budget that refreshes each period.${onAdd ? ' Add one to include credits in the plan.' : ''}`,
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
      title="Credit grants"
      {...(showTitle ? { showTitle } : {})}
      {...(addButton ? { action: addButton } : {})}
    >
      <DetailTable
        compact
        label="Credit grants"
        noun="credit grants"
        rows={grants}
        getRowId={(grant) => grant.id}
        columns={[
          {
            key: 'name',
            header: 'Name',
            sortBy: (grant) => grant.name,
            cell: (grant) => <span className="font-medium">{grant.name}</span>,
          },
          {
            key: 'credits',
            header: 'Credits',
            sortBy: (grant) => Number(grant.credits),
            cell: (grant) => <span className="tabular-nums">{grant.credits}</span>,
          },
          { key: 'cadence', header: 'Cadence', cell: (grant) => cadenceLabel(grant) },
          {
            key: 'expiry',
            header: 'Expiry',
            cell: (grant) => (
              <span className="text-muted-foreground">{creditGrantExpiryLabel(grant)}</span>
            ),
          },
          // When an add-on's grant stops issuing credits, once an end date is set.
          ...(grants.some((grant) => grant.endDate)
            ? [
                {
                  key: 'ends',
                  header: 'Ends',
                  cell: (grant: CreditGrant) => (
                    <span className="text-muted-foreground tabular-nums">
                      {grant.endDate
                        ? formatStoredDay(grant.endDate, { locale: 'en-US' })
                        : 'No end'}
                    </span>
                  ),
                },
              ]
            : []),
          {
            key: 'priority',
            header: 'Priority',
            sortBy: (grant) => Number(grant.priority),
            cell: (grant) => <span className="tabular-nums">{grant.priority}</span>,
          },
          ...(hasActions
            ? [
                {
                  key: 'actions',
                  header: '',
                  className: 'w-10',
                  cell: (grant: CreditGrant) => (
                    <RowActionsMenu
                      label={grant.name}
                      onEdit={onEdit ? () => onEdit(grant) : undefined}
                      onRemove={onDelete ? () => onDelete(grant) : undefined}
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

/** `CreditGrantTable`, scoped to the entity it writes (CreditGrant). */
export function CreditGrantTable(props: Parameters<typeof CreditGrantTableInner>[0]) {
  return (
    <AccessScope entity={RBAC_ENTITY.CreditGrant}>
      <CreditGrantTableInner {...props} />
    </AccessScope>
  )
}
