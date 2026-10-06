import type { ReactNode } from 'react'
import { InfoIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/components/primitives/tooltip'
import { provenance } from '@ui/provenance'

/**
 * A heading's description, behind an (i) beside the title.
 *
 * Page, section and form headings carry no sub-line; what that line said is
 * read by hovering or focusing the (i) instead.
 */
export const DescriptionTipProvenance = provenance({
  source: 'composition',
  composes: ['ui/tooltip'],
  note: 'An (i) button whose tooltip holds a heading description. Replaces sub-lines under headings.',
})

export function DescriptionTip({ children }: { children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label="About this section"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex size-4 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3"
          />
        }
      >
        <InfoIcon aria-hidden className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-xs">{children}</TooltipContent>
    </Tooltip>
  )
}
