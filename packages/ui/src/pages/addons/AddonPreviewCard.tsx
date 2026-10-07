import { Badge } from '@ui/components/reui/badge'
import { FormPreview, PreviewRow, PreviewRows, PreviewSection } from '@ui/compositions/FormPreview'
import { provenance } from '@ui/provenance'

/**
 * The "How it will look" rail beside the add-on form: the name, description and
 * lookup key as a customer-facing add-on card. Driven by the draft only; price and
 * entitlements are added on the detail page afterwards, so the card says so.
 */
export const AddonPreviewCardProvenance = provenance({
  source: 'composition',
  composes: ['@reui/badge', 'compositions/form-preview'],
  note: 'Live summary of the add-on being drafted; fetches nothing.',
})

export interface AddonPreviewCardProps {
  name: string
  lookupKey: string
  description?: string
}

export function AddonPreviewCard({ name, lookupKey, description }: AddonPreviewCardProps) {
  const title = name.trim() || 'Untitled add-on'
  const body = description?.trim()

  return (
    <FormPreview
      title="How it will look"
      label="Add-on preview"
      badge={<Badge variant="outline">Add-on</Badge>}
    >
      <PreviewSection title="Add-on">
        <PreviewRows>
          <PreviewRow label="Name" value={title} />
          <PreviewRow label="Lookup key" value={lookupKey.trim() || 'lookup_key'} />
        </PreviewRows>
      </PreviewSection>
      <PreviewSection title="Description">
        {body ? (
          <p className="text-sm break-words whitespace-pre-line">{body}</p>
        ) : (
          <p className="text-muted-foreground text-sm">No description yet.</p>
        )}
        <p className="text-muted-foreground text-xs">
          Price and entitlements are added after you create it.
        </p>
      </PreviewSection>
    </FormPreview>
  )
}
