// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
"use client"

import { useState } from "react"
import { cn } from "cn"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@ui/components/primitives/dropdown-menu"
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
} from "@ui/components/primitives/sidebar"
import { IconPlaceholder } from "./icon-placeholder"

import { NAV_MAIN, type NavChild, type NavItem } from "./data"

function NavSubItem({ child }: { child: NavChild }) {
  return (
    <SidebarMenuSubItem>
      {/* Sidebar */}
      <SidebarMenuSubButton render={<a href="#" />} isActive={child.isActive}>
        <span>{child.label}</span>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}

function NavSubMenu({ id, children }: { id: string; children: NavChild[] }) {
  return (
    <SidebarMenuSub id={`subnav-${id}`}>
      {children.map((child) => (
        <NavSubItem key={child.id} child={child} />
      ))}
    </SidebarMenuSub>
  )
}

// ── CollapsibleNavItem ──
// Isolated component so only this item re-renders on open/close toggle.

// Collapsed (icon) rail: the inline submenu would push the next item down, so
// the children open in a side dropdown anchored to the icon button instead.
function CollapsedNavItem({
  item,
}: {
  item: NavItem & { children: NavChild[] }
}) {
  return (
    <SidebarMenuItem>
      {/* Sidebar */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuButton
              tooltip={item.label}
              isActive={item.isActive}
              aria-label={item.label}
            />
          }
        >
          {item.icon}
          <span>{item.label}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="right"
          align="start"
          sideOffset={8}
          className="min-w-48"
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel>{item.label}</DropdownMenuLabel>
            {item.children.map((child) => (
              <DropdownMenuItem key={child.id} render={<a href="#" />}>
                {child.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}

// Expanded rail: the submenu expands inline under its parent button.
function ExpandedNavItem({
  item,
  open,
  onToggle,
}: {
  item: NavItem & { children: NavChild[] }
  open: boolean
  onToggle: () => void
}) {
  return (
    <SidebarMenuItem>
      {/* Sidebar */}
      <SidebarMenuButton
        tooltip={item.label}
        isActive={item.isActive}
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`subnav-${item.id}`}
      >
        {item.icon}
        <span className="truncate">{item.label}</span>
        <IconPlaceholder
          lucide="ChevronRightIcon"
          tabler="IconChevronRight"
          hugeicons="ArrowRight01Icon"
          phosphor="CaretRightIcon"
          remixicon="RiArrowRightSLine"
          className={cn(
            "ml-auto size-4 shrink-0 opacity-60 transition-transform duration-200",
            open && "rotate-90"
          )}
          aria-hidden="true"
        />
      </SidebarMenuButton>

      {open && <NavSubMenu id={item.id} children={item.children} />}
    </SidebarMenuItem>
  )
}

function CollapsibleNavItem({
  item,
}: {
  item: NavItem & { children: NavChild[] }
}) {
  const { state } = useSidebar()
  // Kept on the always-mounted parent so the expanded open state survives a
  // collapse/expand cycle instead of resetting when the branch swaps.
  const [open, setOpen] = useState(() => item.children.some((c) => c.isActive))

  return state === "collapsed" ? (
    <CollapsedNavItem item={item} />
  ) : (
    <ExpandedNavItem
      item={item}
      open={open}
      onToggle={() => setOpen((prev) => !prev)}
    />
  )
}

function LeafNavItem({ item }: { item: NavItem }) {
  return (
    <SidebarMenuItem>
      {/* Sidebar */}
      <SidebarMenuButton
        tooltip={item.label}
        isActive={item.isActive}
        render={<a href="#" />}
      >
        {item.icon}
        <span>{item.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export function NavMain() {
  return (
    <SidebarGroup>
      {/* Sidebar */}
      <SidebarGroupLabel className="in-data-[state=collapsed]:hidden">
        Platform
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {NAV_MAIN.map((item) =>
            item.children ? (
              <CollapsibleNavItem
                key={item.id}
                item={item as NavItem & { children: NavChild[] }}
              />
            ) : (
              <LeafNavItem key={item.id} item={item} />
            )
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}