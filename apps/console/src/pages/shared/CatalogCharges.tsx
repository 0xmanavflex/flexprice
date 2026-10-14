import { useState } from 'react'
import { type Charge, type CreateCharge, type PriceEntityType } from '@fp/domain'
import {
  toUpdatePriceRequest,
  useCreateBulkPrices,
  usePrices,
  useTerminatePrice,
  useUpdatePrice,
} from '@fp/query'
import { AddChargeDialog, ChargeTable } from '@fp/ui/pages'
import { ConfirmDialog } from '@fp/ui/compositions'
import { usePlanFormOptions } from '../plans/planFormOptions'
import { subTab } from './subTab'

export interface CatalogChargesProps {
  entityType: PriceEntityType
  entityId: string
  /** What the charges belong to, for the terminate wording ("add-on", "cost sheet"). */
  noun: string
  title?: string
  emptyDescription: string
}

/**
 * The charges of a catalogue record that is not a plan — an add-on or a cost
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
  const charges = usePrices(entityType, entityId)
  const { meters, units, priceGroups } = usePlanFormOptions()
  const create = useCreateBulkPrices()
  const updatePrice = useUpdatePrice()
  const terminate = useTerminatePrice()
  const [target, setTarget] = useState<Charge | null>(null)
  const [form, setForm] = useState<'add' | Charge | null>(null)
  const editing = form !== null && form !== 'add' ? form : null

  const close = () => {
    setTarget(null)
    terminate.reset()
  }
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

  return (
    <>
      <ChargeTable
        charges={charges.data ?? []}
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
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        title="Terminate this charge?"
        description={`“${target?.displayName || target?.meterName || 'This charge'}” will stop billing on this ${noun}. Past invoices that referenced it are unaffected.`}
        confirmLabel="Terminate charge"
        destructive
        isPending={terminate.isPending}
        error={terminate.isError ? 'Could not terminate the charge. Try again.' : null}
        onConfirm={() => {
          if (target) terminate.mutate({ id: target.id }, { onSuccess: () => setTarget(null) })
        }}
      />
    </>
  )
}
