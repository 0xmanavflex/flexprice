import { useState } from 'react'
import { type CreatePlan, type PlanQuery } from '@fp/domain'
import { ApiError, useCatalogStats, useCreatePlan, usePlans } from '@fp/query'
import { PlanEditorSheet, PlanFilters, PlanGrid, StatCards } from '@fp/ui/flexprice'
import { ListState, PageBody, PageHeader } from '@fp/ui/compositions'
import { PackageIcon } from 'lucide-react'
import { Button } from '@fp/ui/primitives'

export interface PlanListPageProps {
  query: PlanQuery
  onQueryChange: (query: PlanQuery) => void
  /** Open a plan's detail page. A row click, and where a new plan lands. */
  onOpenPlan: (planId: string) => void
}

/**
 * The plan surface: a list, and a drawer to create one's details.
 *
 * Replaces V1's `Plans.tsx`. The list stays URL-driven — a filtered view is a
 * link — and a row now opens the plan's *detail page*, the hub where charges,
 * entitlements and credit grants are added. Creating a plan is still the one
 * piece of local state, a drawer over the list; on success it navigates to the
 * new plan's detail page, because a plan that bills nothing yet is only half
 * made and the next step is to price it.
 */
export function PlanListPage({ query, onQueryChange, onOpenPlan }: PlanListPageProps) {
  const plans = usePlans(query)
  const stats = useCatalogStats('plans')
  const create = useCreatePlan()

  const [creating, setCreating] = useState(false)

  const failure = toFailure(plans.error)
  const rows = plans.data?.plans ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0

  const clearFilters = () => onQueryChange({ ...query, search: '', statuses: [], page: 1 })

  const close = () => {
    setCreating(false)
    create.reset()
  }

  const submit = (draft: CreatePlan) => {
    create.mutate(draft, {
      onSuccess: (result) => {
        close()
        const id = (result as { id?: string }).id
        if (id) onOpenPlan(id)
      },
    })
  }

  return (
    <>
      <PageHeader
        title="Plans"
        description="What you sell, and what each plan charges for."
        action={<Button onClick={() => setCreating(true)}>New plan</Button>}
      />

      <PageBody>
        {/* The list's shape, before its rows — hidden only once the total is
            confirmed zero, so a first-run empty state stays clean. */}
        {stats.total !== 0 ? (
          <StatCards
            isLoading={stats.isPending}
            stats={[
              { label: 'Plans', value: stats.total },
              { label: 'Published', value: stats.published },
              { label: 'Archived', value: stats.archived },
            ]}
          />
        ) : null}

        <ListState
          isLoading={plans.isPending}
          error={failure}
          isEmpty={rows.length === 0 && !isFiltered}
          isFiltered={isFiltered}
          onRetry={() => void plans.refetch()}
          onClearFilters={clearFilters}
          createAction={<Button onClick={() => setCreating(true)}>New plan</Button>}
          emptyIcon={<PackageIcon aria-hidden />}
          emptyTitle="No plans yet"
          emptyDescription="Plans are what customers subscribe to. Each one carries charges, entitlements and credit grants — create the first to start selling."
        >
          <PlanGrid
            plans={rows}
            total={plans.data?.total ?? 0}
            query={query}
            onQueryChange={onQueryChange}
            onPlanClick={(plan) => onOpenPlan(plan.id)}
            onClearFilters={clearFilters}
            filters={
              <PlanFilters
                statuses={query.statuses}
                onStatusesChange={(statuses) => onQueryChange({ ...query, statuses, page: 1 })}
              />
            }
          />
        </ListState>
      </PageBody>

      <PlanEditorSheet
        open={creating}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        mode="create"
        onSubmit={submit}
        isSubmitting={create.isPending}
        submitError={toSubmitError(create.error)}
      />
    </>
  )
}

/** A failure, as a sentence and a judgement about whether retrying can help. */
function toFailure(error: unknown): { message: string; canRetry: boolean } | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return { message: 'You do not have access to plans here.', canRetry: false }
      case 'unauthorized':
        return { message: 'Your session has expired. Sign in again.', canRetry: false }
      case 'network':
        return { message: 'Could not reach Flexprice.', canRetry: true }
      case 'server':
        return { message: 'Flexprice had a problem loading plans.', canRetry: true }
      default:
        return { message: error.message, canRetry: false }
    }
  }
  return { message: 'Something went wrong loading plans.', canRetry: true }
}

/** A save failure, as a sentence the form can show inline. */
function toSubmitError(error: unknown): string | null {
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
