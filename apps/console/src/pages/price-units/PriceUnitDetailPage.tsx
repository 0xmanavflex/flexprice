import { useState } from 'react'
import { formatMoney, money } from '@fp/domain'
import { useDeletePriceUnit, usePriceUnit, useUpdatePriceUnit } from '@fp/query'
import { CatalogDetailFrame, CatalogStatusBadge, Pill } from '@fp/ui/pages'
import { ConfirmDialog, EditableCard, MetadataCard, Section } from '@fp/ui/compositions'
import { ArchiveIcon, CoinsIcon, PencilIcon } from '@fp/ui/icons'
import { detailGate } from '../shared/detailGate'

export interface PriceUnitDetailPageProps {
  priceUnitId: string
  /** Open with the details already in edit mode. */
  startEditing?: boolean
  onNavigateToList: () => void
}

/** A round quantity for the worked example: enough to make the total read clearly. */
const SAMPLE_QUANTITY = 1000

/**
 * One price unit, in full.
 *
 * A price unit is a rate anchor: a code and symbol pinned to a base currency
 * through a conversion rate: so it is a small entity, and this page is
 * deliberately small to match. One `DetailShell` header, one **Conversion**
 * section with a live worked example ("1 CRD = $0.01 → 1,000 CRD = $10.00"), and
 * one **Information** list of every attribute. No tabs and no rail: the earlier
 * version rendered the same four fields three times over, which this replaces.
 *
 * The name is all the backend lets change, so it is edited in place (the pencil
 * beside it, or the header Edit); everything else is shown read-only in the lists
 * below. There is no Edit page, because there is nothing else to edit.
 */
export function PriceUnitDetailPage({
  priceUnitId,
  startEditing = false,
  onNavigateToList,
}: PriceUnitDetailPageProps) {
  const priceUnit = usePriceUnit(priceUnitId)
  const update = useUpdatePriceUnit()
  const remove = useDeletePriceUnit()
  const [archiving, setArchiving] = useState(false)
  const [tab, setTab] = useState(startEditing ? 'information' : 'overview')

  if (!priceUnit.data) {
    return detailGate(priceUnit, {
      noun: 'this price unit',
      listName: 'price units',
      onBack: onNavigateToList,
      recordPath: `/prices/units/${encodeURIComponent(priceUnitId)}`,
    })
  }

  const data = priceUnit.data
  const baseCurrency = data.baseCurrency ? data.baseCurrency.toUpperCase() : null
  const codeLabel = data.code || 'unit'
  const conversion = workedExample(data.conversionRate, baseCurrency)

  // The Symbol field showed a broken glyph when a unit carried no symbol; fall
  // back to an em dash rather than render an empty box.
  const symbolDisplay = data.symbol.trim() ? data.symbol : '—'

  return (
    <CatalogDetailFrame
      listLabel="Price Units"
      onBack={onNavigateToList}
      icon={<CoinsIcon />}
      title={data.name}
      badges={
        <>
          <CatalogStatusBadge status={data.status} />
          <Pill>
            {baseCurrency && data.conversionRate
              ? `1 ${codeLabel} = ${data.conversionRate} ${baseCurrency}`
              : 'Custom pricing unit'}
          </Pill>
        </>
      }
      id={data.id}
      menuLabel="Price unit actions"
      menu={[
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
          disabled: data.status === 'archived',
          onSelect: () => setArchiving(true),
        },
      ]}
      tab={tab}
      onTabChange={setTab}
      tabs={[
        {
          value: 'overview',
          label: 'Overview',
          content: (
            <Section title="Conversion">
              {conversion ? (
                <div className="bg-muted/40 rounded-lg border p-4">
                  <p className="text-muted-foreground text-xs">Worked example</p>
                  <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-lg tabular-nums">
                    <span className="font-medium">1 {codeLabel}</span>
                    <span className="text-muted-foreground">=</span>
                    <span>{conversion.unit}</span>
                    <span aria-hidden className="text-muted-foreground px-1">
                      →
                    </span>
                    <span className="font-medium">
                      {SAMPLE_QUANTITY.toLocaleString()} {codeLabel}
                    </span>
                    <span className="text-muted-foreground">=</span>
                    <span>{conversion.total}</span>
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  This unit has no conversion rate and base currency set, so an example can't be
                  shown.
                </p>
              )}
            </Section>
          ),
        },
        {
          value: 'information',
          label: 'Information',
          content: (
            <div className="grid items-start gap-5 xl:grid-cols-3">
              <EditableCard
                className="xl:col-span-2"
                title="General"
                description="The name is the only field that can change once a unit is created."
                locked={data.status === 'archived'}
                fields={[
                  { key: 'name', label: 'Name', value: data.name, required: true },
                  {
                    key: 'code',
                    label: 'Code',
                    value: data.code,
                    display: data.code ? (
                      <span className="font-mono text-[13px]">{data.code}</span>
                    ) : (
                      '—'
                    ),
                    readOnly: true,
                  },
                  { key: 'symbol', label: 'Symbol', value: symbolDisplay, readOnly: true },
                  {
                    key: 'base',
                    label: 'Base currency',
                    value: baseCurrency ?? '—',
                    readOnly: true,
                  },
                  {
                    key: 'rate',
                    label: 'Conversion rate',
                    value: data.conversionRate || '—',
                    readOnly: true,
                  },
                  {
                    key: 'id',
                    label: 'Price unit ID',
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
                ]}
                onSave={(changes) =>
                  update.mutateAsync({
                    id: data.id,
                    draft: {
                      name: changes.name ?? data.name,
                      code: data.code,
                      symbol: data.symbol,
                      baseCurrency: data.baseCurrency.toUpperCase(),
                      conversionRate: Number(data.conversionRate) || 1,
                    },
                  })
                }
              />
              <MetadataCard
                metadata={data.metadata ?? {}}
                {...(data.status === 'archived'
                  ? {}
                  : {
                      onSave: (metadata: Record<string, string>) =>
                        update.mutateAsync({
                          id: data.id,
                          draft: {
                            name: data.name,
                            code: data.code,
                            symbol: data.symbol,
                            baseCurrency: data.baseCurrency.toUpperCase(),
                            conversionRate: Number(data.conversionRate) || 1,
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
        title="Archive price unit"
        description={`Archive ${data.name}? Prices already using it keep working.`}
        confirmLabel="Archive price unit"
        destructive
        isPending={remove.isPending}
        error={remove.isError ? 'Could not archive the price unit. Try again.' : null}
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

/**
 * A live conversion example, computed exactly from the rate.
 *
 * `amount × conversion_rate = base_currency_amount`, so one unit is worth the
 * rate itself and the sample quantity is that rate times the quantity. The
 * multiplication is done on the decimal string with `BigInt` rather than a
 * float, so the example never drifts the way `parseFloat` would. Returns null
 * when there is no rate or base currency to compute against: `formatMoney`
 * needs a real ISO currency, and an empty one would throw.
 */
function workedExample(
  rate: string,
  baseCurrency: string | null,
): { unit: string; total: string } | null {
  const trimmed = rate.trim()
  if (!baseCurrency || !/^\d+(\.\d+)?$/.test(trimmed) || Number(trimmed) <= 0) return null

  try {
    return {
      unit: formatMoney(money(trimmed, baseCurrency)),
      total: formatMoney(money(scaleDecimal(trimmed, SAMPLE_QUANTITY), baseCurrency)),
    }
  } catch {
    return null
  }
}

/** Multiplies a non-negative decimal string by an integer, exactly. */
function scaleDecimal(decimal: string, factor: number): string {
  const [whole, fraction = ''] = decimal.split('.')
  const scaled = BigInt((whole || '0') + fraction) * BigInt(factor)
  if (fraction.length === 0) return scaled.toString()
  const digits = scaled.toString().padStart(fraction.length + 1, '0')
  const cut = digits.length - fraction.length
  return `${digits.slice(0, cut)}.${digits.slice(cut)}`
}

function formatDate(value: Date | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(value)
}
