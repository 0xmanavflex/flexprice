import { useState } from 'react'
import {
  DEFAULT_PLAN_QUERY,
  EntitlementEntityType,
  FeatureType,
  PlanStatus,
  type CreateEntitlement,
  type Feature,
} from '@fp/domain'
import { useCreateBulkEntitlements, usePlans } from '@fp/query'
import { EntitlementCreateForm } from '@fp/ui/pages'
import { Field, FormDialog, OptionSelect } from '@fp/ui/compositions'

export interface FeatureEntitlementDialogProps {
  /** The feature the entitlement grants; null keeps the dialog closed. */
  feature: Feature | null
  onClose: () => void
}

/**
 * "Add entitlement" from a feature row: the entitlement form with that feature
 * already chosen, and a plan picker above it: an entitlement always belongs
 * to a plan, so the plan is the one thing left to choose.
 */
export function FeatureEntitlementDialog({ feature, onClose }: FeatureEntitlementDialogProps) {
  const plans = usePlans(
    { ...DEFAULT_PLAN_QUERY, page: 1, pageSize: 100 },
    {
      enabled: feature !== null,
    },
  )
  const create = useCreateBulkEntitlements()
  const [planId, setPlanId] = useState('')
  const [planError, setPlanError] = useState<string | null>(null)

  const close = () => {
    setPlanId('')
    setPlanError(null)
    create.reset()
    onClose()
  }

  const planOptions = (plans.data?.plans ?? [])
    .filter((plan) => plan.status === PlanStatus.Published)
    .map((plan) => ({ value: plan.id, label: plan.name }))

  const submit = (draft: CreateEntitlement) => {
    if (!planId) {
      setPlanError('Choose the plan that grants it')
      return
    }
    create.mutate(
      { entityType: EntitlementEntityType.Plan, entityId: planId, entitlements: [draft] },
      { onSuccess: close },
    )
  }

  return (
    <FormDialog
      open={feature !== null}
      onOpenChange={(open) => {
        if (!open) close()
      }}
      size="md"
      title="Add entitlement"
    >
      {feature ? (
        <div className="flex flex-col gap-5">
          <Field
            label="Plan"
            hint="The plan that grants this feature."
            required
            error={planError ?? undefined}
          >
            {({ id, ...field }) => (
              <OptionSelect
                id={id}
                {...field}
                value={planId || undefined}
                onValueChange={(value) => {
                  setPlanId(value)
                  setPlanError(null)
                }}
                options={planOptions}
                placeholder={plans.isPending ? 'Loading plans…' : 'Select a plan'}
                disabled={plans.isPending || create.isPending}
              />
            )}
          </Field>
          <EntitlementCreateForm
            key={feature.id}
            grantModel
            features={[
              {
                id: feature.id,
                name: feature.name,
                type: feature.type,
                ...(feature.type === FeatureType.Metered && feature.unitPlural
                  ? { unit: feature.unitPlural }
                  : {}),
              },
            ]}
            defaultFeatureId={feature.id}
            onSubmit={submit}
            onCancel={close}
            isSubmitting={create.isPending}
            submitError={create.isError ? 'Could not add the entitlement. Try again.' : null}
          />
        </div>
      ) : null}
    </FormDialog>
  )
}
