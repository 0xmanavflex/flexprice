import { formatMoney, money } from '@fp/domain'
import { ApiError, usePriceUnit, useUpdatePriceUnit } from '@fp/query'
import { CatalogStatusBadge } from '@fp/ui/pages'
import {
  AppFailure,
  DetailList,
  DetailShell,
  InlineField,
  LoadingRows,
  Section,
} from '@fp/ui/compositions'

export interface PriceUnitDetailPageProps {
  priceUnitId: string
  onNavigateToList: () => void
}

/** A round quantity for the worked example — enough to make the total read clearly. */
const SAMPLE_QUANTITY = 1000

/**
 * One price unit, in full.
 *
 * A price unit is a rate anchor — a code and symbol pinned to a base currency
 * through a conversion rate — so it is a small entity, and this page is
 * deliberately small to match. One `DetailShell` header, one **Conversion**
 * section with a live worked example ("1 CRD = $0.01 → 1,000 CRD = $10.00"), and
 * one **Information** list of every attribute. No tabs and no rail: the earlier
 * version rendered the same four fields three times over, which this replaces.
 *
 * The name is all the backend lets change, so it is edited in place (the pencil
 * beside it); everything else is shown read-only in the lists below. There is no
 * Edit page, because there is nothing else to edit.
 */
export function PriceUnitDetailPage({ priceUnitId, onNavigateToList }: PriceUnitDetailPageProps) {
  const priceUnit = usePriceUnit(priceUnitId)
  const update = useUpdatePriceUnit()

  if (priceUnit.isPending) {
    return (
      <div className="p-6">
        <LoadingRows />
      </div>
    )
  }

  if (priceUnit.error) {
    return (
      <AppFailure
        title={failureTitle(priceUnit.error)}
        detail="The rest of the console still works. Try again, or go back to the list."
        onRetry={() => void priceUnit.refetch()}
      />
    )
  }

  if (!priceUnit.data) {
    return (
      <AppFailure
        title="This price unit no longer exists"
        detail="It may have been deleted. Everything else in the catalogue still works."
        onRetry={onNavigateToList}
      />
    )
  }

  const data = priceUnit.data
  const baseCurrency = data.baseCurrency ? data.baseCurrency.toUpperCase() : null
  const codeLabel = data.code || 'unit'
  const conversion = workedExample(data.conversionRate, baseCurrency)

  // The Symbol field showed a broken glyph when a unit carried no symbol; fall
  // back to an em dash rather than render an empty box.
  const symbolDisplay = data.symbol.trim() ? data.symbol : '—'

  return (
    <DetailShell
      breadcrumb={
        <button
          type="button"
          onClick={onNavigateToList}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -ml-1 inline-flex w-fit items-center gap-1 rounded-md px-1 py-0.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          ← Price Units
        </button>
      }
      title={data.name}
      badges={<CatalogStatusBadge status={data.status} />}
      identifier={data.code || data.id}
    >
      <Section
        title="Details"
        description="Click the pencil to rename it. Its other fields are fixed once created."
      >
        <InlineField
          label="Name"
          value={data.name}
          required
          onSave={(name) =>
            update.mutateAsync({
              id: data.id,
              draft: {
                name,
                code: data.code,
                symbol: data.symbol,
                baseCurrency: data.baseCurrency.toUpperCase(),
                // Display-only: the update payload is name-only, so this only has to satisfy the schema.
                conversionRate: Number(data.conversionRate) || 1,
              },
            })
          }
        />
      </Section>

      <Section
        title="Conversion"
        description={
          conversion
            ? `How ${codeLabel === 'unit' ? 'this unit' : codeLabel} converts into ${baseCurrency}.`
            : 'How this unit converts into its base currency.'
        }
      >
        {conversion ? (
          <div className="bg-muted/40 rounded-lg border p-4">
            <p className="text-muted-foreground text-xs font-medium">Worked example</p>
            <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-lg tabular-nums">
              <span className="font-semibold">1 {codeLabel}</span>
              <span className="text-muted-foreground">=</span>
              <span>{conversion.unit}</span>
              <span aria-hidden className="text-muted-foreground px-1">
                →
              </span>
              <span className="font-semibold">
                {SAMPLE_QUANTITY.toLocaleString()} {codeLabel}
              </span>
              <span className="text-muted-foreground">=</span>
              <span>{conversion.total}</span>
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            This unit has no conversion rate and base currency set, so an example can't be shown.
          </p>
        )}
      </Section>

      <Section title="Information" description="Every attribute of this price unit.">
        <DetailList
          items={[
            { label: 'Name', value: data.name },
            {
              label: 'Code',
              value: data.code ? <span className="font-mono">{data.code}</span> : '—',
            },
            { label: 'Symbol', value: symbolDisplay },
            { label: 'Base currency', value: baseCurrency ?? '—' },
            {
              label: 'Conversion rate',
              value: <span className="tabular-nums">{data.conversionRate || '—'}</span>,
            },
            { label: 'Status', value: <CatalogStatusBadge status={data.status} /> },
            { label: 'Price unit ID', value: <span className="font-mono text-xs">{data.id}</span> },
            { label: 'Created', value: formatDate(data.createdAt) },
            { label: 'Updated', value: formatDate(data.updatedAt) },
          ]}
        />
      </Section>
    </DetailShell>
  )
}

/**
 * A live conversion example, computed exactly from the rate.
 *
 * `amount × conversion_rate = base_currency_amount`, so one unit is worth the
 * rate itself and the sample quantity is that rate times the quantity. The
 * multiplication is done on the decimal string with `BigInt` rather than a
 * float, so the example never drifts the way `parseFloat` would. Returns null
 * when there is no rate or base currency to compute against — `formatMoney`
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
