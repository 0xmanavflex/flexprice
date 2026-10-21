import { Fragment, type ReactNode } from 'react'
import { PlusIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'
import { provenance } from '@ui/provenance'
import type { RbacEntity } from '@fp/domain'
import { useWriteCheck } from '../access/Access'

/**
 * One way to start anything, in the header, from every screen.
 *
 * A white (outline) button at the right of the top bar, by design feedback
 * of 2026-10-05: primary colour is kept for the one action on a page, and this
 * one is on every page. The things a finance person creates do not live on the page they are
 * usually looking at; starting a subscription would otherwise mean navigating
 * to Customers, finding the customer, and finding the button.
 *
 * Deliberately short: this lists the flows people actually start cold, and the
 * rest stay on the screen that owns them. The console passes one flat list;
 * `startsGroup` remains for a caller that genuinely needs a rule between items.
 */
export const ShellCreateMenuProvenance = provenance({
  source: 'composition',
  composes: ['ui/dropdown-menu', 'ui/button'],
  note: "The reference shell's header Create menu, with our flows and our grouping.",
})

export interface ShellCreateAction {
  id: string
  label: string
  icon?: ReactNode
  /** Starts a new group above this item. */
  startsGroup?: boolean
  /** The entity this creates: disabled, with the reason, without write on it. */
  entity?: RbacEntity
}

export interface ShellCreateMenuProps {
  actions: ShellCreateAction[]
  onCreate: (id: string) => void
  label?: string
}

export function ShellCreateMenu({ actions, onCreate, label = 'Create' }: ShellCreateMenuProps) {
  const check = useWriteCheck()
  if (actions.length === 0) return null
  const reasonFor = (action: ShellCreateAction) =>
    action.entity ? check(action.entity).reason : null
  const note = actions.map(reasonFor).find(Boolean)

  // Split into groups at each `startsGroup`, so each is a labelled-by-position
  // `Menu.Group` rather than loose items.
  const groups: ShellCreateAction[][] = []
  for (const action of actions) {
    if (action.startsGroup || groups.length === 0) groups.push([action])
    else groups[groups.length - 1]!.push(action)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3"
            aria-label={`${label} something new`}
          />
        }
      >
        <PlusIcon aria-hidden />
        {label}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={6} className="w-56">
        {groups.map((group, index) => (
          <Fragment key={group[0]!.id}>
            {index > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuGroup>
              {group.map((action) => (
                <DropdownMenuItem
                  key={action.id}
                  disabled={Boolean(reasonFor(action))}
                  onClick={() => onCreate(action.id)}
                >
                  {action.icon ? (
                    <span className="text-muted-foreground contents">{action.icon}</span>
                  ) : null}
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </Fragment>
        ))}
        {note ? <p className="text-muted-foreground px-2 py-1.5 text-xs">{note}</p> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
