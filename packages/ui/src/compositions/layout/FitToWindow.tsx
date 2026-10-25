import { Maximize2Icon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/components/primitives/tooltip'
import { provenance } from '@ui/provenance'

/**
 * Let the table decide how many rows to show, or take it back.
 *
 * Pressing it once turns measurement on; choosing a page size from the
 * neighbouring control turns it off, because an explicit choice should not be
 * silently overridden the next time the window moves. That is the whole
 * contract, and it is why this is a toggle rather than a page-size option
 * called "auto": "auto" in a list of numbers cannot express being cancelled
 * by picking a number.
 *
 * Icon-only: a maximise glyph beside the pagination is enough, and the label it
 * used to carry read as clutter in a footer that is otherwise all controls. The
 * accessible name lives on `aria-label`, and the tooltip still spells out what
 * it does and whether it is on.
 */
export const FitToWindowProvenance = provenance({
  source: 'composition',
  composes: ['ui/button', 'ui/tooltip'],
  note: 'Icon toggle for measured page size. Picking an explicit size cancels it.',
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
            size="icon-sm"
            aria-pressed={pressed}
            aria-label="Fit to window"
            onClick={() => onPressedChange(!pressed)}
            className={pressed ? 'bg-muted text-foreground' : 'text-muted-foreground'}
          />
        }
      >
        <Maximize2Icon aria-hidden className="size-4" />
      </TooltipTrigger>
      <TooltipContent>
        {pressed
          ? 'Showing as many rows as fit. Pick a page size to stop.'
          : 'Show as many rows as fit the window'}
      </TooltipContent>
    </Tooltip>
  )
}
