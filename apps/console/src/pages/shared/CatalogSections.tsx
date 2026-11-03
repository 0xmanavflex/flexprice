import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import {
  type Charge,
  type CreateCharge,
  type CreateCreditGrant,
  type CreateEntitlement,
  type CreditGrant,
  type EditCreditGrant,
  type EditEntitlement,
  type Entitlement,
  CreditGrantScope,
  EntitlementEntityType,
  FeatureType,
  PriceEntityType,
  PriceType,
  chargeToDraft,
  creditGrantToEdit,
  entitlementToEdit,
} from '@fp/domain'
import {
  toUpdatePriceRequest,
  useCreateBulkEntitlements,
  useCreateBulkPrices,
  useCreateCreditGrant,
  useCreditGrants,
  useDeleteCreditGrant,
  useDeleteEntitlement,
  useEntitlements,
  usePriceHistory,
  usePrices,
  useUpdateCreditGrant,
  useUpdateEntitlement,
  useUpdatePrice,
} from '@fp/query'
import {
  AddChargeDialog,
  CreditGrantCreateForm,
  CreditGrantEditForm,
  EntitlementCreateForm,
  EntitlementEditForm,
  type FeatureOption,
  PlanChargesView,
  PlanCreditGrantsView,
  PlanEntitlementsView,
  pricingSummary,
} from '@fp/ui/pages'
import { ConfirmDialog, FormDialog } from '@fp/ui/compositions'
import { usePlanFormOptions } from '../plans/planFormOptions'
import { priceHistoryRows, usePlanChargeHistory } from './priceHistory'
import { subTab } from './subTab'
import { TerminateChargeDialog } from './TerminateChargeDialog'

/**
 * The catalogue records that carry charges, entitlements and credit grants
 * together: a plan and an add-on. Both are written through the same
 * endpoints, keyed by entity type (`PLAN` / `ADDON`) or scope (`plan_id` /
 * `addon_id`), so the sections below are one implementation for both.
 */
export type CatalogEntity = 'plan' | 'addon'

const ENTITY: Record<
  CatalogEntity,
  {
    price: PriceEntityType
    entitlement: EntitlementEntityType
    grant: CreditGrantScope
    /** The word the copy uses. */
    noun: string
  }
> = {
  plan: {
    price: PriceEntityType.Plan,
    entitlement: EntitlementEntityType.Plan,
    grant: CreditGrantScope.Plan,
    noun: 'plan',
  },
  addon: {
    price: PriceEntityType.Addon,
    entitlement: EntitlementEntityType.Addon,
    grant: CreditGrantScope.Addon,
    noun: 'add-on',
  },
}

export interface CatalogSectionProps {
  entity: CatalogEntity
  entityId: string
}

/**
 * Charges: what the record bills, as one searchable table. "Add charge" opens
 * a dialog that asks Fixed or Usage first; a row's Edit opens the form
 * directly. An edit is saved as a new price version; terminate ends a charge
 * behind a confirm.
 */
export function CatalogChargesSection({
  entity,
  entityId,
  readOnly,
  emptyDescription,
}: CatalogSectionProps & { readOnly: boolean; emptyDescription?: string }) {
  const { price: entityType, noun } = ENTITY[entity]
  // Ended prices too, so an edited charge keeps its earlier price as history.
  const charges = usePriceHistory(entityType, entityId)
  const { meters, units, priceGroups } = usePlanFormOptions()
  const navigate = useNavigate()
  const create = useCreateBulkPrices()
  const updatePrice = useUpdatePrice()
  const [form, setForm] = useState<'add' | Charge | null>(null)
  const [terminating, setTerminating] = useState<Charge | null>(null)

  const { charges: rows, details } = priceHistoryRows(charges.data ?? [])
  // A charge's versions come from the history API when its sheet opens.
  const chargeHistory = usePlanChargeHistory()
  const loading = charges.isPending || (charges.isError && charges.isFetching)
  const failed = charges.isError && !charges.isFetching
  const editing = form !== null && form !== 'add' ? form : null

  const close = () => {
    setForm(null)
    create.reset()
    updatePrice.reset()
  }

  const submit = (draft: CreateCharge) => {
    if (editing) {
      updatePrice.mutate(
        { id: editing.id, body: toUpdatePriceRequest(draft) },
        { onSuccess: close },
      )
      return
    }
    create.mutate({ entityType, entityId, charges: [draft] }, { onSuccess: close })
  }

  return (
    <>
      <PlanChargesView
        charges={rows}
        details={details}
        {...chargeHistory.table}
        {...(emptyDescription ? { emptyDescription } : {})}
        readOnly={readOnly}
        loading={loading}
        error={failed}
        onRetry={() => void charges.refetch()}
        meterUnit={(id) => meters.find((m) => m.id === id)?.unit}
        onAdd={() => setForm('add')}
        onEdit={(charge) => setForm(charge)}
        onTerminate={(charge) => setTerminating(charge)}
      />

      <AddChargeDialog
        open={form !== null}
        onOpenChange={(open) => {
          if (!open) close()
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

      <TerminateChargeDialog
        charge={terminating}
        noun={noun}
        onClose={() => setTerminating(null)}
      />
    </>
  )
}

/**
 * Entitlements: what the record includes of each feature. The last column
 * shows the record's usage price for a metered feature, found by matching the
 * feature's meter to a usage charge; usage beyond the value bills at that price.
 */
export function CatalogEntitlementsSection({ entity, entityId }: CatalogSectionProps) {
  const { price, entitlement: entityType, noun } = ENTITY[entity]
  const navigate = useNavigate()
  const entitlements = useEntitlements(entityType, entityId)
  const charges = usePrices(price, entityId)
  const { featureOptions, allFeatures } = usePlanFormOptions()
  const create = useCreateBulkEntitlements()
  const updateEntitlement = useUpdateEntitlement()
  const remove = useDeleteEntitlement()
  const [form, setForm] = useState<'add' | Entitlement | null>(null)
  const [removing, setRemoving] = useState<Entitlement | null>(null)

  // Only features not already entitled can be added: a feature is granted once.
  const granted = new Set((entitlements.data ?? []).map((e) => e.featureId))
  const options = featureOptions.filter((f) => !granted.has(f.id))
  const editing = form !== null && form !== 'add' ? form : null
  const editingFeature = editing ? allFeatures.find((f) => f.id === editing.featureId) : undefined
  const editingOption: FeatureOption | undefined = editing
    ? (featureOptions.find((f) => f.id === editing.featureId) ?? {
        id: editing.featureId,
        name: editing.featureName ?? editingFeature?.name ?? 'Feature',
        type: editing.featureType,
      })
    : undefined

  const usagePrice = (entitlement: Entitlement): string | null => {
    if (entitlement.featureType !== FeatureType.Metered) return null
    const meterId = allFeatures.find((f) => f.id === entitlement.featureId)?.meterId
    if (!meterId) return null
    const charge = (charges.data ?? []).find(
      (c) => c.type === PriceType.Usage && c.meterId === meterId,
    )
    return charge
      ? pricingSummary(chargeToDraft(charge), (charge.currency || 'usd').toUpperCase())
      : null
  }

  const close = () => {
    setForm(null)
    create.reset()
    updateEntitlement.reset()
  }

  return (
    <>
      <PlanEntitlementsView
        noun={noun}
        entitlements={entitlements.data ?? []}
        {...subTab(entitlements, 'entitlements')}
        usagePrice={usagePrice}
        onAdd={() => setForm('add')}
        onEdit={(entitlement) => setForm(entitlement)}
        onDelete={(entitlement) => setRemoving(entitlement)}
        onOpenFeature={(featureId) =>
          void navigate({ to: '/features/$featureId', params: { featureId } })
        }
      />

      <FormDialog
        open={form !== null}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        size="md"
        title={editing ? 'Edit entitlement' : 'Add entitlement'}
      >
        {form === null ? null : editing && editingOption ? (
          <EntitlementEditForm
            key={editing.id}
            feature={editingOption}
            defaultValue={entitlementToEdit(editing)}
            usagePrice={usagePrice(editing) ?? undefined}
            onSubmit={(draft: EditEntitlement) =>
              updateEntitlement.mutate({ id: editing.id, draft }, { onSuccess: close })
            }
            onCancel={close}
            isSubmitting={updateEntitlement.isPending}
            submitError={
              updateEntitlement.isError ? 'Could not save the entitlement. Try again.' : null
            }
          />
        ) : (
          <EntitlementCreateForm
            features={options}
            grantModel
            onCreateFeature={() => void navigate({ to: '/features/new' })}
            onSubmit={(draft: CreateEntitlement) =>
              create.mutate({ entityType, entityId, entitlements: [draft] }, { onSuccess: close })
            }
            onCancel={close}
            isSubmitting={create.isPending}
            submitError={create.isError ? 'Could not add the entitlement. Try again.' : null}
          />
        )}
      </FormDialog>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null)
        }}
        title="Remove this entitlement?"
        description={
          removing
            ? `“${removing.featureName ?? 'This feature'}” will no longer be included in the ${noun}.`
            : undefined
        }
        confirmLabel="Remove entitlement"
        destructive
        isPending={remove.isPending}
        error={remove.isError ? 'Could not remove the entitlement. Try again.' : null}
        onConfirm={() => {
          if (removing) remove.mutate(removing.id, { onSuccess: () => setRemoving(null) })
        }}
      />
    </>
  )
}

/** Credit grants: the balances the record hands its subscribers. */
export function CatalogCreditGrantsSection({ entity, entityId }: CatalogSectionProps) {
  const { grant: scope } = ENTITY[entity]
  const grants = useCreditGrants(scope, entityId)
  const create = useCreateCreditGrant()
  const updateGrant = useUpdateCreditGrant()
  const remove = useDeleteCreditGrant()
  const [form, setForm] = useState<'add' | CreditGrant | null>(null)
  const [removing, setRemoving] = useState<CreditGrant | null>(null)

  const editing = form !== null && form !== 'add' ? form : null
  const close = () => {
    setForm(null)
    create.reset()
    updateGrant.reset()
  }

  return (
    <>
      <PlanCreditGrantsView
        grants={grants.data ?? []}
        {...subTab(grants, 'credit grants')}
        onAdd={() => setForm('add')}
        onEdit={(grant) => setForm(grant)}
        onDelete={(grant) => setRemoving(grant)}
      />

      <FormDialog
        open={form !== null}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        size={editing ? 'md' : 'lg'}
        title={editing ? 'Edit credit grant' : 'Add credit grant'}
      >
        {form === null ? null : editing ? (
          <CreditGrantEditForm
            // Any end date archives a plan or add-on grant at once (the API's
            // DeleteCreditGrant), so it is not offered.
            allowEndDate={false}
            key={editing.id}
            defaultValue={creditGrantToEdit(editing)}
            onSubmit={(draft: EditCreditGrant) =>
              updateGrant.mutate({ id: editing.id, draft }, { onSuccess: close })
            }
            onCancel={close}
            isSubmitting={updateGrant.isPending}
            submitError={updateGrant.isError ? 'Could not save the grant. Try again.' : null}
          />
        ) : (
          <CreditGrantCreateForm
            onSubmit={(grant: CreateCreditGrant) =>
              create.mutate({ scope, id: entityId, grant }, { onSuccess: close })
            }
            onCancel={close}
            isSubmitting={create.isPending}
            submitError={create.isError ? 'Could not create the grant. Try again.' : null}
          />
        )}
      </FormDialog>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null)
        }}
        title="Remove this credit grant?"
        description={
          removing
            ? `“${removing.name || 'This grant'}” will stop handing subscribers its balance.`
            : undefined
        }
        confirmLabel="Remove grant"
        destructive
        isPending={remove.isPending}
        error={remove.isError ? 'Could not remove the grant. Try again.' : null}
        onConfirm={() => {
          if (removing) remove.mutate(removing.id, { onSuccess: () => setRemoving(null) })
        }}
      />
    </>
  )
}
