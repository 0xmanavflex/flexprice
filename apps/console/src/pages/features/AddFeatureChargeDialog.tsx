import { useNavigate } from '@tanstack/react-router'
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
import { ChargeForm, type MeterOption } from '@fp/ui/pages'
import { Field, FormDialog, OptionCombobox } from '@fp/ui/compositions'
import { PlusIcon } from '@fp/ui/icons'
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
  const { units, priceGroups } = usePlanFormOptions()
  const create = useCreateBulkPrices()
  const navigate = useNavigate()
  const [planId, setPlanId] = useState('')

  // The one meter on offer is this feature's, built from the record already
  // loaded rather than looked up in a page of the catalogue it may not be on.
  const meter: MeterOption[] = feature.meterId
    ? [
        {
          id: feature.meterId,
          name: feature.name,
          ...(feature.unitSingular ? { unit: feature.unitSingular } : {}),
          ...(feature.aggregationType ? { aggregationType: feature.aggregationType } : {}),
          ...(feature.meterBucketSize ? { bucketSize: feature.meterBucketSize } : {}),
        },
      ]
    : []
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
          {({ id, 'aria-describedby': describedBy, 'aria-invalid': invalid }) => (
            <OptionCombobox
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              value={planId}
              onValueChange={setPlanId}
              options={planOptions}
              searchable
              placeholder={plans.isPending ? 'Loading plans…' : 'Search plans…'}
              emptyText="No published plans match."
              createAction={{
                label: 'Create plan',
                icon: <PlusIcon aria-hidden />,
                onSelect: () => {
                  close(false)
                  void navigate({ to: '/plans/new' })
                },
              }}
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
