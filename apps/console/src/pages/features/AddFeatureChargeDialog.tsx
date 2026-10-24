import { useState } from 'react'
import {
  BillingModel,
  DEFAULT_PLAN_QUERY,
  PlanStatus,
  PriceEntityType,
  PriceType,
  emptyCharge,
  type Feature,
} from '@fp/domain'
import { useCreateBulkPrices, usePlans } from '@fp/query'
import { ChargeForm } from '@fp/ui/pages'
import { Field, FormDialog, OptionSelect } from '@fp/ui/compositions'
import { usePlanFormOptions } from '../plans/planFormOptions'

/**
 * "Add charge" on a metered feature: bill this feature's usage on an existing
 * plan. The plan is chosen first; the charge form below is the usual one, as a
 * usage charge on this feature's meter, which cannot be changed here.
 */
export function AddFeatureChargeDialog({
  feature,
  open,
  onOpenChange,
  onAdded,
}: {
  feature: Feature
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded?: () => void
}) {
  const plans = usePlans({ ...DEFAULT_PLAN_QUERY, pageSize: 100, statuses: [PlanStatus.Published] })
  const { meters, units, priceGroups } = usePlanFormOptions()
  const create = useCreateBulkPrices()
  const [planId, setPlanId] = useState('')

  const meter = meters.filter((option) => option.id === feature.meterId)
  const planOptions = (plans.data?.plans ?? []).map((plan) => ({
    value: plan.id,
    label: plan.name,
  }))

  const close = (next: boolean) => {
    if (!next) {
      setPlanId('')
      create.reset()
    }
    onOpenChange(next)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={close}
      size="lg"
      title={`Add a charge for ${feature.name}`}
      isPending={create.isPending}
    >
      <div className="flex flex-col gap-5">
        <Field label="Plan" required hint="The plan that bills this feature's usage.">
          {({ id, ...field }) => (
            <OptionSelect
              id={id}
              {...field}
              value={planId}
              onValueChange={setPlanId}
              options={planOptions}
              placeholder={plans.isPending ? 'Loading plans…' : 'Choose a plan'}
              disabled={create.isPending}
            />
          )}
        </Field>
        {planId ? (
          <ChargeForm
            key={planId}
            mode="create"
            defaultValue={{
              ...emptyCharge(PriceType.Usage, BillingModel.FlatFee),
              meterId: feature.meterId ?? '',
            }}
            lockType
            meters={meter}
            priceUnits={units}
            priceOptions={{ groups: priceGroups }}
            onSubmit={(draft) =>
              create.mutate(
                { entityType: PriceEntityType.Plan, entityId: planId, charges: [draft] },
                {
                  onSuccess: () => {
                    close(false)
                    onAdded?.()
                  },
                },
              )
            }
            onCancel={() => close(false)}
            isSubmitting={create.isPending}
            submitError={create.isError ? 'The charge was rejected. Check it and try again.' : null}
          />
        ) : null}
      </div>
    </FormDialog>
  )
}
