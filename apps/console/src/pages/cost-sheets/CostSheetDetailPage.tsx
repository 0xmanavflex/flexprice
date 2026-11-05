import { useState } from 'react'
import { CostSheetStatus, PriceEntityType } from '@fp/domain'
import { useCostSheet, useDeleteCostSheet, usePrices, useUpdateCostSheet } from '@fp/query'
import { CatalogDetailFrame, CatalogStatusBadge, CostMarginCard, Pill } from '@fp/ui/pages'
import { ConfirmDialog, EditableCard, MetadataCard } from '@fp/ui/compositions'
import { ArchiveIcon, CalculatorIcon, PencilIcon } from '@fp/ui/icons'
import { detailGate } from '../shared/detailGate'
import { CatalogCharges } from '../shared/CatalogCharges'

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
 * numbers that answer that: how many prices it groups and in what currency:
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
  const remove = useDeleteCostSheet()
  const [archiving, setArchiving] = useState(false)
  const [tab, setTab] = useState<CostSheetTab>(startEditing ? 'information' : 'costs')

  if (!costSheet.data) {
    return detailGate(costSheet, {
      noun: 'this cost sheet',
      listName: 'cost sheets',
      onBack: onNavigateToList,
      recordPath: `/costs/${encodeURIComponent(costSheetId)}`,
    })
  }

  const data = costSheet.data
  const archived = data.status === CostSheetStatus.Archived
  const charges = prices.data ?? null

  const count = charges?.length ?? data.priceCount

  return (
    <CatalogDetailFrame
      listLabel="Cost sheets"
      onBack={onNavigateToList}
      icon={<CalculatorIcon />}
      title={data.name}
      badges={
        <>
          <CatalogStatusBadge status={data.status} />
          <Pill>
            {count} {count === 1 ? 'price' : 'prices'}
          </Pill>
        </>
      }
      id={data.id}
      menuLabel="Cost sheet actions"
      // An archived sheet is kept for its price history and is read-only.
      menu={
        archived
          ? []
          : [
              {
                id: 'edit-details',
                label: 'Edit details',
                icon: <PencilIcon className="text-muted-foreground" aria-hidden />,
                onSelect: () => setTab('information'),
              },
              {
                id: 'archive',
                label: 'Archive',
                icon: <ArchiveIcon aria-hidden />,
                destructive: true,
                onSelect: () => setArchiving(true),
              },
            ]
      }
      tab={tab}
      onTabChange={(next) => setTab(next as CostSheetTab)}
      tabs={[
        {
          value: 'costs',
          label: 'Costs',
          count,
          content: (
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
              <CatalogCharges
                entityType={PriceEntityType.CostSheet}
                entityId={costSheetId}
                noun="cost sheet"
                readOnly={archived}
                title="Costs"
                emptyDescription="Costs added to this cost sheet appear here. None have been added yet."
              />
              {/* No margin source: the API carries no revenue/cost totals, so the card says so. */}
              <CostMarginCard />
            </div>
          ),
        },
        {
          value: 'information',
          label: 'Information',
          content: (
            <div className="grid gap-5 xl:grid-cols-3">
              <EditableCard
                className="xl:col-span-2"
                title="Cost sheet details"
                locked={archived}
                fields={[
                  { key: 'name', label: 'Name', value: data.name, required: true },
                  {
                    key: 'lookupKey',
                    label: 'Lookup key',
                    value: data.lookupKey ?? '',
                    placeholder: 'No lookup key',
                  },
                  {
                    key: 'id',
                    label: 'Cost sheet ID',
                    value: data.id,
                    display: <span className="font-mono text-[13px]">{data.id}</span>,
                    readOnly: true,
                  },
                  {
                    key: 'created',
                    label: 'Created',
                    value: formatDate(data.createdAt),
                    readOnly: true,
                  },
                  {
                    key: 'updated',
                    label: 'Updated',
                    value: formatDate(data.updatedAt),
                    readOnly: true,
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
              <MetadataCard
                metadata={data.metadata ?? {}}
                {...(archived
                  ? {}
                  : {
                      onSave: (metadata: Record<string, string>) =>
                        update.mutateAsync({
                          id: data.id,
                          draft: {
                            name: data.name,
                            lookupKey: data.lookupKey,
                            description: data.description,
                            metadata,
                          },
                        }),
                    })}
              />
            </div>
          ),
        },
      ]}
    >
      <ConfirmDialog
        open={archiving}
        onOpenChange={(open) => {
          if (!open) {
            setArchiving(false)
            remove.reset()
          }
        }}
        title="Archive cost sheet"
        description={`Archive ${data.name}? Prices tagged to it keep their history.`}
        confirmLabel="Archive cost sheet"
        destructive
        isPending={remove.isPending}
        error={remove.isError ? 'Could not archive the cost sheet. Try again.' : null}
        onConfirm={() =>
          remove.mutate(data.id, {
            onSuccess: () => {
              setArchiving(false)
              onNavigateToList()
            },
          })
        }
      />
    </CatalogDetailFrame>
  )
}

function formatDate(value: Date | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(value)
}
