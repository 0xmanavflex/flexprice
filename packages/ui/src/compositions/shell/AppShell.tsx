import { type CSSProperties, type ReactNode } from 'react'
import { SearchIcon } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@ui/primitives/sidebar'
import { Button } from '@ui/primitives/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/primitives/tooltip'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { EnvironmentSwitcher } from './EnvironmentSwitcher'
import type { ShellEnvironment, ShellNavGroup, ShellSection, ShellUser } from './types'

/**
 * The application shell: an icon rail, a per-section navigation panel, and a
 * header.
 *
 * Two levels rather than one because Flexprice has six sections averaging three
 * children each. A single flat sidebar would be twenty-plus items with no
 * grouping, and a top-nav-only shell has nowhere to put the children at all.
 * The second panel swaps to whichever section is active.
 *
 * Entirely controlled and entirely presentational — it holds no route state,
 * performs no navigation, and cannot import the query layer. The app decides
 * what a section change means. That is what lets every arrangement below be a
 * story: an empty catalogue, a production environment, a section with no
 * children.
 */
export const AppShellProvenance = provenance({
  source: 'composition',
  composes: ['ui/sidebar', 'ui/button', 'ui/tooltip', '@reui/badge'],
  note: 'Adapted from @reui/app-shell-16 — dual sidebar, controlled, no routing knowledge.',
})

export interface AppShellProps {
  sections: ShellSection[]
  activeSectionId: string
  onSectionChange: (sectionId: string) => void

  /** The active section's own navigation. Empty renders no second panel. */
  navGroups: ShellNavGroup[]
  activeItemId?: string
  onNavigate: (itemId: string) => void

  environment: ShellEnvironment
  environments: ShellEnvironment[]
  onEnvironmentChange: (environmentId: string) => void

  user: ShellUser
  accountMenu?: ReactNode
  onOpenSearch?: () => void
  breadcrumb?: ReactNode
  children: ReactNode
}

export function AppShell({
  sections,
  activeSectionId,
  onSectionChange,
  navGroups,
  activeItemId,
  onNavigate,
  environment,
  environments,
  onEnvironmentChange,
  user,
  accountMenu,
  onOpenSearch,
  breadcrumb,
  children,
}: AppShellProps) {
  const activeSection = sections.find((section) => section.id === activeSectionId)
  const hasNav = navGroups.some((group) => group.items.length > 0)
  const isProduction = environment.kind === 'production'

  return (
    <SidebarProvider
      className="h-screen [--header-height:56px]"
      style={{ '--sidebar-width': '72px' } as CSSProperties}
    >
      {/*
        A border across the whole shell, not only on the switcher. The point is
        that it is visible no matter where the eye is — someone deep in a form
        should still be able to tell they are editing live data.
      */}
      {isProduction ? (
        <div
          aria-hidden
          className="bg-destructive fixed inset-x-0 top-0 z-50 h-1"
        />
      ) : null}

      {/* The icon rail: one entry per section. */}
      <Sidebar collapsible="none" className="w-[72px] border-r" aria-label="Sections">
        <SidebarContent className="items-center gap-1 py-3">
          <SidebarMenu className="items-center gap-1">
            {sections.map((section) => (
              <SidebarMenuItem key={section.id}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <SidebarMenuButton
                        isActive={section.id === activeSectionId}
                        onClick={() => onSectionChange(section.id)}
                        aria-current={section.id === activeSectionId ? 'page' : undefined}
                        aria-label={section.label}
                        className="size-10 justify-center p-0"
                      />
                    }
                  >
                    {section.icon}
                  </TooltipTrigger>
                  <TooltipContent side="right">{section.label}</TooltipContent>
                </Tooltip>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>

      {/* The section's own navigation. Absent when a section has no children. */}
      {hasNav ? (
        <Sidebar collapsible="none" className="w-60 border-r" aria-label={activeSection?.label}>
          <SidebarContent>
            <div className="px-4 py-3">
              <p className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                {activeSection?.label}
              </p>
            </div>

            {navGroups.map((group) => (
              <SidebarGroup key={group.id}>
                {group.title ? <SidebarGroupLabel>{group.title}</SidebarGroupLabel> : null}
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={item.id === activeItemId}
                        onClick={() => onNavigate(item.id)}
                        aria-current={item.id === activeItemId ? 'page' : undefined}
                      >
                        {item.label}
                      </SidebarMenuButton>
                      {/*
                        `aria-hidden` because the count is repeated in the
                        button's accessible name below — otherwise a screen
                        reader hears the number twice with no context.
                      */}
                      {item.count !== undefined ? (
                        <SidebarMenuBadge aria-hidden>{item.count}</SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            ))}
          </SidebarContent>
        </Sidebar>
      ) : null}

      <SidebarInset className="m-0! overflow-hidden rounded-none! shadow-none!">
        <header
          className={cn(
            'flex h-(--header-height) shrink-0 items-center gap-3 border-b px-4',
            isProduction && 'pt-1',
          )}
        >
          <EnvironmentSwitcher
            current={environment}
            environments={environments}
            onChange={onEnvironmentChange}
          />

          {breadcrumb ? <div className="min-w-0 flex-1">{breadcrumb}</div> : <div className="flex-1" />}

          {onOpenSearch ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenSearch}
              className="gap-2 text-muted-foreground"
            >
              <SearchIcon className="size-4" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden rounded border px-1 text-[10px] sm:inline">⌘K</kbd>
            </Button>
          ) : null}

          {accountMenu ?? (
            <span className="text-sm text-muted-foreground" title={user.email}>
              {user.name}
            </span>
          )}
        </header>

        {/*
          A div, not a `main`. `SidebarInset` is already the `main` landmark —
          nesting another inside it produces two, and a document may have one.
        */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
