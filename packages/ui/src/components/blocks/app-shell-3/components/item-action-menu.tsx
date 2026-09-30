// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
"use client"

import { Fragment } from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ui/components/primitives/dropdown-menu"
import { SidebarMenuAction } from "@ui/components/primitives/sidebar"
import { IconPlaceholder } from "./icon-placeholder"

import { ITEM_ACTIONS } from "./data"

export function ItemActionMenu({ label }: { label: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuAction showOnHover aria-label={`Actions for ${label}`} />
        }
      >
        <IconPlaceholder
          lucide="MoreHorizontalIcon"
          tabler="IconDots"
          hugeicons="MoreHorizontalCircle01Icon"
          phosphor="DotsThreeIcon"
          remixicon="RiMoreLine"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      {/* Content */}
      <DropdownMenuContent
        side="right"
        align="start"
        sideOffset={4}
        className="w-44"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          {ITEM_ACTIONS.map((action) => (
            <Fragment key={action.id}>
              {action.destructive && <DropdownMenuSeparator />}
              <DropdownMenuItem
                variant={action.destructive ? "destructive" : "default"}
                className="[&_svg]:size-3.5 [&_svg]:opacity-60"
              >
                {action.icon}
                {action.label}
              </DropdownMenuItem>
            </Fragment>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}