import { type Charge, type CostSheet, PriceEntityType } from '@fp/domain'
import { ApiError, useCostSheet, usePrices, useUpdateCostSheet } from '@fp/query'
import { CatalogStatusBadge, ChargeTable } from '@fp/ui/pages'
import {
  AppFailure,
  type DetailMetric,
  DetailList,
  DetailShell,
  EmptyState,
  InlineField,
  LoadingRows,
  PageBody,
  Section,
} from '@fp/ui/compositions'
import { Button } from '@fp/ui/primitives'
import { PencilIcon, ReceiptIcon } from 'lucide-react'

export interface CostSheetDetailPageProps {
  costSheetId: string
  onEdit: (costSheetId: string) => void
  onNavigateToList: () => void
}

/**
 * One cost sheet, in full.
 *
 * A cost sheet exists to weigh cost against price, so the page leads with the
 * numbers that answer that — how many prices it groups and in what currency —
 * then lists the record itself and the prices it collects. The prices are read
 * through the same `usePrices` hook and `ChargeTable` the plan and add-on use,
 * with `PriceEntityType.CostSheet`; where the corpus carries no cost-sheet
 * prices the table is honestly empty rather than a permanent "coming soon" stub.
 *
 * No blended margin or total appears, deliberately: `@fp/domain`'s money module
 * forbids client-side arithmetic on money (totals are the backend's answer, and
 * a UI that recomputes them drifts from the invoice), and the API sends neither
 * a list price nor a total for a cost sheet. Inventing one would be exactly the
 * fabricated metric the detail-page audit warns against.
 */
export function CostSheetDetailPage({
  costSheetId,
  onEdit,
  onNavigateToList,
}: CostSheetDetailPageProps) {
  const costSheet = useCostSheet(costSheetId)
  const prices = usePrices(PriceEntityType.CostSheet, costSheetId)
  const update = useUpdateCostSheet()

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
  const charges = prices.data ?? null

  return (
    <DetailShell
      breadcrumb={
        <button
          type="button"
          onClick={onNavigateToList}
          className="text-muted-foreground hover:text-foreground w-fit text-xs transition-colors"
        >
          ← Cost Sheets
        </button>
      }
      title={data.name}
      badges={<CatalogStatusBadge status={data.status} />}
      identifier={data.lookupKey || data.id}
      {...(data.description ? { description: data.description } : {})}
      actions={
        <Button variant="outline" size="sm" onClick={() => onEdit(costSheetId)}>
          <PencilIcon aria-hidden className="size-4" />
          Edit
        </Button>
      }
      metrics={costSheetMetrics(data, charges)}
    >
      <Section title="Information" description="Every attribute of this cost sheet.">
        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <InlineField
            label="Name"
            value={data.name}
            required
            onSave={(name) =>
              update.mutateAsync({
                id: data.id,
                draft: { name, lookupKey: data.lookupKey, description: data.description },
              })
            }
          />
          <InlineField
            label="Description"
            value={data.description ?? ''}
            multiline
            placeholder="No description"
            onSave={(description) =>
              update.mutateAsync({
                id: data.id,
                draft: { name: data.name, lookupKey: data.lookupKey, description },
              })
            }
          />
        </div>
        <DetailList
          items={[
            { label: 'Lookup key', value: data.lookupKey || '—' },
            { label: 'Status', value: <CatalogStatusBadge status={data.status} /> },
            { label: 'Cost sheet ID', value: <span className="font-mono text-xs">{data.id}</span> },
            { label: 'Created', value: formatDate(data.createdAt) },
            { label: 'Updated', value: formatDate(data.updatedAt) },
          ]}
        />
      </Section>

      <Section title="Prices" description="The prices this cost sheet groups to measure cost.">
        {prices.isPending ? (
          <LoadingRows />
        ) : charges && charges.length > 0 ? (
          <ChargeTable charges={charges} />
        ) : (
          <EmptyState
            size="inline"
            icon={<ReceiptIcon aria-hidden />}
            title="No prices yet"
            description="Prices tagged to this cost sheet will appear here. None have been added to it yet."
          />
        )}
      </Section>
    </DetailShell>
  )
}

/**
 * The rail: how much this cost sheet covers, in real numbers.
 *
 * Price count and currency come from the prices the sheet actually groups —
 * never its status, lookup key or timestamps, which live in the header and the
 * Information list. No total: money is not summed client-side (see the file
 * note), and the API sends none.
 */
function costSheetMetrics(data: CostSheet, charges: Charge[] | null): DetailMetric[] {
  const count = charges?.length ?? data.priceCount
  const metrics: DetailMetric[] = [
    {
      label: 'Prices',
      value: new Intl.NumberFormat().format(count),
      hint: 'grouped to measure cost',
    },
  ]

  if (charges && charges.length > 0) {
    const currencies = [
      ...new Set(charges.map((charge) => charge.currency.toUpperCase()).filter(Boolean)),
    ]
    const [only] = currencies
    if (currencies.length === 1 && only) {
      metrics.push({ label: 'Currency', value: only })
    } else if (currencies.length > 1) {
      metrics.push({ label: 'Currencies', value: currencies.length })
    }
  }

  return metrics
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
