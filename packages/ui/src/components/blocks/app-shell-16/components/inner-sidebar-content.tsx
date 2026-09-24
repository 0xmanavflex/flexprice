// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import { useState } from "react"
import { cn } from "cn"

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
import { ScrollArea } from "@ui/primitives/scroll-area"
import { INNER_NAV, WORKSPACES, type Workspace } from "./data"
import { InnerSidebarNav } from "./inner-sidebar-nav"
import { ChevronsUpDownIcon, CheckIcon, PlusIcon } from "lucide-react"

interface InnerSidebarContentProps {
  activeNav: string
}

function WorkspaceBadge({
  workspace,
  className,
}: {
  workspace: Workspace
  className?: string
}) {
  return (
    <span
      data-slot="workspace-badge"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md text-white! [&_*]:text-white! [&_svg]:text-white! [&_svg_*]:text-white!",
        workspace.color,
        className
      )}
      aria-hidden="true"
    >
      {workspace.icon}
    </span>
  )
}

function WorkspaceSwitcher() {
  const [activeWorkspace, setActiveWorkspace] = useState(WORKSPACES[0])

  return (
    <div className="flex shrink-0 px-2 pt-4 pb-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              aria-label="Switch workspace"
              className="hover:bg-background/70 -ms-1.5 h-auto w-[calc(100%+0.375rem)] justify-start gap-2.5 rounded-md px-2 py-1.5 text-left"
            />
          }
        >
          <WorkspaceBadge
            workspace={activeWorkspace}
            className="size-8 [&_svg]:size-4"
          />
          <span className="grid min-w-0 flex-1">
            <span className="text-foreground truncate text-sm font-semibold">
              {activeWorkspace.name}
            </span>
            <span className="text-muted-foreground truncate text-xs">
              {activeWorkspace.members} members
            </span>
          </span>
          <ChevronsUpDownIcon className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" sideOffset={6} className="w-60">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
              Workspaces
            </DropdownMenuLabel>
            {WORKSPACES.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                onClick={() => setActiveWorkspace(workspace)}
                className="gap-2.5 [&_[data-slot=workspace-badge]]:text-white! [&_[data-slot=workspace-badge]_*]:text-white!"
              >
                <WorkspaceBadge
                  workspace={workspace}
                  className="size-7 [&_svg]:size-3.5"
                />
                <span className="grid min-w-0 flex-1">
                  <span className="truncate text-sm font-medium">
                    {workspace.name}
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    {workspace.members} members
                  </span>
                </span>
                {activeWorkspace.id === workspace.id && (
                  <CheckIcon className="text-primary size-4 shrink-0" aria-hidden="true" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2.5">
            <span className="border-input text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-md border border-dashed">
              <PlusIcon className="size-3.5" aria-hidden="true" />
            </span>
            <span className="grid min-w-0 flex-1">
              <span className="text-sm font-medium">New Workspace</span>
              <span className="text-muted-foreground truncate text-xs">
                Collaborate with others.
              </span>
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function InnerSidebarContent({ activeNav }: InnerSidebarContentProps) {
  const navData = INNER_NAV[activeNav] ?? INNER_NAV.updates
  const sections = navData?.sections ?? []

  const allItems = sections.flatMap((s) => s.items)

  const [activeItem, setActiveItem] = useState<string>(() => {
    const defaultActive = allItems.find((i) => i.isActive)
    return defaultActive?.id ?? allItems[0]?.id ?? ""
  })

  const currentActiveItem = allItems.find((i) => i.id === activeItem)
    ? activeItem
    : (allItems[0]?.id ?? "")

  return (
    <>
      <WorkspaceSwitcher />
      <div className="max-h-full min-h-0 grow">
        <ScrollArea className="h-full grow">
          <InnerSidebarNav
            sections={sections}
            activeItem={currentActiveItem}
            onItemChange={setActiveItem}
          />
        </ScrollArea>
      </div>
    </>
  )
}