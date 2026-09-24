import { useState } from 'react'
import { ChevronDownIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@ui/primitives/dropdown-menu'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  useSidebar,
} from '@ui/primitives/sidebar'
import { cn } from '@ui/lib/cn'
import type { ShellNavGroup, ShellNavItem } from './types'

/**
 * Nested navigation, in the Flux template's treatment.
 *
 * A parent with children expands in place rather than replacing the panel. For
 * twenty-four destinations across three deep groups that matters: standing in
 * the catalogue you can still see that Billing exists and what is under it,
 * which a rail that swaps its panel cannot show.
 *
 * Expansion is *derived*, not stored — a group is open because something inside
 * it is active. There is no second source of truth to fall out of step with the
 * URL, and a deep link opens the right group without anyone wiring it.
 *
 * Children are ordinary rows with a deeper indent, not `SidebarMenuSub`. The
 * sub-menu primitive draws a vertical rule down the left of the branch, and
 * with three expandable groups of six and seven that rule turns a sidebar into
 * a diagram. Flux indents and stops there, which is enough: the labels line up
 * under the parent, and nothing is drawn that carries no information.
 */
export interface ShellNavProps {
  groups: ShellNavGroup[]
  activeItemId?: string
  onNavigate: (itemId: string) => void
}

function containsActive(item: ShellNavItem, activeItemId?: string): boolean {
  if (item.id === activeItemId) return true
  return (item.items ?? []).some((child) => child.id === activeItemId)
}

/**
 * The count, as Flux has it: a bare number, not a bordered pill.
 *
 * `SidebarMenuBadge` positions it absolutely against the row, so it does not
 * compete with the label for width and every number in the column lines up.
 *
 * Being positioned means it is a *sibling* of the button rather than a child,
 * so it is outside the accessible name — a screen reader would read the row,
 * then a loose number with nothing tying the two together. It is hidden here
 * and the row states the count in its own label instead.
 */
function Count({ value }: { value: number }) {
  return <SidebarMenuBadge aria-hidden>{value}</SidebarMenuBadge>
}

/**
 * A parent in the icon rail.
 *
 * Inline children would push every following item down in a 48px-wide column,
 * so the children open in a dropdown anchored to the icon instead. Without
 * this, collapsing the sidebar makes twenty of twenty-four destinations
 * unreachable — which is the kind of thing that only shows up when someone
 * actually collapses it.
 */
function CollapsedParent({
  item,
  activeItemId,
  onNavigate,
}: {
  item: ShellNavItem
  activeItemId?: string
  onNavigate: (id: string) => void
}) {
  const children = item.items ?? []

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuButton
              tooltip={item.label}
              isActive={containsActive(item, activeItemId)}
              aria-label={item.label}
            />
          }
        >
          {item.icon}
          <span>{item.label}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" sideOffset={8} className="min-w-52">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{item.label}</DropdownMenuLabel>
            {children.map((child) => (
              <DropdownMenuItem
                key={child.id}
                onClick={() => onNavigate(child.id)}
                className={cn(child.id === activeItemId && 'bg-accent font-medium')}
              >
                {child.label}
                {child.count !== undefined ? (
                  <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                    {child.count}
                  </span>
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}

function Row({
  item,
  isActive,
  onNavigate,
  indented,
}: {
  item: ShellNavItem
  isActive: boolean
  onNavigate: (id: string) => void
  indented?: boolean
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        onClick={() => onNavigate(item.id)}
        aria-current={isActive ? 'page' : undefined}
        // The count lives outside this button, so it is named here instead —
        // "Features, 24" rather than "Features" and a number from nowhere.
        {...(item.count === undefined ? {} : { 'aria-label': `${item.label}, ${item.count}` })}
        tooltip={item.label}
        // Lines the label up under its parent's, where the parent's icon ends.
        className={cn(indented && 'pl-9!')}
      >
        {item.icon}
        <span className="min-w-0 truncate">{item.label}</span>
      </SidebarMenuButton>
      {item.count !== undefined ? <Count value={item.count} /> : null}
    </SidebarMenuItem>
  )
}

function ExpandedParent({
  item,
  activeItemId,
  onNavigate,
}: {
  item: ShellNavItem
  activeItemId?: string
  onNavigate: (id: string) => void
}) {
  const children = item.items ?? []
  const expanded = containsActive(item, activeItemId)

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={false}
        onClick={() => onNavigate(item.id)}
        aria-expanded={expanded}
        aria-controls={`subnav-${item.id}`}
        tooltip={item.label}
      >
        {item.icon}
        <span className="min-w-0 truncate">{item.label}</span>
        <ChevronDownIcon
          aria-hidden
          className={cn(
            'ml-auto size-4 shrink-0 opacity-50 transition-transform duration-200',
            !expanded && '-rotate-90',
          )}
        />
      </SidebarMenuButton>

      {expanded ? (
        // A real nested list, inside the parent's own item — which is what
        // `SidebarMenuSub` is for. Its border, inset and gap are stripped:
        // that vertical rule down the branch is the one thing Flux does not
        // draw, and with three groups of six and seven it turns a sidebar into
        // a diagram. The nesting is kept because it is what makes the depth
        // true rather than merely drawn.
        <SidebarMenuSub
          id={`subnav-${item.id}`}
          className="mx-0 min-w-0 translate-x-0 gap-0.25 border-0 px-0 py-0"
        >
          {children.map((child) => (
            <Row
              key={child.id}
              item={child}
              isActive={child.id === activeItemId}
              onNavigate={onNavigate}
              indented
            />
          ))}
        </SidebarMenuSub>
      ) : null}
    </SidebarMenuItem>
  )
}

function Items({
  items,
  activeItemId,
  onNavigate,
}: {
  items: ShellNavItem[]
  activeItemId?: string
  onNavigate: (id: string) => void
}) {
  const { state, isMobile } = useSidebar()
  // The rail only exists on desktop; on mobile the sidebar is a sheet and is
  // always at full width, so the dropdown branch would be wrong there.
  const isRail = state === 'collapsed' && !isMobile

  return (
    <SidebarMenu>
      {items.map((item) => {
        if ((item.items ?? []).length === 0) {
          return (
            <Row
              key={item.id}
              item={item}
              isActive={item.id === activeItemId}
              onNavigate={onNavigate}
            />
          )
        }
        const props = {
          item,
          ...(activeItemId === undefined ? {} : { activeItemId }),
          onNavigate,
        }
        return isRail ? (
          <CollapsedParent key={item.id} {...props} />
        ) : (
          <ExpandedParent key={item.id} {...props} />
        )
      })}
    </SidebarMenu>
  )
}

/** A group whose heading is a toggle. Secondary links only — see `collapsible`. */
function CollapsibleGroup({
  group,
  activeItemId,
  onNavigate,
}: {
  group: ShellNavGroup
  activeItemId?: string
  onNavigate: (id: string) => void
}) {
  const [open, setOpen] = useState(true)

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel
        render={
          <button
            type="button"
            onClick={() => setOpen((previous) => !previous)}
            aria-expanded={open}
            aria-controls={`navgroup-${group.id}`}
          />
        }
        className="focus-visible:ring-sidebar-ring w-full cursor-pointer whitespace-nowrap focus-visible:ring-2 focus-visible:outline-none"
      >
        {group.title}
        <ChevronDownIcon
          aria-hidden
          className={cn(
            'ml-auto size-4 shrink-0 opacity-50 transition-transform duration-200',
            !open && '-rotate-90',
          )}
        />
      </SidebarGroupLabel>
      {open ? (
        <SidebarGroupContent id={`navgroup-${group.id}`}>
          <Items
            items={group.items}
            {...(activeItemId === undefined ? {} : { activeItemId })}
            onNavigate={onNavigate}
          />
        </SidebarGroupContent>
      ) : null}
    </SidebarGroup>
  )
}

export function ShellNav({ groups, activeItemId, onNavigate }: ShellNavProps) {
  return (
    <>
      {groups.map((group) =>
        group.collapsible && group.title ? (
          <CollapsibleGroup
            key={group.id}
            group={group}
            {...(activeItemId === undefined ? {} : { activeItemId })}
            onNavigate={onNavigate}
          />
        ) : (
          <SidebarGroup key={group.id}>
            {group.title ? (
              <SidebarGroupLabel className="in-data-[state=collapsed]:hidden">
                {group.title}
              </SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <Items
                items={group.items}
                {...(activeItemId === undefined ? {} : { activeItemId })}
                onNavigate={onNavigate}
              />
            </SidebarGroupContent>
          </SidebarGroup>
        ),
      )}
    </>
  )
}
