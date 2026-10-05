import { Button } from '@ui/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'
import { MoreHorizontalIcon } from 'lucide-react'
import { provenance } from '@ui/provenance'

/**
 * The per-row action menu the plan-nested tables share: an icon trigger named
 * for the row it acts on, and Edit / destructive items only for the actions the
 * caller wired.
 */
export const RowActionsMenuProvenance = provenance({
  source: 'composition',
  composes: ['ui/dropdown-menu', 'ui/button'],
  note: 'Row menu with optional Edit and a destructive action.',
})

export interface RowActionsMenuProps {
  /** Names the trigger: "Actions for <label>". */
  label: string
  onEdit?: (() => void) | undefined
  onRemove?: (() => void) | undefined
  removeLabel?: string
}

export function RowActionsMenu({
  label,
  onEdit,
  onRemove,
  removeLabel = 'Remove',
}: RowActionsMenuProps) {
  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={`Actions for ${label}`}
            />
          }
        >
          <MoreHorizontalIcon aria-hidden className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          {onEdit ? <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem> : null}
          {onRemove ? (
            <DropdownMenuItem variant="destructive" onClick={onRemove}>
              {removeLabel}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
