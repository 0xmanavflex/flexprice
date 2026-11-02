import { useRef, useState } from 'react'
import {
  ApiError,
  useCreateBulkEntitlements,
  useCreateBulkPrices,
  useCreateCreditGrant,
  usePlan,
  useUpdatePlan,
  useCreatePlan,
  serverReason,
} from '@fp/query'
import {
  CreditGrantScope,
  EntitlementEntityType,
  PriceEntityType,
  type CreatePlan,
} from '@fp/domain'
import { PlanForm, type PlanFormValue } from '@fp/ui/pages'
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
 * transaction. Once the plan exists, a later write that fails still leaves this
 * screen: the plan is already saved, and what is left is added on the plan page.
 */
export function PlanFormPage(props: PlanFormPageProps) {
  const { step, onStepChange, onCancel } = props
  const createPlan = useCreatePlan()
  const updatePlan = useUpdatePlan()
  const createPrices = useCreateBulkPrices()
  const createEntitlements = useCreateBulkEntitlements()
  const createGrant = useCreateCreditGrant()
  const existing = usePlan(props.mode === 'edit' ? props.planId : '')
  const { meters, units, priceGroups, featureOptions } = usePlanFormOptions()
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
        // The plan row is already stored. Staying here only offers another
        // press of Create plan, which cannot recreate it.
        if (p.planId) {
          props.onDone(p.planId)
          return
        }
        setFailure(toSubmitError(error))
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
        priceGroups={priceGroups}
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
        { label: 'Plan details', onClick: () => props.onDone(plan.id) },
        { label: 'Edit' },
      ]}
      {...stepProps}
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
        return serverReason(error) ?? 'You do not have permission to change plans here.'
      case 'network':
        return 'Could not reach Flexprice. Check your connection and try again.'
      default:
        return serverReason(error) ?? 'Could not save the plan. Try again.'
    }
  }
  return 'Could not save the plan. Try again.'
}
