// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
"use client"

import { useState } from "react"

import { Card } from "@ui/primitives/card"
import { SidebarInset } from "@ui/primitives/sidebar"

import { AppHeader } from "./app-header"
import { AppSidebar } from "./app-sidebar"
import { NAV_ITEMS } from "./data"
import { InnerSidebar } from "./inner-sidebar"
import { InnerSidebarContent } from "./inner-sidebar-content"

export function AppShellContent() {
  const [activeNav, setActiveNav] = useState("updates")

  const activeLabel = NAV_ITEMS.find((n) => n.id === activeNav)?.label ?? ""

  const innerContent = <InnerSidebarContent activeNav={activeNav} />

  return (
    <>
      {/* Sidebar */}
      <AppSidebar
        activeNav={activeNav}
        onNavChange={setActiveNav}
        innerContent={innerContent}
      />
      <InnerSidebar label={activeLabel}>{innerContent}</InnerSidebar>

      <SidebarInset className="bg-background dark:border-border/60 m-0! overflow-hidden rounded-none! shadow-none! dark:border-l">
        <AppHeader />

        <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-3 md:px-6 md:pt-4 md:pb-5">
          <div className="flex flex-col gap-1 md:hidden">
            <h1 className="text-base font-semibold">Updates</h1>
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <span>Home</span>
              <span aria-hidden="true">/</span>
              <span>Account</span>
              <span aria-hidden="true">/</span>
              <span className="text-foreground">Updates</span>
            </div>
          </div>

          <div className="grid auto-rows-min gap-4 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card
                key={index}
                className="border-border/60 bg-muted/30 aspect-video border-dashed shadow-none"
                aria-hidden="true"
              />
            ))}
            <Card
              className="border-border/60 bg-muted/30 min-h-[520px] border-dashed shadow-none md:col-span-3"
              aria-hidden="true"
            />
          </div>
        </main>
      </SidebarInset>
    </>
  )
}