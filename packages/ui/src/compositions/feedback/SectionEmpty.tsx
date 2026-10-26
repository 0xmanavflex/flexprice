import type { ReactNode } from 'react'
import { provenance } from '@ui/provenance'
import { SceneIllustration, type EmptyScene } from './SceneIllustration'

/**
 * The empty body of a card on a detail page: a title, one line of guidance and
 * the action that fixes it, all on the centre line.
 *
 * Every card that can be empty uses this, so a page with several of them
 * (entitlements above credit grants) shows the same block in the same place.
 * The create action is never here: it stays in the card's `Section` header,
 * top right, whether the card has rows or not. `action` is for a way out that
 * is not creating: "Try again" on a failed load.
 */
export const SectionEmptyProvenance = provenance({
  source: 'composition',
  composes: ['compositions/feedback/SceneIllustration'],
  note: 'Centred drawing, title and description for an empty card body on a detail page. The create action stays in the Section header.',
})

export interface SectionEmptyProps {
  title: string
  description?: string | undefined
  /** A non-create way out, such as "Try again". Never the create action. */
  action?: ReactNode
  /** The area of the product this card is in; draws the same figure as its list page. */
  scene?: EmptyScene | undefined
}

export function SectionEmpty({ title, description, action, scene }: SectionEmptyProps) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      {scene ? <SceneIllustration scene={scene} size="sm" className="w-32" /> : null}
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="text-muted-foreground max-w-md text-[13px] text-balance">{description}</p>
      ) : null}
      {action}
    </div>
  )
}
