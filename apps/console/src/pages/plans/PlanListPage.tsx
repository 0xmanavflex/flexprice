import { useState } from 'react'
import { type CreatePlan, type Plan, type PlanQuery } from '@fp/domain'
import { ApiError, useCatalogStats, useCreatePlan, usePlans, useUpdatePlan } from '@fp/query'
import { PlanEditorSheet, PlanFilters, PlanGrid, StatCards } from '@fp/ui/flexprice'
import { ListState, PageBody, PageHeader } from '@fp/ui/compositions'
import { PackageIcon } from 'lucide-react'
import { Button } from '@fp/ui/primitives'

export interface PlanListPageProps {
  query: PlanQuery
  onQueryChange: (query: PlanQuery) => void
}

/** Which record the drawer is editing — a new one, or an existing plan. */
type Editing = { mode: 'create' } | { mode: 'edit'; plan: Plan } | null

/**
 * The plan surface: a list, and a drawer to create or edit one's details.
 *
 * Replaces V1's `Plans.tsx`, which owns drawer state and reaches into `PlanApi`
 * directly. The list stays URL-driven — a filtered view is a link — and the
 * editor is the one piece of local state, opened over the list rather than
 * navigating away. Charges, entitlements and credit grants are a later surface.
 */
export function PlanListPage({ query, onQueryChange }: PlanListPageProps) {
  const plans = usePlans(query)
  const stats = useCatalogStats('plans')
  const create = useCreatePlan()
  const update = useUpdatePlan()

  const [editing, setEditing] = useState<Editing>(null)

  const failure = toFailure(plans.error)
  const rows = plans.data?.plans ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0

  const active = editing?.mode === 'create' ? create : update
  const clearFilters = () => onQueryChange({ ...query, search: '', statuses: [], page: 1 })

  const close = () => {
    setEditing(null)
    create.reset()
    update.reset()
  }

  const submit = (draft: CreatePlan) => {
    if (editing?.mode === 'create') {
      create.mutate(draft, { onSuccess: close })
    } else if (editing?.mode === 'edit') {
      update.mutate({ id: editing.plan.id, draft }, { onSuccess: close })
    }
  }

  return (
    <>
      <PageHeader
        title="Plans"
        description="What you sell, and what each plan charges for."
        action={<Button onClick={() => setEditing({ mode: 'create' })}>New plan</Button>}
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
          createAction={<Button onClick={() => setEditing({ mode: 'create' })}>New plan</Button>}
          emptyIcon={<PackageIcon aria-hidden />}
          emptyTitle="No plans yet"
          emptyDescription="Plans are what customers subscribe to. Each one carries charges, entitlements and credit grants — create the first to start selling."
        >
          <PlanGrid
            plans={rows}
            total={plans.data?.total ?? 0}
            query={query}
            onQueryChange={onQueryChange}
            onPlanClick={(plan) => setEditing({ mode: 'edit', plan })}
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
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        mode={editing?.mode ?? 'create'}
        {...(editing?.mode === 'edit'
          ? {
              defaultValue: {
                name: editing.plan.name,
                lookupKey: editing.plan.lookupKey,
                description: editing.plan.description,
              },
            }
          : {})}
        onSubmit={submit}
        isSubmitting={active.isPending}
        submitError={toSubmitError(active.error)}
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
