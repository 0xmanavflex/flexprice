import { FormPreview, PreviewAmount, PreviewSection } from '@ui/compositions/FormPreview'
import { provenance } from '@ui/provenance'

/**
 * The "How it will look" rail beside the price unit form: the unit's symbol,
 * code and name, and what one unit converts to in the base currency. Driven by
 * the draft only.
 */
export const PriceUnitPreviewCardProvenance = provenance({
  source: 'composition',
  composes: ['compositions/form-preview'],
  note: 'Live summary of the price unit being drafted; fetches nothing.',
})

export interface PriceUnitPreviewCardProps {
  name: string
  code: string
  symbol: string
  baseCurrency: string
  conversionRate?: number | null
}

export function PriceUnitPreviewCard({
  name,
  code,
  symbol,
  baseCurrency,
  conversionRate,
}: PriceUnitPreviewCardProps) {
  const unitCode = code.trim().toUpperCase() || 'CODE'
  const hasRate = typeof conversionRate === 'number' && Number.isFinite(conversionRate)
  const conversion =
    hasRate && baseCurrency
      ? `1 ${unitCode} = ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 }).format(conversionRate)} ${baseCurrency}`
      : null

  return (
    <FormPreview title="How it will look" label="Price unit preview">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-md text-lg"
        >
          {symbol.trim() || '·'}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{name.trim() || 'Untitled price unit'}</p>
          <p className="text-muted-foreground font-mono text-xs">{unitCode}</p>
        </div>
      </div>
      {conversion ? (
        <PreviewAmount label="Conversion" value={conversion} />
      ) : (
        <PreviewSection title="Conversion">
          <p className="text-muted-foreground text-sm">
            Choose a base currency and a rate to see the conversion.
          </p>
        </PreviewSection>
      )}
    </FormPreview>
  )
}
