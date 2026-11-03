// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
"use client"

import { useState } from "react"
import { cn } from "cn"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@ui/components/primitives/breadcrumb"
import { Button } from "@ui/components/primitives/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ui/components/primitives/dropdown-menu"
import { SidebarTrigger } from "@ui/components/primitives/sidebar"
import { APPS, ENVIRONMENTS, WORKSPACES } from "./data"
import { Logo } from "./logo"
import { SystemStats } from "./system-stats"
import { ChevronsUpDownIcon, CheckIcon, PlusIcon } from "lucide-react"

// ── Org Switcher ──

function OrgSwitcher() {
  const [activeOrg, setActiveOrg] = useState(WORKSPACES[0])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            // Button ships shrink-0; a breadcrumb crumb has to be able to give
            // up width, so opt back into shrinking and let the label truncate
            className="text-foreground min-w-0 shrink"
          />
        }
      >
        <activeOrg.Logo className="size-3" />
        <span className="sr-only truncate sm:not-sr-only">
          {activeOrg.name}
        </span>
        <ChevronsUpDownIcon className="size-3.5 opacity-60" aria-hidden="true" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={8} className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Organizations</DropdownMenuLabel>
          <DropdownMenuGroup>
            {WORKSPACES.map((ws) => (
              <DropdownMenuItem
                key={ws.id}
                onClick={() => setActiveOrg(ws)}
                className={cn(activeOrg.id === ws.id && "bg-accent")}
              >
                <ws.Logo className="size-5 shrink-0" />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm">{ws.name}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {ws.tier}
                  </span>
                </div>
                {activeOrg.id === ws.id && (
                  <CheckIcon className="text-primary ml-auto size-4" aria-hidden="true" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <PlusIcon aria-hidden="true" />
            Create Organization
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── App Switcher ──

function AppSwitcher() {
  const [activeApp, setActiveApp] = useState(
    APPS.find((a) => a.isActive) ?? APPS[0]
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="text-foreground min-w-0 shrink"
          />
        }
      >
        <span className="hidden truncate sm:inline">{activeApp.name}</span>
        <span className="truncate sm:hidden">
          {activeApp.name.split(" ")[0]}
        </span>
        <ChevronsUpDownIcon className="size-3.5 opacity-60" aria-hidden="true" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={8} className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Applications</DropdownMenuLabel>
          <DropdownMenuGroup>
            {APPS.map((app) => (
              <DropdownMenuItem
                key={app.id}
                onClick={() => setActiveApp(app)}
                className={cn(activeApp.id === app.id && "bg-accent")}
              >
                {app.icon}
                {app.name}
                {activeApp.id === app.id && (
                  <CheckIcon className="text-primary ml-auto size-4" aria-hidden="true" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <PlusIcon aria-hidden="true" />
            Create Application
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Environment Switcher ──

function EnvironmentSwitcher() {
  const [activeEnv, setActiveEnv] = useState(
    ENVIRONMENTS.find((e) => e.isActive) ?? ENVIRONMENTS[0]
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="text-foreground min-w-0 shrink"
          />
        }
      >
        <span className="truncate">{activeEnv.name}</span>
        <ChevronsUpDownIcon className="size-3.5 opacity-60" aria-hidden="true" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={8} className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Environments</DropdownMenuLabel>
          <DropdownMenuGroup>
            {ENVIRONMENTS.map((env) => (
              <DropdownMenuItem
                key={env.id}
                onClick={() => setActiveEnv(env)}
                className={cn(activeEnv.id === env.id && "bg-accent")}
              >
                {env.icon}
                {env.name}
                {activeEnv.id === env.id && (
                  <CheckIcon className="text-primary ml-auto size-4" aria-hidden="true" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Site Header ──

export function AppHeader() {
  return (
    <header className="bg-background sticky top-0 z-50 flex w-full items-center border-b">
      <div className="flex h-(--header-height) w-full items-center gap-2 px-4">
        {/* Mobile sidebar trigger */}
        <SidebarTrigger className="md:hidden" />

        {/* Logo */}
        <div className="hidden items-center pl-0.5 md:flex">
          <Logo />
        </div>

        {/* min-w-0 is what lets the trail shrink instead of pushing; without
            it the flex item keeps its intrinsic width and the list wraps out
            of the fixed-height header */}
        <Breadcrumb className="min-w-0 flex-1">
          {/* flex-nowrap overrides the primitive's flex-wrap: a header trail
              lives on ONE line and degrades by truncating, never by stacking */}
          <BreadcrumbList className="flex-nowrap gap-1">
            {/* the org logo is the identity anchor: it may lose its label, but
                never its tap target, so it floors at icon + chevron */}
            <BreadcrumbItem className="min-w-9">
              <OrgSwitcher />
            </BreadcrumbItem>
            <BreadcrumbSeparator className="shrink-0 text-xs opacity-60">
              /
            </BreadcrumbSeparator>
            {/* Below sm three switchers cannot all keep a real tap target, so
                the MIDDLE level drops out rather than every crumb smearing to a
                clipped sliver. Org (who) and environment (what am I changing)
                are the two that carry the operational signal; the app is still
                switchable from the sidebar. */}
            <BreadcrumbItem className="hidden min-w-0 sm:flex">
              <AppSwitcher />
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden shrink-0 text-xs opacity-60 sm:flex">
              /
            </BreadcrumbSeparator>
            {/* the leaf carries the operational signal (which environment am I
                changing?), so it is the last thing allowed to give up width */}
            <BreadcrumbItem className="min-w-0 shrink-0">
              <EnvironmentSwitcher />
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Right side */}
        <div className="flex shrink-0 items-center gap-1">
          <SystemStats />
        </div>
      </div>
    </header>
  )
}