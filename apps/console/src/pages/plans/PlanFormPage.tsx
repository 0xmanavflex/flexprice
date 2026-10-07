import { useRef, useState } from 'react'
import {
  ApiError,
  useCreateBulkEntitlements,
  useCreateBulkPrices,
  useCreateCreditGrant,
  useCreditGrants,
  useEntitlements,
  usePlan,
  usePrices,
  useUpdatePlan,
  useCreatePlan,
} from '@fp/query'
import {
  CreditGrantScope,
  EntitlementEntityType,
  PriceEntityType,
  type CreatePlan,
} from '@fp/domain'
import { PlanCustomerPreview, PlanForm, type PlanFormValue } from '@fp/ui/pages'
import { AppFailure, LoadingRows, PageBody } from '@fp/ui/compositions'
import { usePlanFormOptions } from './planFormOptions'

export type PlanFormPageProps = {
  step?: string
  onStepChange: (id: string) => void
  onCancel: () => void
} & (
  | { mode: 'create'; onDone: (planId: string) => void }
  | { mode: 'edit'; planId: string; onDone: (planId: string) => void }
)

/**
 * Create or edit a plan on its own page.
 *
 * Create writes the plan, then the charges, entitlements and credit grants the
 * person staged, with the same hooks the plan page uses. The writes are not one
 * transaction, so progress is remembered: if a later write fails, the plan is
 * not created twice on retry and only what is left is resent.
 */
export function PlanFormPage(props: PlanFormPageProps) {
  const { step, onStepChange, onCancel } = props
  const createPlan = useCreatePlan()
  const updatePlan = useUpdatePlan()
  const createPrices = useCreateBulkPrices()
  const createEntitlements = useCreateBulkEntitlements()
  const createGrant = useCreateCreditGrant()
  const existing = usePlan(props.mode === 'edit' ? props.planId : '')
  const { meters, units, featureOptions } = usePlanFormOptions()
  const savedId = props.mode === 'edit' ? props.planId : ''
  const savedCharges = usePrices(PriceEntityType.Plan, savedId)
  const savedEntitlements = useEntitlements(EntitlementEntityType.Plan, savedId)
  const savedGrants = useCreditGrants(CreditGrantScope.Plan, savedId)
  const progress = useRef<{
    planId: string
    charges: boolean
    entitlements: boolean
    grants: number
  }>({
    planId: '',
    charges: false,
    entitlements: false,
    grants: 0,
  })
  const [failure, setFailure] = useState<string | null>(null)

  const stepProps = { ...(step ? { step } : {}), onStepChange, onCancel }

  if (props.mode === 'create') {
    const submit = async (value: PlanFormValue) => {
      const p = progress.current
      setFailure(null)
      try {
        if (!p.planId) {
          const created = await createPlan.mutateAsync(value.plan)
          p.planId = (created as { id?: string }).id ?? ''
        }
        if (value.charges.length > 0 && !p.charges) {
          await createPrices.mutateAsync({
            entityType: PriceEntityType.Plan,
            entityId: p.planId,
            charges: value.charges,
          })
          p.charges = true
        }
        if (value.entitlements.length > 0 && !p.entitlements) {
          await createEntitlements.mutateAsync({
            entityType: EntitlementEntityType.Plan,
            entityId: p.planId,
            entitlements: value.entitlements,
          })
          p.entitlements = true
        }
        while (p.grants < value.creditGrants.length) {
          const grant = value.creditGrants[p.grants]
          if (!grant) break
          await createGrant.mutateAsync({ scope: CreditGrantScope.Plan, id: p.planId, grant })
          p.grants += 1
        }
        props.onDone(p.planId)
      } catch (error) {
        setFailure(
          p.planId
            ? 'The plan was created, but some of its charges, entitlements or credit grants could not be saved. Press Create plan to retry what is left, or finish on the plan page.'
            : toSubmitError(error),
        )
      }
    }
    const busy =
      createPlan.isPending ||
      createPrices.isPending ||
      createEntitlements.isPending ||
      createGrant.isPending
    return (
      <PlanForm
        mode="create"
        trail={[{ label: 'Plans', onClick: onCancel }, { label: 'Create plan' }]}
        {...stepProps}
        meters={meters}
        priceUnits={units}
        features={featureOptions}
        isSubmitting={busy}
        submitError={failure}
        onSubmit={(value) => void submit(value)}
      />
    )
  }

  if (existing.isPending) {
    return (
      <PageBody>
        <div className="pt-4">
          <LoadingRows />
        </div>
      </PageBody>
    )
  }
  if (existing.error || !existing.data) {
    return (
      <PageBody>
        <AppFailure
          title="This plan could not be loaded"
          detail="Try again, or go back."
          onRetry={existing.error ? () => void existing.refetch() : onCancel}
        />
      </PageBody>
    )
  }

  const plan = existing.data
  return (
    <PlanForm
      mode="edit"
      planName={plan.name}
      defaultValue={{ name: plan.name, lookupKey: plan.lookupKey, description: plan.description }}
      trail={[
        { label: 'Plans', onClick: onCancel },
        { label: plan.name, onClick: () => props.onDone(plan.id) },
        { label: 'Edit' },
      ]}
      {...stepProps}
      savedPreview={
        <PlanCustomerPreview
          charges={savedCharges.data ?? []}
          entitlements={savedEntitlements.data ?? []}
          grants={savedGrants.data ?? []}
          meterUnit={(id) => meters.find((m) => m.id === id)?.unit}
          featureUnit={(id) => featureOptions.find((f) => f.id === id)?.unit}
        />
      }
      isSubmitting={updatePlan.isPending}
      submitError={updatePlan.error ? toSubmitError(updatePlan.error) : null}
      onSubmit={({ plan: draft }: { plan: CreatePlan }) =>
        updatePlan.mutate({ id: plan.id, draft }, { onSuccess: () => props.onDone(plan.id) })
      }
    />
  )
}

/** A save failure, as a sentence the form can show inline. */
export function toSubmitError(error: unknown): string | null {
  if (!error) return null
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'invalid':
        return error.message || 'Check the details and try again.'
      case 'forbidden':
        return 'You do not have permission to change plans here.'
      case 'network':
        return 'Could not reach Flexprice. Check your connection and try again.'
      default:
        return 'Could not save the plan. Try again.'
    }
  }
  return 'Could not save the plan. Try again.'
}
