import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { type Charge, type CreateCharge, type PriceEntityType, chargeToDraft } from '@fp/domain'
import {
  toUpdatePriceRequest,
  useCreateBulkPrices,
  usePriceHistory,
  useUpdatePrice,
} from '@fp/query'
import { AddChargeDialog, ChargeTable } from '@fp/ui/pages'
import { AccessScope } from '@fp/ui/compositions'
import { RBAC_ENTITY } from '@fp/domain'
import { usePlanFormOptions } from '../plans/planFormOptions'
import { priceHistoryRows } from './priceHistory'
import { subTab } from './subTab'
import { TerminateChargeDialog } from './TerminateChargeDialog'

export interface CatalogChargesProps {
  entityType: PriceEntityType
  entityId: string
  /** What the charges belong to, for the terminate wording ("add-on", "cost sheet"). */
  noun: string
  title?: string
  emptyDescription: string
}

/**
 * The charges of a catalogue record that is not a plan: an add-on or a cost
 * sheet. "Add charge" asks Fixed or Usage, then shows the plan's charge form;
 * an edit saves a new price version, and terminating one is confirmed first.
 */
export function CatalogCharges({
  entityType,
  entityId,
  noun,
  title,
  emptyDescription,
}: CatalogChargesProps) {
  // Ended prices too, so an edited charge keeps its earlier price as history.
  const charges = usePriceHistory(entityType, entityId)
  const rows = priceHistoryRows(charges.data ?? [])
  const { meters, units, priceGroups } = usePlanFormOptions()
  const navigate = useNavigate()
  const create = useCreateBulkPrices()
  const updatePrice = useUpdatePrice()
  const [target, setTarget] = useState<Charge | null>(null)
  const [form, setForm] = useState<'add' | Charge | null>(null)
  const editing = form !== null && form !== 'add' ? form : null

  const closeForm = () => {
    setForm(null)
    create.reset()
    updatePrice.reset()
  }

  const submit = (draft: CreateCharge) => {
    if (editing) {
      updatePrice.mutate(
        { id: editing.id, body: toUpdatePriceRequest(draft) },
        { onSuccess: closeForm },
      )
      return
    }
    create.mutate({ entityType, entityId, charges: [draft] }, { onSuccess: closeForm })
  }

  // A catalog's charges are prices: V1 gates them on price write.
  return (
    <AccessScope entity={RBAC_ENTITY.Price}>
      <ChargeTable
        charges={rows.charges}
        details={rows.details}
        onRevert={(charge, versionId) => {
          // No revert endpoint: the earlier price is saved as a new version from now.
          const previous = (charges.data ?? []).find((price) => price.id === versionId)
          return previous
            ? updatePrice.mutateAsync({
                id: charge.id,
                body: toUpdatePriceRequest(chargeToDraft(previous)),
              })
            : Promise.reject(new Error(`That version is no longer on this ${noun}.`))
        }}
        {...subTab(charges, 'charges')}
        {...(title ? { title } : {})}
        emptyDescription={emptyDescription}
        onAdd={() => setForm('add')}
        onEdit={(charge) => setForm(charge)}
        onTerminate={(charge) => setTarget(charge)}
      />
      <AddChargeDialog
        open={form !== null}
        onOpenChange={(open) => {
          if (!open) closeForm()
        }}
        editing={editing}
        meters={meters}
        priceUnits={units}
        priceGroups={priceGroups}
        onCreateFeature={() => void navigate({ to: '/features/new' })}
        onSubmit={submit}
        isSubmitting={create.isPending || updatePrice.isPending}
        submitError={
          editing
            ? updatePrice.isError
              ? 'Could not save the price. Try again.'
              : null
            : create.isError
              ? 'The charge was rejected. Check it and try again.'
              : null
        }
      />
      <TerminateChargeDialog charge={target} noun={noun} onClose={() => setTarget(null)} />
    </AccessScope>
  )
}
