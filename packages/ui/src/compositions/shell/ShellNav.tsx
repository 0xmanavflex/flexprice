import { ChevronRightIcon } from 'lucide-react'
import { Badge } from '@ui/components/reui/badge'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@ui/primitives/sidebar'
import type { ShellNavGroup, ShellNavItem } from './types'

/**
 * Nested navigation, in `@reui/app-shell-3`'s treatment.
 *
 * A parent with children expands in place rather than replacing the panel. For
 * twenty-four destinations across three deep groups that matters: standing in
 * the catalogue you can still see that Billing exists and what is under it,
 * which a rail that swaps its panel cannot show.
 *
 * The expansion is *derived*, not stored — a group is open because something
 * inside it is active. There is no second source of truth to fall out of step
 * with the URL, and a deep link opens the right group without anyone wiring it.
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

export function ShellNav({ groups, activeItemId, onNavigate }: ShellNavProps) {
  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.id}>
          {group.title ? <SidebarGroupLabel>{group.title}</SidebarGroupLabel> : null}
          <SidebarMenu>
            {group.items.map((item) => {
              const children = item.items ?? []
              const expanded = containsActive(item, activeItemId)

              return (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={children.length === 0 && item.id === activeItemId}
                    onClick={() => onNavigate(item.id)}
                    aria-current={item.id === activeItemId ? 'page' : undefined}
                    {...(children.length > 0 ? { 'aria-expanded': expanded } : {})}
                    tooltip={item.label}
                  >
                    {item.icon}
                    <span className="min-w-0 truncate">{item.label}</span>

                    {item.count !== undefined ? (
                      // Hidden from assistive tech: the count is already in the
                      // button's accessible name, and a bare number read twice
                      // has no context the second time.
                      <Badge variant="outline" size="sm" className="ml-auto" aria-hidden>
                        {item.count}
                      </Badge>
                    ) : null}

                    {children.length > 0 ? (
                      <ChevronRightIcon
                        aria-hidden
                        className={`ml-auto size-4 transition-transform ${
                          expanded ? 'rotate-90' : ''
                        }`}
                      />
                    ) : null}
                  </SidebarMenuButton>

                  {children.length > 0 && expanded ? (
                    <SidebarMenuSub>
                      {children.map((child) => (
                        <SidebarMenuSubItem key={child.id}>
                          {/*
                            Rendered as a real button. `SidebarMenuSubButton`
                            defaults to an anchor, and an anchor with no href
                            has no role and cannot be focused by keyboard — so
                            the sub-navigation would have been unreachable
                            without a mouse.
                          */}
                          <SidebarMenuSubButton
                            render={<button type="button" />}
                            isActive={child.id === activeItemId}
                            onClick={() => onNavigate(child.id)}
                            aria-current={child.id === activeItemId ? 'page' : undefined}
                          >
                            <span className="min-w-0 truncate">{child.label}</span>
                            {child.count !== undefined ? (
                              <Badge
                                variant="outline"
                                size="sm"
                                className="ml-auto"
                                aria-hidden
                              >
                                {child.count}
                              </Badge>
                            ) : null}
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  ) : null}
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  )
}
