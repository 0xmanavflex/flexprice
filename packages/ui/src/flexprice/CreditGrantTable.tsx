import {
  CREDIT_GRANT_CADENCE_LABEL,
  CREDIT_GRANT_EXPIRY_TYPE_LABEL,
  CREDIT_GRANT_PERIOD_LABEL,
  type CreditGrant,
  CreditGrantCadence,
} from '@fp/domain'
import { Badge } from '@ui/components/reui/badge'
import { Button } from '@ui/primitives/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ui/primitives/table'
import { EmptyState } from '@ui/compositions/EmptyState'
import { provenance } from '@ui/provenance'
import { RowActionsMenu } from './RowActionsMenu'

/**
 * A plan's credit grants, as a read table.
 *
 * Cadence carries the period where there is one — "Recurring · Monthly" — because
 * a recurring grant only means something with the period it refreshes on beside
 * it.
 */
export const CreditGrantTableProvenance = provenance({
  source: 'composition',
  composes: ['ui/table', '@reui/badge', 'ui/button'],
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
  if (grants.length === 0) {
    return (
      <EmptyState
        title="No credit grants yet"
        description="Credit grants hand subscribers a balance to spend against usage — a one-time top-up or a budget that refreshes each period. Add one to include credits in the plan."
        {...(onAdd
          ? {
              action: (
                <Button type="button" onClick={onAdd}>
                  Add credit grant
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
            Add credit grant
          </Button>
        </div>
      ) : null}
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Credits</TableHead>
              <TableHead>Cadence</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Priority</TableHead>
              {hasActions ? (
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {grants.map((grant) => (
              <TableRow key={grant.id}>
                <TableCell className="font-medium">{grant.name}</TableCell>
                <TableCell className="tabular-nums">{grant.credits}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{cadenceLabel(grant)}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {CREDIT_GRANT_EXPIRY_TYPE_LABEL[grant.expirationType]}
                </TableCell>
                <TableCell className="tabular-nums">{grant.priority}</TableCell>
                {hasActions ? (
                  <TableCell>
                    <RowActionsMenu
                      label={grant.name}
                      onEdit={onEdit ? () => onEdit(grant) : undefined}
                      onRemove={onDelete ? () => onDelete(grant) : undefined}
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
