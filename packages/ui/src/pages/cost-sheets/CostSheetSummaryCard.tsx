import { FormPreview, PreviewRow, PreviewRows, PreviewSection } from '@ui/compositions/FormPreview'
import { provenance } from '@ui/provenance'

/**
 * A compact "Summary" rail beside the cost sheet form: the name, lookup key and
 * description as drafted, plus what happens next. Driven by the draft only.
 */
export const CostSheetSummaryCardProvenance = provenance({
  source: 'composition',
  composes: ['compositions/form-preview'],
  note: 'Small draft summary; fetches nothing.',
})

export interface CostSheetSummaryCardProps {
  name: string
  lookupKey: string
  description: string
}

export function CostSheetSummaryCard({ name, lookupKey, description }: CostSheetSummaryCardProps) {
  return (
    <FormPreview title="Summary" label="Cost sheet summary">
      <PreviewSection title="Cost sheet">
        <PreviewRows>
          <PreviewRow label="Name" value={name.trim() || 'Untitled cost sheet'} />
          <PreviewRow label="Lookup key" value={lookupKey.trim() || '—'} />
        </PreviewRows>
        {description.trim() ? (
          <p className="text-muted-foreground line-clamp-3 text-sm">{description.trim()}</p>
        ) : null}
      </PreviewSection>
      <p className="text-muted-foreground text-xs">
        After you create it, add the cost of each unit of usage on the cost sheet’s page.
      </p>
    </FormPreview>
  )
}
