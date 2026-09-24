// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import { type ReactNode } from "react"

import { Button } from "@ui/primitives/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ui/primitives/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@ui/primitives/sidebar"
import { NAV_ITEMS } from "./data"
import { Logo } from "./logo"
import { NavMain } from "./nav-main"
import { NavUser } from "./nav-user"
import { InboxIcon, CalendarDaysIcon, SettingsIcon } from "lucide-react"

interface AppSidebarProps {
  activeNav: string
  onNavChange: (id: string) => void
  innerContent?: ReactNode
}

function RailAction({
  label,
  icon,
  items,
}: {
  label: string
  icon: ReactNode
  items: string[]
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            className="text-zinc-400 hover:bg-zinc-800 hover:text-white"
          />
        }
      >
        {icon}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" sideOffset={10}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {items.map((item) => (
            <DropdownMenuItem key={item}>{item}</DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppSidebar({
  activeNav,
  onNavChange,
  innerContent,
}: AppSidebarProps) {
  return (
    <Sidebar
      collapsible="icon"
      className="bg-muted dark:bg-background top-0 bottom-0 border-0 p-0"
      variant="inset"
    >
      <div className="bg-muted dark:bg-background flex h-full grow">
        <div className="my-2.5 ms-2.5 me-2.5 flex w-14 shrink-0 flex-col items-center gap-3 rounded-2xl bg-black py-3 text-zinc-400">
          <SidebarHeader className="flex items-center justify-center p-0 pt-0.5">
            <a href="#" aria-label="Open Thunder AI">
              <Logo />
            </a>
          </SidebarHeader>

          <SidebarContent className="min-h-0 flex-1 flex-row pt-2 md:flex-col">
            <NavMain
              items={NAV_ITEMS}
              activeNav={activeNav}
              onNavChange={onNavChange}
            />
          </SidebarContent>

          <SidebarFooter className="items-center gap-1 p-0 pb-1">
            <RailAction
              label="Inbox"
              items={["Mentions", "Direct Messages", "Digest"]}
              icon={
                <InboxIcon aria-hidden="true" />
              }
            />
            <RailAction
              label="Calendar"
              items={["Today", "This Week", "Shared Calendar"]}
              icon={
                <CalendarDaysIcon aria-hidden="true" />
              }
            />
            <RailAction
              label="Settings"
              items={["Preferences", "Members", "Security"]}
              icon={
                <SettingsIcon aria-hidden="true" />
              }
            />
            <NavUser />
          </SidebarFooter>
        </div>

        {innerContent && (
          <div className="border-border/60 flex flex-1 grow flex-col overflow-hidden border-l md:hidden">
            {innerContent}
          </div>
        )}
      </div>
    </Sidebar>
  )
}