import { Card, CardContent } from '@ui/components/primitives/card'
import { provenance } from '@ui/provenance'

/**
 * The "How it will look" rail beside the price unit form: the unit's symbol,
 * code and name, and what one unit converts to in the base currency. Driven by
 * the draft only.
 */
export const PriceUnitPreviewCardProvenance = provenance({
  source: 'composition',
  composes: ['ui/card'],
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
    <Card className="gap-0 p-0 shadow-xs">
      <CardContent className="flex flex-col gap-3 p-4">
        <p className="text-muted-foreground text-xs">How it will look</p>
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
        <div className="border-t pt-3 text-sm">
          {conversion ? (
            <p>{conversion}</p>
          ) : (
            <p className="text-muted-foreground text-xs">
              Choose a base currency and a rate to see the conversion.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
