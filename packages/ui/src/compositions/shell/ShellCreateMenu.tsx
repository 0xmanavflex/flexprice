import { Fragment, type ReactNode } from 'react'
import { PlusIcon } from 'lucide-react'
import { Button } from '@ui/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ui/primitives/dropdown-menu'
import { provenance } from '@ui/provenance'
import { MENU_CONTENT, MENU_ITEM } from './menuSurface'

/**
 * One way to start anything, in the header, from every screen.
 *
 * Taken from `@reui/app-shell-8`, which puts a Create button beside the
 * breadcrumb. The reason to want it here is specific to this product: the
 * things a finance person creates do not live on the page they are usually
 * looking at. Starting a subscription today means navigating to Customers,
 * finding the customer, and finding the button — three steps before the work
 * begins, and the first two are pure search.
 *
 * Deliberately short. A create menu that lists everything creatable is a second
 * navigation tree with worse labels; this lists the flows people actually start
 * cold, and the rest stay where they belong, on the screen that owns them.
 *
 * Items are grouped, and the groups mean something: what you sell, then who you
 * sell it to, then the money. A separator between them is the difference
 * between a menu that is read and one that is scanned.
 */
export const ShellCreateMenuProvenance = provenance({
  source: 'composition',
  composes: ['@reui/app-shell-8', 'ui/dropdown-menu', 'ui/button'],
  note: "The block's header Create menu, with our flows and our grouping.",
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

  return (
    <DropdownMenu>
      {/*
        Outline, not filled. This is the global quick-start menu that lives in
        the chrome; each page carries its own filled primary "New X" for the
        thing that page is about. Two filled brand buttons competing on one
        screen flattens the hierarchy — the page's action should lead, and this
        should read as the always-there utility it is.
      */}
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5" aria-label={`${label} something new`} />
        }
      >
        <PlusIcon aria-hidden className="size-4" />
        {label}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className={MENU_CONTENT}>
        {actions.map((action, index) => (
          <Fragment key={action.id}>
            {action.startsGroup && index > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem className={MENU_ITEM} onClick={() => onCreate(action.id)}>
              {action.icon}
              {action.label}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
