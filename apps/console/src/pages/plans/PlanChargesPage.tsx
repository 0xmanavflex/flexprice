import { DEFAULT_FEATURE_QUERY, FeatureType, PriceEntityType } from '@fp/domain'
import { useCreateBulkPrices, useFeatures, usePlan } from '@fp/query'
import { ChargeEditor, type MeterOption } from '@fp/ui/flexprice'
import { LoadingRows, PageBody, PageHeader } from '@fp/ui/compositions'
import { Button } from '@fp/ui/primitives'
import { ChevronLeftIcon } from 'lucide-react'

/**
 * The charges builder — the plan's `/charges` route.
 *
 * A full-page mount of the standalone, stepped `ChargeEditor`: the plan's name
 * and metered features are fetched here and handed down, and a save commits the
 * drafts through the bulk price endpoint before returning to the detail page. It
 * adds charges to the plan — the Overview tab is where existing charges are
 * managed — so it opens empty rather than re-loading what is already priced
 * (which the bulk endpoint would duplicate). The customer-facing preview now
 * lives on the detail page, so the editor here is a focused charge builder.
 */
export interface PlanChargesPageProps {
  planId: string
  onDone: () => void
  onCancel: () => void
}

export function PlanChargesPage({ planId, onDone, onCancel }: PlanChargesPageProps) {
  const plan = usePlan(planId)
  const features = useFeatures(DEFAULT_FEATURE_QUERY)
  const save = useCreateBulkPrices()

  // A usage charge bills against a meter; only metered features have one.
  const meters: MeterOption[] = (features.data?.features ?? [])
    .filter((f) => f.type === FeatureType.Metered && f.meterId)
    .map((f) => ({ id: f.meterId as string, name: f.name }))

  if (plan.isPending) {
    return (
      <PageBody>
        <LoadingRows />
      </PageBody>
    )
  }

  return (
    <>
      <PageHeader
        title={`Add charges — ${plan.data?.name ?? 'Plan'}`}
        description="Price what the plan bills for — pick a charge type, configure it, then review and save."
        breadcrumb={
          <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={onCancel}>
            <ChevronLeftIcon aria-hidden className="size-4" />
            Back to plan
          </Button>
        }
      />
      {/*
        The shell content region is overflow-hidden so list pages can pin their
        own footer. This page reads top to bottom — a tiered charge form is
        taller than the viewport — so the body owns the vertical scroll.
      */}
      <PageBody className="overflow-y-auto">
        <ChargeEditor
          planName={plan.data?.name ?? 'Plan'}
          entityType={PriceEntityType.Plan}
          meters={meters}
          onSave={(charges) =>
            save.mutate(
              { entityType: PriceEntityType.Plan, entityId: planId, charges },
              { onSuccess: onDone },
            )
          }
          onCancel={onCancel}
          isSaving={save.isPending}
          saveError={save.isError ? 'One or more charges were rejected. Check them and try again.' : null}
        />
      </PageBody>
    </>
  )
}
