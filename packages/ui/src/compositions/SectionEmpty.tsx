import type { ReactNode } from 'react'
import { provenance } from '@ui/provenance'

/**
 * The empty body of a card on a detail page: a title, one line of guidance and
 * the action that fixes it, all on the centre line.
 *
 * Every card that can be empty uses this, so a page with several of them
 * (entitlements above credit grants) shows the same block in the same place
 * rather than one centred and another with its button pinned to the header.
 * The create action lives here while the card is empty and moves to the card
 * header once there are rows.
 */
export const SectionEmptyProvenance = provenance({
  source: 'composition',
  composes: [],
  note: 'Centred title, description and action for an empty card body on a detail page.',
})

export interface SectionEmptyProps {
  title: string
  description?: string | undefined
  action?: ReactNode
}

export function SectionEmpty({ title, description, action }: SectionEmptyProps) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="text-muted-foreground max-w-md text-[13px] text-balance">{description}</p>
      ) : null}
      {action}
    </div>
  )
}
