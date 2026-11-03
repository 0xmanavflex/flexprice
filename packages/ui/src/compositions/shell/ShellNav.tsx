import { Fragment, useState, type ReactNode } from 'react'
import { ArrowUpRightIcon, ChevronRightIcon } from '@ui/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'
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
} from '@ui/components/primitives/sidebar'
import { cn } from '@ui/lib/cn'
import type { ShellNavGroup, ShellNavItem } from './types'

/**
 * Nested navigation, after the reference shell's `NavMain`.
 *
 * One section is open at a time, and it defaults to the one holding the current
 * page. Opening a closed section lands on its first page (the parent reports
 * its own id and the app resolves that to the first child), so a heading never
 * does nothing when clicked. In the icon rail a parent becomes a flyout menu,
 * so collapsing the sidebar never makes the pages inside a group unreachable.
 */
export interface ShellNavProps {
  groups: ShellNavGroup[]
  activeItemId?: string
  onNavigate: (itemId: string) => void
}

function containsActive(item: ShellNavItem, activeItemId?: string): boolean {
  return (item.items ?? []).some((child) => child.id === activeItemId)
}

/**
 * A parent in the icon rail: its children open in a flyout anchored to the
 * icon, because inline children would push every following item down in a
 * column that is only an icon wide.
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
          <NavIcon>{item.icon}</NavIcon>
          <span>{item.label}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" sideOffset={8} className="min-w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{item.label}</DropdownMenuLabel>
            {children.map((child) => (
              <DropdownMenuItem key={child.id} onClick={() => onNavigate(child.id)}>
                {child.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}

/**
 * Gives every row's icon the same small motion, so the rail feels alive even
 * where ReUI ships no animated variant of the glyph (it animates 57 of 667).
 * The row drives it, not the glyph: hover tilts and enlarges the icon, and the
 * active row keeps it enlarged. Animated icons run their own motion on top.
 */
function NavIcon({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <span className="inline-flex shrink-0 transition-transform duration-200 ease-out group-hover/menu-button:scale-110 group-hover/menu-button:-rotate-6 group-data-active/menu-button:scale-110 motion-reduce:transform-none motion-reduce:transition-none">
      {children}
    </span>
  )
}

function Leaf({
  item,
  isActive,
  onNavigate,
}: {
  item: ShellNavItem
  isActive: boolean
  onNavigate: (id: string) => void
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={item.label}
        isActive={isActive}
        {...(item.href
          ? {
              render: <a href={item.href} target="_blank" rel="noopener noreferrer" />,
            }
          : { onClick: () => onNavigate(item.id) })}
        aria-current={isActive ? 'page' : undefined}
        // Always named from the item, never inferred from its text: in the icon
        // rail the label is clipped away entirely.
        aria-label={item.label}
      >
        <NavIcon>{item.icon}</NavIcon>
        <span>{item.label}</span>
        {item.href ? (
          <ArrowUpRightIcon
            aria-hidden="true"
            className="text-muted-foreground ml-auto size-3.5 in-data-[state=collapsed]:hidden"
          />
        ) : null}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function ExpandedParent({
  item,
  activeItemId,
  open,
  onToggle,
  onNavigate,
}: {
  item: ShellNavItem
  activeItemId?: string
  open: boolean
  onToggle: () => void
  onNavigate: (id: string) => void
}) {
  const children = item.items ?? []
  const active = containsActive(item, activeItemId)

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={item.label}
        onClick={() => {
          // Opening a section lands on its first page.
          if (!open && !active) onNavigate(item.id)
          onToggle()
        }}
        aria-expanded={open}
        aria-controls={`subnav-${item.id}`}
      >
        <NavIcon>{item.icon}</NavIcon>
        <span className="truncate">{item.label}</span>
        <ChevronRightIcon
          aria-hidden
          className={cn(
            'ml-auto size-3.5 shrink-0 opacity-50 transition-transform duration-200',
            open && 'rotate-90',
          )}
        />
      </SidebarMenuButton>
      {open ? (
        <SidebarMenuSub id={`subnav-${item.id}`} className="mx-0 border-none px-0 ps-6.5">
          {children.map((child) => {
            const isActive = child.id === activeItemId
            return (
              <SidebarMenuSubItem key={child.id}>
                <SidebarMenuSubButton
                  render={<button type="button" />}
                  isActive={isActive}
                  onClick={() => onNavigate(child.id)}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={child.label}
                  className="h-8 w-full"
                >
                  <span>{child.label}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )
          })}
        </SidebarMenuSub>
      ) : null}
    </SidebarMenuItem>
  )
}

function Items({
  items,
  activeItemId,
  openId,
  onToggle,
  onNavigate,
}: {
  items: ShellNavItem[]
  activeItemId?: string
  openId: string | null
  onToggle: (id: string) => void
  onNavigate: (id: string) => void
}) {
  const { state, isMobile, setOpenMobile } = useSidebar()
  // The rail only exists on desktop; on mobile the sidebar is a sheet and is
  // always at full width, so the flyout branch would be wrong there.
  const isRail = state === 'collapsed' && !isMobile

  /*
   * On a phone the sheet covers most of the screen, so leaving it open after a
   * destination is chosen reads as a tap that did nothing. Every row navigates
   * through here, including a parent that redirects to its first child.
   */
  const navigate = (id: string) => {
    if (isMobile) setOpenMobile(false)
    onNavigate(id)
  }

  return (
    <SidebarMenu className="gap-0.5">
      {items.map((item) => {
        if ((item.items ?? []).length === 0) {
          return (
            <Leaf
              key={item.id}
              item={item}
              isActive={item.id === activeItemId}
              onNavigate={navigate}
            />
          )
        }
        if (isRail) {
          return (
            <CollapsedParent
              key={item.id}
              item={item}
              {...(activeItemId === undefined ? {} : { activeItemId })}
              onNavigate={navigate}
            />
          )
        }
        return (
          <ExpandedParent
            key={item.id}
            item={item}
            {...(activeItemId === undefined ? {} : { activeItemId })}
            open={openId === item.id}
            onToggle={() => onToggle(item.id)}
            onNavigate={navigate}
          />
        )
      })}
    </SidebarMenu>
  )
}

export function ShellNav({
  groups,
  activeItemId,
  onNavigate,
  pinned,
}: ShellNavProps & { pinned?: ReactNode }) {
  // One section open at a time across every group, defaulting to the one that
  // holds the current page. The default follows the page when it changes (a
  // deep link, the back button) so the open section never falls out of step
  // with the URL.
  const current =
    groups.flatMap((group) => group.items).find((item) => containsActive(item, activeItemId))?.id ??
    null
  const [openId, setOpenId] = useState<string | null>(current)
  const [seenCurrent, setSeenCurrent] = useState<string | null>(current)
  if (seenCurrent !== current) {
    setSeenCurrent(current)
    setOpenId(current)
  }
  const effectiveOpen = openId ?? current

  return (
    <>
      {groups.map((group, index) => {
        const showPinned = Boolean(group.pinned && pinned && !groups[index - 1]?.pinned)
        return (
          <Fragment key={group.id}>
            {showPinned ? (
              <div className="mt-auto px-2 pt-2 pb-1 in-data-[state=collapsed]:hidden">{pinned}</div>
            ) : null}
            <SidebarGroup
              className={cn(
                group.pinned && !showPinned && 'mt-auto',
                group.pinned && 'border-t pt-2 pb-0',
              )}
              data-pinned={group.pinned ? '' : undefined}
            >
              {group.title ? <SidebarGroupLabel>{group.title}</SidebarGroupLabel> : null}
              <SidebarGroupContent>
                <Items
                  items={group.items}
                  {...(activeItemId === undefined ? {} : { activeItemId })}
                  openId={effectiveOpen}
                  onToggle={(id) => setOpenId(effectiveOpen === id ? '' : id)}
                  onNavigate={onNavigate}
                />
              </SidebarGroupContent>
            </SidebarGroup>
          </Fragment>
        )
      })}
    </>
  )
}
