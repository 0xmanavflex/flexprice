import { PlusIcon, CoinsIcon } from 'lucide-react'
import {
  CREDIT_GRANT_CADENCE_LABEL,
  CREDIT_GRANT_EXPIRY_TYPE_LABEL,
  CREDIT_GRANT_PERIOD_LABEL,
  type CreditGrant,
  CreditGrantCadence,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ui/components/primitives/table'
import { RowActionsMenu } from '../shared/RowActionsMenu'
import { PlanTabCard } from './PlanTabCard'

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

const head = 'text-xs tracking-wide uppercase'

/** The plan's credit grants in the plan-tab frame: grant, credits, granted, expires, priority. */
export function PlanCreditGrantsView({
  grants,
  onAdd,
  onEdit,
  onDelete,
}: PlanCreditGrantsViewProps) {
  const add = (
    <Button type="button" size="sm" onClick={onAdd}>
      <PlusIcon aria-hidden className="size-4" />
      Add grant
    </Button>
  )
  return (
    <PlanTabCard
      title="Credit grants"
      description="Credits every subscriber receives in their wallet"
      action={grants.length > 0 ? add : undefined}
    >
      {grants.length === 0 ? (
        <div className="flex flex-col items-center gap-3 border-t px-6 py-12 text-center">
          <p className="text-muted-foreground text-sm">
            No credit grants yet. Add credits subscribers receive with this plan.
          </p>
          {add}
        </div>
      ) : (
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className={`px-6 ${head}`}>Grant</TableHead>
              <TableHead className={head}>Credits</TableHead>
              <TableHead className={head}>Granted</TableHead>
              <TableHead className={head}>Expires</TableHead>
              <TableHead className={head}>Priority</TableHead>
              <TableHead className="w-12 pr-6">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grants.map((g) => (
              <TableRow key={g.id} className="h-14">
                <TableCell className="px-6">
                  <span className="flex items-center gap-2.5">
                    <CoinsIcon aria-hidden className="text-muted-foreground size-4" />
                    {g.name}
                  </span>
                </TableCell>
                <TableCell className="tabular-nums">{Number(g.credits).toLocaleString()}</TableCell>
                <TableCell>{grantedLabel(g)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {CREDIT_GRANT_EXPIRY_TYPE_LABEL[g.expirationType]}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">{g.priority}</TableCell>
                <TableCell className="pr-6">
                  <RowActionsMenu
                    label={g.name}
                    onEdit={() => onEdit(g)}
                    onRemove={() => onDelete(g)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </PlanTabCard>
  )
}
