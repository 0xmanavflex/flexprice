import { useState } from 'react'
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react'
import { Badge } from '@ui/components/reui/badge'
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
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@ui/primitives/sidebar'
import { cn } from '@ui/lib/cn'
import type { ShellNavGroup, ShellNavItem } from './types'

/**
 * Nested navigation, in `@reui/app-shell-3`'s treatment.
 *
 * A parent with children expands in place rather than replacing the panel. For
 * twenty-four destinations across three deep groups that matters: standing in
 * the catalogue you can still see that Billing exists and what is under it,
 * which a rail that swaps its panel cannot show.
 *
 * Expansion is *derived*, not stored — a group is open because something inside
 * it is active. There is no second source of truth to fall out of step with the
 * URL, and a deep link opens the right group without anyone wiring it.
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

function Count({ value }: { value: number }) {
  // Hidden from assistive tech: the count is already in the button's
  // accessible name, and a bare number read twice has no context the second
  // time.
  return (
    <Badge variant="outline" size="sm" className="ml-auto" aria-hidden>
      {value}
    </Badge>
  )
}

/**
 * A parent in the icon rail.
 *
 * Inline children would push every following item down in a 48px-wide column,
 * so the block opens them in a dropdown anchored to the icon instead. Without
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
        <DropdownMenuContent side="right" align="start" sideOffset={8} className="min-w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{item.label}</DropdownMenuLabel>
            {children.map((child) => (
              <DropdownMenuItem key={child.id} onClick={() => onNavigate(child.id)}>
                {child.label}
                {child.count !== undefined ? (
                  <span className="text-muted-foreground ml-auto text-xs">{child.count}</span>
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
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
        <ChevronRightIcon
          aria-hidden
          className={cn(
            'ml-auto size-4 shrink-0 opacity-60 transition-transform duration-200',
            expanded && 'rotate-90',
          )}
        />
      </SidebarMenuButton>

      {expanded ? (
        <SidebarMenuSub id={`subnav-${item.id}`}>
          {children.map((child) => (
            <SidebarMenuSubItem key={child.id}>
              {/*
                Rendered as a real button. `SidebarMenuSubButton` defaults to an
                anchor, and an anchor with no href has no role and cannot be
                focused by keyboard — so the sub-navigation would have been
                unreachable without a mouse.
              */}
              <SidebarMenuSubButton
                render={<button type="button" />}
                isActive={child.id === activeItemId}
                onClick={() => onNavigate(child.id)}
                aria-current={child.id === activeItemId ? 'page' : undefined}
              >
                <span className="min-w-0 truncate">{child.label}</span>
                {child.count !== undefined ? <Count value={child.count} /> : null}
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      ) : null}
    </SidebarMenuItem>
  )
}

function Leaf({
  item,
  activeItemId,
  onNavigate,
}: {
  item: ShellNavItem
  activeItemId?: string
  onNavigate: (id: string) => void
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={item.id === activeItemId}
        onClick={() => onNavigate(item.id)}
        aria-current={item.id === activeItemId ? 'page' : undefined}
        tooltip={item.label}
      >
        {item.icon}
        <span className="min-w-0 truncate">{item.label}</span>
        {item.count !== undefined ? <Count value={item.count} /> : null}
      </SidebarMenuButton>
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
        const props = {
          item,
          ...(activeItemId === undefined ? {} : { activeItemId }),
          onNavigate,
        }
        if ((item.items ?? []).length === 0) return <Leaf key={item.id} {...props} />
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
            'ml-auto size-4 shrink-0 opacity-60 transition-transform duration-200',
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
