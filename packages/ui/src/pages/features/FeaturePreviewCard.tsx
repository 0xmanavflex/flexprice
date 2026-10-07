import { AGGREGATION_LABEL, FEATURE_TYPE_LABEL, FeatureType, ResetUsage } from '@fp/domain'
import type { AggregationType } from '@fp/domain'
import { Badge } from '@ui/components/reui/badge'
import { FormPreview, PreviewRow, PreviewRows, PreviewSection } from '@ui/compositions/FormPreview'
import { provenance } from '@ui/provenance'

/**
 * The "How it will look" rail beside the feature form: the name, key and type as
 * they will read in the catalogue, and for a metered feature the one-line meter
 * summary ("API calls · COUNT · per billing period"). Driven by the draft only.
 */
export const FeaturePreviewCardProvenance = provenance({
  source: 'composition',
  composes: ['@reui/badge', 'compositions/form-preview'],
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
  const title = name.trim() || 'Untitled product'
  const summary =
    type === FeatureType.Metered
      ? [title, aggregationType ?? null, resetUsage ? RESET_PHRASE[resetUsage] : null]
          .filter(Boolean)
          .join(' · ')
      : null

  return (
    <FormPreview
      title="How it will look"
      label="Product preview"
      badge={<Badge variant="outline">{FEATURE_TYPE_LABEL[type]}</Badge>}
    >
      <PreviewSection title="Product">
        <PreviewRows>
          <PreviewRow label="Name" value={title} />
          <PreviewRow label="Lookup key" value={lookupKey.trim() || 'lookup_key'} />
        </PreviewRows>
      </PreviewSection>
      <PreviewSection title={summary ? 'Meter' : 'About this type'}>
        {summary ? (
          <>
            <p className="text-sm">{summary}</p>
            <p className="text-muted-foreground text-xs">
              {aggregationType ? AGGREGATION_LABEL[aggregationType] : null}
              {eventName?.trim() ? ` · event ${eventName.trim()}` : ' · event not set yet'}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">{TYPE_LINE[type]}</p>
        )}
      </PreviewSection>
    </FormPreview>
  )
}
