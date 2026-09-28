import { type CostSheet } from '@fp/domain'
import { ApiError, useCostSheet } from '@fp/query'
import { CatalogStatusBadge } from '@fp/ui/flexprice'
import {
  AppFailure,
  DetailList,
  DetailHeader,
  DetailStats,
  EmptyState,
  LoadingRows,
  PageBody,
  Section,
} from '@fp/ui/compositions'
import { ReceiptIcon } from 'lucide-react'

export interface CostSheetDetailPageProps {
  costSheetId: string
  onNavigateToList: () => void
}

/**
 * One cost sheet, in full.
 *
 * A shared header, a Frame stat rail, then the cost sheet's own details and the
 * prices it groups. The details lead, so the page opens on the record itself
 * rather than an empty section. Replaces V1's `CostSheetDetails`, which reaches
 * into `CostSheetApi` directly and hand-rolls its own cards; this fetches
 * through `useCostSheet` and composes the shared detail pieces.
 *
 * Prices show an honest empty state: V2 has no cost-sheet price read hook yet,
 * so the section says so rather than inventing rows — the same stand-in the
 * list pages use for surfaces still being built.
 */
export function CostSheetDetailPage({ costSheetId, onNavigateToList }: CostSheetDetailPageProps) {
  const costSheet = useCostSheet(costSheetId)

  if (costSheet.isPending) {
    return (
      <PageBody>
        <div className="pt-4">
          <LoadingRows />
        </div>
      </PageBody>
    )
  }

  if (costSheet.error) {
    return (
      <PageBody>
        <AppFailure
          title={failureTitle(costSheet.error)}
          detail="The rest of the console still works. Try again, or go back to the list."
          onRetry={() => void costSheet.refetch()}
        />
      </PageBody>
    )
  }

  if (!costSheet.data) {
    return (
      <PageBody>
        <AppFailure
          title="This cost sheet no longer exists"
          detail="It may have been deleted. Everything else in the catalogue still works."
          onRetry={onNavigateToList}
        />
      </PageBody>
    )
  }

  const data = costSheet.data

  return (
    <>
      <DetailHeader
        breadcrumb={
          <button
            type="button"
            onClick={onNavigateToList}
            className="w-fit text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Cost Sheets
          </button>
        }
        title={data.name}
        badges={<CatalogStatusBadge status={data.status} />}
        identifier={data.lookupKey || data.id}
        {...(data.description ? { description: data.description } : {})}
      />

      <PageBody>
        <DetailStats stats={detailStats(data)} />

        <Section title="Information" description="Every attribute of this cost sheet.">
          <DetailList
            items={[
              { label: 'Name', value: data.name },
              { label: 'Lookup key', value: data.lookupKey },
              { label: 'Description', value: data.description, full: true },
              { label: 'Prices', value: pricesLabel(data.priceCount) },
              { label: 'Status', value: <CatalogStatusBadge status={data.status} /> },
              { label: 'Cost sheet ID', value: <span className="font-mono text-xs">{data.id}</span> },
              { label: 'Created', value: formatDate(data.createdAt) },
              { label: 'Updated', value: formatDate(data.updatedAt) },
            ]}
          />
        </Section>

        <Section title="Prices" description="The prices this cost sheet groups to measure cost.">
          <EmptyState
            size="inline"
            icon={<ReceiptIcon aria-hidden />}
            title="No prices yet"
            description="The prices this cost sheet groups will appear here once the price view lands."
          />
        </Section>
      </PageBody>
    </>
  )
}

function detailStats(costSheet: CostSheet) {
  return [
    { label: 'Prices', value: pricesLabel(costSheet.priceCount) },
    { label: 'Status', value: <CatalogStatusBadge status={costSheet.status} /> },
    { label: 'Updated', value: formatDate(costSheet.updatedAt) },
  ]
}

function pricesLabel(count: number): string {
  if (count <= 0) return '—'
  return count === 1 ? '1 price' : `${count} prices`
}

function formatDate(value: Date | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(value)
}

function failureTitle(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return 'You do not have access to this cost sheet.'
      case 'unauthorized':
        return 'Your session has expired. Sign in again.'
      case 'network':
        return 'Could not reach Flexprice.'
      default:
        return 'This cost sheet could not be loaded.'
    }
  }
  return 'This cost sheet could not be loaded.'
}
