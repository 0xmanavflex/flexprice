import { Badge } from '@ui/components/reui/badge'
import { Card, CardContent } from '@ui/components/primitives/card'
import { provenance } from '@ui/provenance'

/**
 * The "How it will look" rail beside the add-on form: the name, description and
 * lookup key as a customer-facing add-on card. Driven by the draft only; price and
 * entitlements are added on the detail page afterwards, so the card says so.
 */
export const AddonPreviewCardProvenance = provenance({
  source: 'composition',
  composes: ['ui/card', '@reui/badge'],
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
    <Card className="gap-0 p-0 shadow-xs">
      <CardContent className="flex flex-col gap-3 p-4">
        <p className="text-muted-foreground text-xs">How it will look</p>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium">{title}</p>
          <Badge variant="outline">Add-on</Badge>
        </div>
        <p className="text-muted-foreground font-mono text-xs break-all">
          {lookupKey.trim() || 'lookup_key'}
        </p>
        <div className="border-t pt-3 text-sm">
          {body ? (
            <p className="break-words whitespace-pre-line">{body}</p>
          ) : (
            <p className="text-muted-foreground text-xs">No description yet.</p>
          )}
          <p className="text-muted-foreground mt-2 text-xs">
            Price and entitlements are added after you create it.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
