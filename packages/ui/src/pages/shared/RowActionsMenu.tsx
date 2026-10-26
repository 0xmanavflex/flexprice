import { Button } from '@ui/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'
import type { ReactElement } from 'react'
import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from '@ui/icons'
import { provenance } from '@ui/provenance'
import { useWriteAccess } from '@ui/compositions/access/Access'

/**
 * The per-row action menu the plan-nested tables share: an icon trigger named
 * for the row it acts on, and Edit / destructive items only for the actions the
 * caller wired. Every item leads with an icon: Edit a pencil, the destructive
 * item a bin unless the caller names another.
 */
export const RowActionsMenuProvenance = provenance({
  source: 'composition',
  composes: ['ui/dropdown-menu', 'ui/button'],
  note: 'Row menu with optional Edit and a destructive action.',
})

export interface RowActionsMenuProps {
  /** Names the trigger: "Actions for <label>". */
  label: string
  /** Extra items before Edit, for actions that are neither an edit nor a removal. */
  extra?:
    | {
        label: string
        onSelect: () => void
        /** Leading glyph, required so every item lines up behind one. */
        icon: ReactElement
        /** Does not write (Copy, View): stays enabled when write is denied. */
        readOnly?: boolean
      }[]
    | undefined
  onEdit?: (() => void) | undefined
  onRemove?: (() => void) | undefined
  removeLabel?: string
  /** The destructive item's glyph, when a bin is wrong (Archive, Void). */
  removeIcon?: ReactElement | undefined
}

export function RowActionsMenu({
  label,
  extra,
  onEdit,
  onRemove,
  removeLabel = 'Remove',
  removeIcon = <Trash2Icon aria-hidden />,
}: RowActionsMenuProps) {
  // Edit, Remove and every non-read-only item follow the page's `AccessScope`.
  const write = useWriteAccess()
  const denied = !write.allowed
  const gated = denied && (Boolean(onEdit || onRemove) || Boolean(extra?.some((i) => !i.readOnly)))
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
          {/* Edit leads, then the row's own items, then the destructive one. */}
          {onEdit ? (
            <DropdownMenuItem disabled={denied} onClick={onEdit}>
              <PencilIcon aria-hidden />
              Edit
            </DropdownMenuItem>
          ) : null}
          {extra?.map((item) => (
            <DropdownMenuItem
              key={item.label}
              disabled={denied && !item.readOnly}
              onClick={item.onSelect}
            >
              {item.icon}
              {item.label}
            </DropdownMenuItem>
          ))}
          {onRemove ? (
            <DropdownMenuItem variant="destructive" disabled={denied} onClick={onRemove}>
              {removeIcon}
              {removeLabel}
            </DropdownMenuItem>
          ) : null}
          {gated ? (
            <p className="text-muted-foreground max-w-56 px-2 py-1.5 text-xs">{write.reason}</p>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
