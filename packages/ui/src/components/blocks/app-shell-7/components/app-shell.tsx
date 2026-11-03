// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import { type CSSProperties } from "react"
import { cn } from "cn"

import { SidebarInset, SidebarProvider } from "@ui/components/primitives/sidebar"

import { AppHeader } from "./app-header"
import { AppSidebar } from "./app-sidebar"

export function AppShell() {
  return (
    <SidebarProvider
      className={cn(
        "flex flex-col",
        "[--sidebar:var(--color-background)]",
        "[--sidebar-accent:color-mix(in_oklab,var(--color-primary)_5%,transparent)]",
        "[--sidebar-accent-foreground:var(--color-primary)]"
      )}
      style={
        {
          "--sidebar-width": "260px",
          "--sidebar-width-icon": "62px",
          "--header-height": "50px",
        } as CSSProperties
      }
    >
      {/* Header */}
      <AppHeader />
      <div className="flex flex-1">
        <AppSidebar />
        <SidebarInset>
          <div className="flex flex-1 flex-col gap-4 p-4">
            <div className="grid auto-rows-min gap-4 md:grid-cols-3">
              <div className="border-border/40 bg-muted/40 aspect-video rounded-lg border border-dashed" />
              <div className="border-border/40 bg-muted/40 aspect-video rounded-lg border border-dashed" />
              <div className="border-border/40 bg-muted/40 aspect-video rounded-lg border border-dashed" />
            </div>
            <div className="border-border/40 bg-muted/40 min-h-[1000px] flex-1 rounded-lg border border-dashed" />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}