// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import { type CSSProperties } from "react"
import { cn } from "cn"

import { SidebarProvider } from "@ui/primitives/sidebar"

import { AppShellContent } from "./app-shell-content"

export function AppShell() {
  return (
    <SidebarProvider
      className={cn(
        "h-screen",
        "[--header-height:60px] md:[--header-height:80px]",
        "[--sidebar-accent:color-mix(in_oklab,var(--color-primary)_5%,transparent)]",
        "[--sidebar-accent-foreground:var(--color-primary)]"
      )}
      style={
        {
          "--sidebar-width": "76px",
          "--sidebar-width-inner": "240px",
        } as CSSProperties
      }
    >
      <AppShellContent />
    </SidebarProvider>
  )
}