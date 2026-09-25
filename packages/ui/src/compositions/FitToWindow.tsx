import { ScanIcon } from 'lucide-react'
import { Button } from '@ui/primitives/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/primitives/tooltip'
import { provenance } from '@ui/provenance'

/**
 * Let the table decide how many rows to show, or take it back.
 *
 * Pressing it once turns measurement on; choosing a page size from the
 * neighbouring control turns it off, because an explicit choice should not be
 * silently overridden the next time the window moves. That is the whole
 * contract, and it is why this is a toggle rather than a page-size option
 * called "auto" — "auto" in a list of numbers cannot express being cancelled
 * by picking a number.
 */
export const FitToWindowProvenance = provenance({
  source: 'composition',
  composes: ['ui/button', 'ui/tooltip'],
  note: 'Toggles measured page size. Picking an explicit size cancels it.',
})

export interface FitToWindowProps {
  pressed: boolean
  onPressedChange: (pressed: boolean) => void
}

export function FitToWindow({ pressed, onPressedChange }: FitToWindowProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={pressed}
            onClick={() => onPressedChange(!pressed)}
            className="text-muted-foreground gap-1.5 font-normal"
          />
        }
      >
        <ScanIcon aria-hidden className="size-4" />
        Fit to window
      </TooltipTrigger>
      <TooltipContent>
        {pressed
          ? 'Showing as many rows as fit. Pick a page size to stop.'
          : 'Show as many rows as fit the window'}
      </TooltipContent>
    </Tooltip>
  )
}
