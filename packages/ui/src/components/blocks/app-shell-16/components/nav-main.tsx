// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@ui/primitives/sidebar"

import { type NavItem } from "./data"

interface NavMainProps {
  items: NavItem[]
  activeNav: string
  onNavChange: (id: string) => void
}

export function NavMain({ items, activeNav, onNavChange }: NavMainProps) {
  return (
    <SidebarGroup className="p-0">
      <SidebarGroupContent className="justify-center">
        <SidebarMenu className="items-center gap-1.5">
          {items.map((item) => (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton
                tooltip={{ children: item.label, hidden: false }}
                isActive={activeNav === item.id}
                onClick={() => onNavChange(item.id)}
                aria-label={item.label}
                className="size-9 justify-center text-zinc-400 hover:bg-zinc-800 hover:text-white data-[active=true]:bg-zinc-800 data-[active=true]:text-white"
              >
                {item.icon}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}