import { provenance } from '@ui/provenance'

/**
 * A compact "Summary" rail beside the cost sheet form: the name, lookup key and
 * description as drafted, plus what happens next. Driven by the draft only.
 */
export const CostSheetSummaryCardProvenance = provenance({
  source: 'composition',
  composes: [],
  note: 'Small draft summary; fetches nothing.',
})

export interface CostSheetSummaryCardProps {
  name: string
  lookupKey: string
  description: string
}

export function CostSheetSummaryCard({ name, lookupKey, description }: CostSheetSummaryCardProps) {
  return (
    <aside aria-label="Cost sheet summary" className="bg-background rounded-xl border p-6">
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-xs">Summary</p>
        <p className="text-sm font-medium">{name.trim() || 'Untitled cost sheet'}</p>
        <p className="text-muted-foreground font-mono text-xs break-all">
          {lookupKey.trim() || 'No lookup key'}
        </p>
        {description.trim() ? (
          <p className="text-muted-foreground line-clamp-3 text-xs">{description.trim()}</p>
        ) : null}
        <p className="text-muted-foreground border-t pt-3 text-xs">
          After you create it, add the cost of each unit of usage on the cost sheet’s page.
        </p>
      </div>
    </aside>
  )
}
