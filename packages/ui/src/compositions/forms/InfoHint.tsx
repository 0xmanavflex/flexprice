import { InfoIcon } from '@ui/icons'
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
  children: string
}

/*
 * The button's name deliberately does not repeat the field's label: a name like
 * "About Lookup key" matches `getByLabelText(/lookup key/i)` and every other
 * label query, so the input stops being the only thing a label finds.
 */
export function InfoHint({ children }: InfoHintProps) {
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        aria-label="More information"
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
