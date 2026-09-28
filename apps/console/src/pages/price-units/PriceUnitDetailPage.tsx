import { useState } from 'react'
import { type CreatePriceUnit, type PriceUnit } from '@fp/domain'
import { ApiError, usePriceUnit, useUpdatePriceUnit } from '@fp/query'
import { CatalogStatusBadge, PriceUnitEditorSheet } from '@fp/ui/flexprice'
import {
  AppFailure,
  DetailList,
  DetailHeader,
  DetailStats,
  LoadingRows,
  PageBody,
  Section,
} from '@fp/ui/compositions'
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@fp/ui/primitives'

export interface PriceUnitDetailPageProps {
  priceUnitId: string
  onNavigateToList: () => void
}

/**
 * One price unit, in full.
 *
 * The reference detail page: a shared header, a Frame stat rail, then tabbed
 * sections — Overview (how this unit converts to its base currency) and
 * Information (every attribute). V1 keeps price units in a list and a drawer
 * with no detail page, so there is nothing to replace here; this fetches
 * through `usePriceUnit` and composes the shared detail pieces the way the
 * other catalogue detail pages do.
 *
 * There is no Charges or Entitlements section: a price unit is a rate anchor,
 * not something plans and prices link to directly, so the two tabs cover it
 * without an honest-empty-state stand-in.
 */
export function PriceUnitDetailPage({ priceUnitId, onNavigateToList }: PriceUnitDetailPageProps) {
  const priceUnit = usePriceUnit(priceUnitId)
  const update = useUpdatePriceUnit()
  const [editing, setEditing] = useState(false)

  if (priceUnit.isPending) {
    return (
      <PageBody>
        <div className="pt-4">
          <LoadingRows />
        </div>
      </PageBody>
    )
  }

  if (priceUnit.error) {
    return (
      <PageBody>
        <AppFailure
          title={failureTitle(priceUnit.error)}
          detail="The rest of the console still works. Try again, or go back to the list."
          onRetry={() => void priceUnit.refetch()}
        />
      </PageBody>
    )
  }

  if (!priceUnit.data) {
    return (
      <PageBody>
        <AppFailure
          title="This price unit no longer exists"
          detail="It may have been deleted. Everything else in the catalogue still works."
          onRetry={onNavigateToList}
        />
      </PageBody>
    )
  }

  const data = priceUnit.data
  const baseCurrency = data.baseCurrency ? data.baseCurrency.toUpperCase() : null
  const conversionSentence =
    data.conversionRate && baseCurrency
      ? `One ${data.code || 'unit'} converts to ${data.conversionRate} ${baseCurrency}.`
      : 'How this unit converts to its base currency.'

  const closeEditor = () => {
    setEditing(false)
    update.reset()
  }

  // The update payload is name-only; the rest is shown so the drawer reads like
  // the unit it edits. The rate is a string on the domain model and a number on
  // the form, so it is parsed with a positive fallback to satisfy the schema.
  const submit = (draft: CreatePriceUnit) => {
    update.mutate({ id: data.id, draft }, { onSuccess: closeEditor })
  }

  return (
    <>
      <DetailHeader
        breadcrumb={
          <button
            type="button"
            onClick={onNavigateToList}
            className="w-fit text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Price Units
          </button>
        }
        title={data.name}
        badges={<CatalogStatusBadge status={data.status} />}
        identifier={data.code || data.id}
        actions={<Button onClick={() => setEditing(true)}>Edit</Button>}
      />

      <PageBody>
        <DetailStats stats={detailStats(data)} />

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="information">Information</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex flex-col gap-4 pt-2">
            <Section title="Conversion" description={conversionSentence}>
              <DetailList
                items={[
                  { label: 'Code', value: data.code ? <span className="font-mono">{data.code}</span> : null },
                  { label: 'Symbol', value: data.symbol },
                  { label: 'Base currency', value: baseCurrency },
                  { label: 'Conversion rate', value: data.conversionRate },
                ]}
              />
            </Section>
          </TabsContent>

          <TabsContent value="information" className="pt-2">
            <Section title="Information" description="Every attribute of this price unit.">
              <DetailList
                items={[
                  { label: 'Name', value: data.name },
                  { label: 'Code', value: data.code ? <span className="font-mono">{data.code}</span> : null },
                  { label: 'Symbol', value: data.symbol },
                  { label: 'Base currency', value: baseCurrency },
                  { label: 'Conversion rate', value: data.conversionRate },
                  { label: 'Status', value: <CatalogStatusBadge status={data.status} /> },
                  { label: 'Price unit ID', value: <span className="font-mono text-xs">{data.id}</span> },
                  { label: 'Created', value: formatDate(data.createdAt) },
                  { label: 'Updated', value: formatDate(data.updatedAt) },
                ]}
              />
            </Section>
          </TabsContent>
        </Tabs>
      </PageBody>

      <PriceUnitEditorSheet
        open={editing}
        onOpenChange={(open) => {
          if (!open) closeEditor()
        }}
        mode="edit"
        defaultValue={{
          name: data.name,
          code: data.code,
          symbol: data.symbol,
          baseCurrency: data.baseCurrency.toUpperCase(),
          conversionRate: Number(data.conversionRate) || 1,
        }}
        onSubmit={submit}
        isSubmitting={update.isPending}
        submitError={toSubmitError(update.error)}
      />
    </>
  )
}

function detailStats(unit: PriceUnit) {
  return [
    { label: 'Code', value: unit.code || '—' },
    { label: 'Symbol', value: unit.symbol || '—' },
    { label: 'Base currency', value: unit.baseCurrency ? unit.baseCurrency.toUpperCase() : '—' },
    { label: 'Conversion rate', value: unit.conversionRate || '—' },
  ]
}

function formatDate(value: Date | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(value)
}

function failureTitle(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return 'You do not have access to this price unit.'
      case 'unauthorized':
        return 'Your session has expired. Sign in again.'
      case 'network':
        return 'Could not reach Flexprice.'
      default:
        return 'This price unit could not be loaded.'
    }
  }
  return 'This price unit could not be loaded.'
}

/** A save failure, as a sentence the editor can show inline. */
function toSubmitError(error: unknown): string | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
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
