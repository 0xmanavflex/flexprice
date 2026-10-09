import {
  CREDIT_GRANT_CADENCE_LABEL,
  CREDIT_GRANT_EXPIRY_TYPE_LABEL,
  CREDIT_GRANT_PERIOD_LABEL,
  type CreditGrant,
  CreditGrantCadence,
} from '@fp/domain'
import { SectionEmpty } from '@ui/compositions/SectionEmpty'
import { Button } from '@ui/components/primitives/button'
import { PlusIcon } from 'lucide-react'

import { Section } from '@ui/compositions/Section'
import { provenance } from '@ui/provenance'
import { RowActionsMenu } from '../../shared/RowActionsMenu'
import { DetailTable } from '../../shared/DetailTable'

/**
 * A plan's or add-on's credit grants: a titled, flush section holding the full table.
 *
 * Cadence carries the period where there is one — "Recurring · Monthly" — because
 * a recurring grant only means something with the period it refreshes on beside
 * it.
 */
export const CreditGrantTableProvenance = provenance({
  source: 'composition',
  composes: ['compositions/Section', 'pages/shared/DetailTable', 'ui/button'],
  note: 'Read-only credit-grants table for the plan Credit Grants tab.',
})

export interface CreditGrantTableProps {
  grants: CreditGrant[]
  onAdd?: () => void
  onEdit?: (grant: CreditGrant) => void
  onDelete?: (grant: CreditGrant) => void
}

function cadenceLabel(grant: CreditGrant): string {
  if (grant.cadence === CreditGrantCadence.Recurring && grant.period) {
    return `${CREDIT_GRANT_CADENCE_LABEL[grant.cadence]} · ${CREDIT_GRANT_PERIOD_LABEL[grant.period]}`
  }
  return CREDIT_GRANT_CADENCE_LABEL[grant.cadence]
}

export function CreditGrantTable({ grants, onAdd, onEdit, onDelete }: CreditGrantTableProps) {
  const hasActions = Boolean(onEdit || onDelete)
  const addButton = onAdd ? (
    <Button type="button" size="sm" className="h-9 px-3" onClick={onAdd}>
      <PlusIcon aria-hidden="true" />
      Add credit grant
    </Button>
  ) : null
  return (
    <Section title="Credit grants" flush bare={grants.length > 0}>
      {grants.length === 0 ? (
        <SectionEmpty
          title="No credit grants yet"
          description={`Credit grants hand subscribers a balance to spend against usage — a one-time top-up or a budget that refreshes each period.${onAdd ? ' Add one to include credits in the plan.' : ''}`}
          action={addButton}
        />
      ) : (
        <DetailTable
          label="Credit grants"
          {...(addButton ? { action: addButton } : {})}
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
                <span className="text-muted-foreground">
                  {CREDIT_GRANT_EXPIRY_TYPE_LABEL[grant.expirationType]}
                </span>
              ),
            },
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
      )}
    </Section>
  )
}
