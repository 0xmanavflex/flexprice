import { RBAC_ENTITY, periodNoun } from '@fp/domain'
import { AccessScope, WriteGate } from '@ui/compositions/access/Access'
import { PlusIcon, CoinsIcon } from '@ui/icons'
import { SubTabState, type SubTabQuery } from '@ui/compositions/detail/SubTabState'
import {
  CREDIT_GRANT_CADENCE_LABEL,
  CREDIT_GRANT_EXPIRY_TYPE_LABEL,
  type CreditGrant,
  CreditGrantCadence,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { Section } from '@ui/compositions/layout/Section'

import { RowActionsMenu } from '../../shared/RowActionsMenu'
import { DetailTable } from '../../shared/DetailTable'

export interface PlanCreditGrantsViewProps extends Partial<SubTabQuery> {
  grants: CreditGrant[]
  onAdd: () => void
  onEdit: (grant: CreditGrant) => void
  onDelete: (grant: CreditGrant) => void
}

function grantedLabel(g: CreditGrant): string {
  if (g.cadence === CreditGrantCadence.Recurring && g.period) {
    return `Every ${periodNoun(g.period)}`
  }
  return CREDIT_GRANT_CADENCE_LABEL[g.cadence]
}

/** The plan's credit grants: grant, credits, granted, expires, priority. */
function PlanCreditGrantsViewInner({
  grants,
  onAdd,
  onEdit,
  onDelete,
  isLoading,
  error,
  errorKind,
  retryAfterMs,
  onRetry,
  isRetrying,
}: PlanCreditGrantsViewProps) {
  const add = (
    <WriteGate>
      <Button type="button" variant="outline" size="sm" className="h-8 px-3" onClick={onAdd}>
        <PlusIcon aria-hidden />
        Add grant
      </Button>
    </WriteGate>
  )
  if (grants.length === 0) {
    return (
      <Section table showTitle title="Credit grants" action={add}>
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
            description: 'Subscribers start with an empty wallet.',
          }}
        >
          {null}
        </SubTabState>
      </Section>
    )
  }

  return (
    <Section table showTitle title="Credit grants" action={add}>
      <DetailTable
        compact
        label="Credit grants"
        facet={{
          label: 'Expires',
          value: (g) => CREDIT_GRANT_EXPIRY_TYPE_LABEL[g.expirationType],
        }}
        noun="credit grants"
        rows={grants}
        columns={[
          {
            key: 'name',
            header: 'Grant',
            sortBy: (g) => g.name,
            cell: (g) => (
              <span className="flex items-center gap-2.5">
                <CoinsIcon aria-hidden className="text-muted-foreground size-4" />
                <span className="font-medium">{g.name}</span>
              </span>
            ),
          },
          {
            key: 'credits',
            header: 'Credits',
            sortBy: (g) => Number(g.credits),
            cell: (g) => <span className="tabular-nums">{Number(g.credits).toLocaleString()}</span>,
          },
          { key: 'granted', header: 'Granted', cell: (g) => grantedLabel(g) },
          {
            key: 'expires',
            header: 'Expires',
            cell: (g) => (
              <span className="text-muted-foreground">
                {CREDIT_GRANT_EXPIRY_TYPE_LABEL[g.expirationType]}
              </span>
            ),
          },
          {
            key: 'priority',
            header: 'Priority',
            sortBy: (g) => Number(g.priority),
            cell: (g) => <span className="text-muted-foreground">{g.priority}</span>,
          },
          {
            key: 'actions',
            header: '',
            className: 'w-12',
            cell: (g) => (
              <RowActionsMenu
                label={g.name}
                onEdit={() => onEdit(g)}
                onRemove={() => onDelete(g)}
              />
            ),
          },
        ]}
      />
    </Section>
  )
}

/** `PlanCreditGrantsView`, scoped to the entity it writes (CreditGrant). */
export function PlanCreditGrantsView(props: Parameters<typeof PlanCreditGrantsViewInner>[0]) {
  return (
    <AccessScope entity={RBAC_ENTITY.CreditGrant}>
      <PlanCreditGrantsViewInner {...props} />
    </AccessScope>
  )
}
