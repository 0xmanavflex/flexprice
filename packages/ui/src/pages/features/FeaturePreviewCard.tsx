import { AGGREGATION_LABEL, FEATURE_TYPE_LABEL, FeatureType, ResetUsage } from '@fp/domain'
import type { AggregationType } from '@fp/domain'
import { Badge } from '@ui/components/reui/badge'
import { Card, CardContent } from '@ui/components/primitives/card'
import { provenance } from '@ui/provenance'

/**
 * The "How it will look" rail beside the feature form: the name, key and type as
 * they will read in the catalogue, and for a metered feature the one-line meter
 * summary ("API calls · COUNT · per billing period"). Driven by the draft only.
 */
export const FeaturePreviewCardProvenance = provenance({
  source: 'composition',
  composes: ['ui/card', '@reui/badge'],
  note: 'Live summary of the feature being drafted; fetches nothing.',
})

export interface FeaturePreviewCardProps {
  name: string
  lookupKey: string
  type: FeatureType
  eventName?: string
  aggregationType?: AggregationType
  resetUsage?: ResetUsage
}

const RESET_PHRASE: Record<ResetUsage, string> = {
  [ResetUsage.BillingPeriod]: 'per billing period',
  [ResetUsage.Never]: 'never resets',
}

const TYPE_LINE: Record<FeatureType, string> = {
  [FeatureType.Metered]: 'Usage measured from events.',
  [FeatureType.Boolean]: 'On or off for a plan.',
  [FeatureType.Static]: 'A fixed quantity on a plan.',
  [FeatureType.Config]: 'A configuration value on a plan.',
}

export function FeaturePreviewCard({
  name,
  lookupKey,
  type,
  eventName,
  aggregationType,
  resetUsage,
}: FeaturePreviewCardProps) {
  const title = name.trim() || 'Untitled feature'
  const summary =
    type === FeatureType.Metered
      ? [title, aggregationType ?? null, resetUsage ? RESET_PHRASE[resetUsage] : null]
          .filter(Boolean)
          .join(' · ')
      : null

  return (
    <Card className="gap-0 p-0 shadow-xs">
      <CardContent className="flex flex-col gap-3 p-4">
        <p className="text-muted-foreground text-xs">How it will look</p>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium">{title}</p>
          <Badge variant="outline">{FEATURE_TYPE_LABEL[type]}</Badge>
        </div>
        <p className="text-muted-foreground font-mono text-xs break-all">
          {lookupKey.trim() || 'lookup_key'}
        </p>
        <div className="border-t pt-3 text-sm">
          {summary ? (
            <>
              <p>{summary}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {aggregationType ? AGGREGATION_LABEL[aggregationType] : null}
                {eventName?.trim() ? ` · event ${eventName.trim()}` : ' · event not set yet'}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-xs">{TYPE_LINE[type]}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
