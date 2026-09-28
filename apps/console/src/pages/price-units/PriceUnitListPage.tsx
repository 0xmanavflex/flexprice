import { useState } from 'react'
import { type CreatePriceUnit, type PriceUnit, type PriceUnitQuery } from '@fp/domain'
import { ApiError, useCreatePriceUnit, usePriceUnits, useUpdatePriceUnit } from '@fp/query'
import { PriceUnitEditorSheet, PriceUnitFilters, PriceUnitGrid } from '@fp/ui/flexprice'
import { ListState, PageBody } from '@fp/ui/compositions'
import { CoinsIcon } from 'lucide-react'
import { Button } from '@fp/ui/primitives'

export interface PriceUnitListPageProps {
  query: PriceUnitQuery
  onQueryChange: (query: PriceUnitQuery) => void
  onOpenPriceUnit: (priceUnit: PriceUnit) => void
}

/** Which record the drawer is editing — a new one, or an existing price unit. */
type Editing = { mode: 'create' } | { mode: 'edit'; priceUnit: PriceUnit } | null

/**
 * The price-unit surface: a list, and a drawer to create or edit one.
 *
 * The same shape as `AddonListPage` — V1 keeps price units to a list and a
 * drawer, with no detail page, so this is the whole surface. The list stays
 * URL-driven (a filtered view is a link); the editor is the one piece of local
 * state, because a half-typed unit is not a place worth a URL, and opening it
 * keeps the list behind it rather than navigating away.
 */
export function PriceUnitListPage({
  query,
  onQueryChange,
  onOpenPriceUnit,
}: PriceUnitListPageProps) {
  const priceUnits = usePriceUnits(query)
  const create = useCreatePriceUnit()
  const update = useUpdatePriceUnit()

  const [editing, setEditing] = useState<Editing>(null)

  const failure = toFailure(priceUnits.error)
  const rows = priceUnits.data?.priceUnits ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0

  const active = editing?.mode === 'create' ? create : update
  const clearFilters = () => onQueryChange({ ...query, search: '', statuses: [], page: 1 })

  const close = () => {
    setEditing(null)
    // Drop a stale submit error so the next open starts clean.
    create.reset()
    update.reset()
  }

  const submit = (draft: CreatePriceUnit) => {
    if (editing?.mode === 'create') {
      create.mutate(draft, { onSuccess: close })
    } else if (editing?.mode === 'edit') {
      update.mutate({ id: editing.priceUnit.id, draft }, { onSuccess: close })
    }
  }

  return (
    <>
      <PageBody>
        <ListState
          isLoading={priceUnits.isPending}
          error={failure}
          isEmpty={rows.length === 0 && !isFiltered}
          isFiltered={isFiltered}
          onRetry={() => void priceUnits.refetch()}
          onClearFilters={clearFilters}
          createAction={
            <Button onClick={() => setEditing({ mode: 'create' })}>New price unit</Button>
          }
          emptyIcon={<CoinsIcon aria-hidden />}
          emptyTitle="No price units yet"
          emptyDescription="Price units let you charge in credits, tokens or minutes instead of a currency, each pinned to a base currency by a conversion rate. Create the first to price in one."
        >
          <PriceUnitGrid
            priceUnits={rows}
            total={priceUnits.data?.total ?? 0}
            query={query}
            onQueryChange={onQueryChange}
            onPriceUnitClick={onOpenPriceUnit}
            onCreate={() => setEditing({ mode: 'create' })}
            onClearFilters={clearFilters}
            filters={
              <PriceUnitFilters
                statuses={query.statuses}
                onStatusesChange={(statuses) => onQueryChange({ ...query, statuses, page: 1 })}
              />
            }
          />
        </ListState>
      </PageBody>

      <PriceUnitEditorSheet
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        mode={editing?.mode ?? 'create'}
        {...(editing?.mode === 'edit'
          ? {
              defaultValue: {
                name: editing.priceUnit.name,
                code: editing.priceUnit.code,
                symbol: editing.priceUnit.symbol,
                // Uppercased so the read-only field reads like the currency it is.
                baseCurrency: editing.priceUnit.baseCurrency.toUpperCase(),
                // The rate is a string on the domain model; the form holds a
                // number. It is display-only on edit and never resubmitted (the
                // update payload is name-only), so the parse only has to be
                // valid — a positive fallback keeps the shared schema satisfied.
                conversionRate: Number(editing.priceUnit.conversionRate) || 1,
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

function toFailure(error: unknown): { message: string; canRetry: boolean } | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return { message: 'You do not have access to price units here.', canRetry: false }
      case 'unauthorized':
        return { message: 'Your session has expired. Sign in again.', canRetry: false }
      case 'network':
        return { message: 'Could not reach Flexprice.', canRetry: true }
      case 'server':
        return { message: 'Flexprice had a problem loading price units.', canRetry: true }
      default:
        return { message: error.message, canRetry: false }
    }
  }
  return { message: 'Something went wrong loading price units.', canRetry: true }
}

/** A save failure, as a sentence the form can show inline. */
function toSubmitError(error: unknown): string | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      // 4xx the caller can fix — a duplicate code is the common one, so the
      // server's own message (which names the field) is better than ours.
      case 'invalid':
        return error.message || 'Check the details and try again.'
      case 'forbidden':
        return 'You do not have permission to change price units here.'
      case 'network':
        return 'Could not reach Flexprice. Check your connection and try again.'
      default:
        return 'Could not save the price unit. Try again.'
    }
  }
  return 'Could not save the price unit. Try again.'
}
