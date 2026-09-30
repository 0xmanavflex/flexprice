import { useState } from 'react'
import { PriceEntityType } from '@fp/domain'
import { ApiError, useCostSheet, usePrices, useUpdateCostSheet } from '@fp/query'
import { CatalogDetailFrame, CatalogStatusBadge, ChargeTable, CostMarginCard } from '@fp/ui/pages'
import {
  AppFailure,
  DetailList,
  EditableFields,
  EmptyState,
  LoadingRows,
  PageBody,
  Section,
} from '@fp/ui/compositions'
import { CalculatorIcon, ReceiptIcon } from 'lucide-react'

type CostSheetTab = 'costs' | 'information'

export interface CostSheetDetailPageProps {
  costSheetId: string
  /** Open with the details already in edit mode (the list row's Edit). */
  startEditing?: boolean
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
  startEditing = false,
  onNavigateToList,
}: CostSheetDetailPageProps) {
  const costSheet = useCostSheet(costSheetId)
  const prices = usePrices(PriceEntityType.CostSheet, costSheetId)
  const update = useUpdateCostSheet()
  const [editing, setEditing] = useState(startEditing)
  const [tab, setTab] = useState<CostSheetTab>(startEditing ? 'information' : 'costs')

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

  const count = charges?.length ?? data.priceCount

  return (
    <CatalogDetailFrame
      listLabel="Cost sheets"
      onBack={onNavigateToList}
      icon={<CalculatorIcon />}
      title={data.name}
      badges={<CatalogStatusBadge status={data.status} />}
      subtitle={data.description || `${count} ${count === 1 ? 'price' : 'prices'} grouped to measure cost`}
      id={data.lookupKey || data.id}
      primary={{
        label: 'Edit',
        disabled: editing || data.status === 'archived',
        onClick: () => {
          setTab('information')
          setEditing(true)
        },
      }}
      menuLabel="Cost sheet actions"
      menu={[{ id: 'costs', label: 'View costs', onSelect: () => setTab('costs') }]}
      tab={tab}
      onTabChange={(next) => setTab(next as CostSheetTab)}
      tabs={[
        {
          value: 'costs',
          label: 'Costs',
          count,
          content: (
            <div className="flex flex-col gap-6">
              {/* Margin numbers are DEMO_COST_MARGIN: the API carries no revenue/cost totals. */}
              <CostMarginCard />
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
            </div>
          ),
        },
        {
          value: 'information',
          label: 'Information',
          content: (
            <Section title="Information" description="Every attribute of this cost sheet.">
              <EditableFields
                editing={editing}
                onEditingChange={setEditing}
                className="mb-4"
                fields={[
                  { key: 'name', label: 'Name', value: data.name, required: true },
                  {
                    key: 'lookupKey',
                    label: 'Lookup key',
                    value: data.lookupKey ?? '',
                    placeholder: 'No lookup key',
                  },
                  {
                    key: 'description',
                    label: 'Description',
                    value: data.description ?? '',
                    multiline: true,
                    placeholder: 'No description',
                  },
                ]}
                onSave={(changes) =>
                  update.mutateAsync({
                    id: data.id,
                    draft: {
                      name: changes.name ?? data.name,
                      lookupKey: changes.lookupKey ?? data.lookupKey,
                      description: changes.description ?? data.description,
                    },
                  })
                }
              />
              <DetailList
                items={[
                  { label: 'Status', value: <CatalogStatusBadge status={data.status} /> },
                  {
                    label: 'Cost sheet ID',
                    value: <span className="font-mono text-xs">{data.id}</span>,
                  },
                  { label: 'Created', value: formatDate(data.createdAt) },
                  { label: 'Updated', value: formatDate(data.updatedAt) },
                ]}
              />
            </Section>
          ),
        },
      ]}
    />
  )
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
