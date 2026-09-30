// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import { cn } from "cn"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@ui/components/primitives/breadcrumb"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@ui/components/primitives/sidebar"
import { IconPlaceholder } from "./icon-placeholder"

import { AppSidebar } from "./app-sidebar"
import { BulletSeparator } from "./bullet-separator"

export function AppShell() {
  return (
    <SidebarProvider
      className={cn(
        "[--sidebar-width:260px]",
        "[--sidebar-border:transparent]",
        "[&_[data-slot=sidebar-menu-button][data-active]]:border-border/60! [&_[data-slot=sidebar-menu-button][data-active]]:border",
        "[&_[data-slot=sidebar-menu-button][data-active]]:shadow-xs! [&_[data-slot=sidebar-menu-button][data-active]]:shadow-black/5!",
        "[&_[data-slot=sidebar-menu-button][data-active]]:bg-background! [&_[data-slot=sidebar-menu-button][data-active]]:hover:bg-background! **:data-[slot=sidebar-menu-button]:hover:bg-transparent!",
        "[&_[data-slot=sidebar-menu-button][data-active]]:text-foreground [&_[data-slot=sidebar-menu-button][data-active]>svg]:text-primary [&_[data-slot=sidebar-menu-button][data-active]>svg]:opacity-100",
        "**:data-[slot=sidebar-menu-button]:text-accent-foreground/80 **:data-[slot=sidebar-menu-button]:hover:text-foreground",
        "[&_[data-collapsible=icon]_[data-slot=sidebar-menu-button][data-active]>svg]:-ml-px",
        "[&_[data-slot=sidebar-menu-button]:hover>svg]:opacity-100 [&_[data-slot=sidebar-menu-button]>svg]:opacity-60",
        "[&_[data-slot=sidebar-menu-sub-button][data-active]]:border-border/60! [&_[data-slot=sidebar-menu-sub-button][data-active]]:border",
        "[&_[data-slot=sidebar-menu-sub-button][data-active]]:shadow-xs! [&_[data-slot=sidebar-menu-sub-button][data-active]]:shadow-black/5!",
        "[&_[data-slot=sidebar-menu-sub-button][data-active]]:bg-background! [&_[data-slot=sidebar-menu-sub-button][data-active]]:hover:bg-background! **:data-[slot=sidebar-menu-sub-button]:hover:bg-transparent!",
        "[&_[data-slot=sidebar-menu-sub-button][data-active]]:text-foreground [&_[data-slot=sidebar-menu-sub-button][data-active]>svg]:text-primary [&_[data-slot=sidebar-menu-sub-button][data-active]>svg]:opacity-100",
        "**:data-[slot=sidebar-menu-sub-button]:text-accent-foreground/80 **:data-[slot=sidebar-menu-sub-button]:hover:text-foreground",
        "[&_[data-slot=sidebar-menu-sub-button]:hover>svg]:opacity-100 [&_[data-slot=sidebar-menu-sub-button]>svg]:opacity-60",
        "h-screen"
      )}
    >
      {/* Sidebar */}
      <AppSidebar />
      <SidebarInset className="ml-0! overflow-y-auto">
        <header className="flex h-12 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1 md:hidden" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden items-center md:flex">
                  <BreadcrumbLink
                    href="#"
                    className="flex items-center gap-1.5"
                  >
                    <IconPlaceholder
                      lucide="HouseIcon"
                      tabler="IconHome"
                      hugeicons="Home03Icon"
                      phosphor="HouseIcon"
                      remixicon="RiHome5Line"
                      className="size-4"
                      aria-hidden="true"
                    />
                    Home
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden items-center md:flex">
                  <BulletSeparator />
                </BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbPage>Overview</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 px-4 pb-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="bg-muted/40 border-border/40 aspect-video rounded-lg border" />
            <div className="bg-muted/40 border-border/40 aspect-video rounded-lg border" />
            <div className="bg-muted/40 border-border/40 aspect-video rounded-lg border" />
          </div>
          <div className="bg-muted/40 border-border/40 h-full rounded-lg border" />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}