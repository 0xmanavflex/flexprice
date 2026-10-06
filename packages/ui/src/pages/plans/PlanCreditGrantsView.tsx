import { PlusIcon, CoinsIcon } from 'lucide-react'
import {
  CREDIT_GRANT_CADENCE_LABEL,
  CREDIT_GRANT_EXPIRY_TYPE_LABEL,
  CREDIT_GRANT_PERIOD_LABEL,
  type CreditGrant,
  CreditGrantCadence,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { Section } from '@ui/compositions/Section'

import { RowActionsMenu } from '../shared/RowActionsMenu'
import { DetailTable } from '../shared/DetailTable'

export interface PlanCreditGrantsViewProps {
  grants: CreditGrant[]
  onAdd: () => void
  onEdit: (grant: CreditGrant) => void
  onDelete: (grant: CreditGrant) => void
}

function grantedLabel(g: CreditGrant): string {
  if (g.cadence === CreditGrantCadence.Recurring && g.period) {
    return `Every ${CREDIT_GRANT_PERIOD_LABEL[g.period].toLowerCase()}`
  }
  return CREDIT_GRANT_CADENCE_LABEL[g.cadence]
}

/** The plan's credit grants: grant, credits, granted, expires, priority. */
export function PlanCreditGrantsView({
  grants,
  onAdd,
  onEdit,
  onDelete,
}: PlanCreditGrantsViewProps) {
  return (
    <Section
      title="Credit grants"
      description="Credits every subscriber receives in their wallet"
      flush
      action={
        grants.length > 0 ? (
          <Button type="button" size="sm" className="h-8 px-3" onClick={onAdd}>
            <PlusIcon aria-hidden />
            Add grant
          </Button>
        ) : undefined
      }
    >
      {grants.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <p className="text-muted-foreground text-[13px]">
            No credit grants. Subscribers start with an empty wallet.
          </p>
          <Button type="button" size="sm" className="h-8 px-3" onClick={onAdd}>
            <PlusIcon aria-hidden />
            Add grant
          </Button>
        </div>
      ) : (
        <DetailTable
          label="Credit grants"
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
              cell: (g) => (
                <span className="tabular-nums">{Number(g.credits).toLocaleString()}</span>
              ),
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
      )}
    </Section>
  )
}
