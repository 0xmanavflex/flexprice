import { Fragment, type ReactNode } from 'react'
import { PlusIcon } from 'lucide-react'
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

/**
 * One way to start anything, in the header, from every screen.
 *
 * A filled primary button at the right of the top bar, as the reference shell
 * has it. The things a finance person creates do not live on the page they are
 * usually looking at; starting a subscription would otherwise mean navigating
 * to Customers, finding the customer, and finding the button.
 *
 * Deliberately short: this lists the flows people actually start cold, and the
 * rest stay on the screen that owns them. Items are grouped (what you sell, who
 * you sell it to, the money) with a separator between groups.
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
}

export interface ShellCreateMenuProps {
  actions: ShellCreateAction[]
  onCreate: (id: string) => void
  label?: string
}

export function ShellCreateMenu({ actions, onCreate, label = 'Create' }: ShellCreateMenuProps) {
  if (actions.length === 0) return null

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
        render={<Button size="sm" className="h-8 px-3" aria-label={`${label} something new`} />}
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
                <DropdownMenuItem key={action.id} onClick={() => onCreate(action.id)}>
                  {action.icon ? (
                    <span className="text-muted-foreground contents">{action.icon}</span>
                  ) : null}
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
