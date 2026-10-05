import { InfoIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@ui/components/primitives/popover'
import { provenance } from '@ui/provenance'

/**
 * Explanatory copy for a form field, behind an (i) beside the label.
 *
 * Forms that explain themselves under every label read as a wall of text, so
 * the explanation moves here: hover or focus the (i) to read it. A popover
 * rather than a tooltip so it also opens on tap and stays readable.
 */
export const InfoHintProvenance = provenance({
  source: 'composition',
  composes: ['ui/popover'],
  note: 'An (i) button that reveals a field explanation. Replaces sub-lines under labels.',
})

export interface InfoHintProps {
  /** What the (i) is about; names the button for assistive tech. */
  label: string
  children: string
}

export function InfoHint({ label, children }: InfoHintProps) {
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        aria-label={`About ${label}`}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex size-4 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3"
      >
        <InfoIcon aria-hidden className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-64 text-xs">
        {children}
      </PopoverContent>
    </Popover>
  )
}
