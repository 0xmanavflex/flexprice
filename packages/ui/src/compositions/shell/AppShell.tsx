import { type CSSProperties, type ReactNode } from 'react'
import { SearchIcon } from 'lucide-react'
import { Input } from '@ui/primitives/input'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@ui/primitives/sidebar'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { EnvironmentSwitcher } from './EnvironmentSwitcher'
import { ShellNav } from './ShellNav'
import type { ShellEnvironment, ShellNavGroup, ShellUser } from './types'

/**
 * The application shell, adapted from `@reui/app-shell-3`.
 *
 * One inset sidebar that collapses to icons, with nested navigation, the search
 * field *inside* the sidebar, and a pinned slot above the footer. The header is
 * deliberately thin — a breadcrumb and nothing else.
 *
 * This replaces a two-level rail, and the reason is the product's own shape:
 * twenty-four destinations across three deep groups. A rail that swaps its
 * panel shows one group at a time, so standing in the catalogue you cannot see
 * that Billing has invoices under it. Nesting keeps the whole tree legible, and
 * it is the model the current dashboard already uses.
 *
 * The active-item treatment is the block's and is why it reads as layered: the
 * selected row is a raised card — border, shadow, background — rather than a
 * tint, and hover is transparent so the selection is the only surface.
 *
 * Fully controlled and entirely presentational: no route state, no navigation,
 * and it cannot import the query layer. That is what lets every arrangement be
 * a story.
 */
export const AppShellProvenance = provenance({
  source: 'composition',
  composes: ['@reui/app-shell-3', 'ui/sidebar', 'ui/input', '@reui/badge'],
  note: 'Adapted from app-shell-3: single inset sidebar, nested nav, our controlled contract.',
})

export interface AppShellProps {
  navGroups: ShellNavGroup[]
  activeItemId?: string
  onNavigate: (itemId: string) => void

  environment: ShellEnvironment
  environments: ShellEnvironment[]
  onEnvironmentChange: (environmentId: string) => void

  user: ShellUser
  productName?: string
  logo?: ReactNode
  onSearch?: (term: string) => void
  /** Pinned above the footer — an allowance, a usage meter, an alert count. */
  pinned?: ReactNode
  breadcrumb?: ReactNode
  accountMenu?: ReactNode
  children: ReactNode
}

/**
 * The block's selection treatment, lifted as written.
 *
 * Expressed as data-slot selectors because they reach inside the Sidebar
 * primitive's own markup — which is vendored, and which we must not fork to
 * restyle.
 */
const SELECTION = [
  '[&_[data-slot=sidebar-menu-button][data-active]]:border-border/60!',
  '[&_[data-slot=sidebar-menu-button][data-active]]:border',
  '[&_[data-slot=sidebar-menu-button][data-active]]:shadow-xs!',
  '[&_[data-slot=sidebar-menu-button][data-active]]:bg-background!',
  '[&_[data-slot=sidebar-menu-button][data-active]]:hover:bg-background!',
  '**:data-[slot=sidebar-menu-button]:hover:bg-transparent!',
  '[&_[data-slot=sidebar-menu-button][data-active]]:text-foreground',
  '**:data-[slot=sidebar-menu-button]:hover:text-foreground',
  '[&_[data-slot=sidebar-menu-sub-button][data-active]]:border-border/60!',
  '[&_[data-slot=sidebar-menu-sub-button][data-active]]:border',
  '[&_[data-slot=sidebar-menu-sub-button][data-active]]:shadow-xs!',
  '[&_[data-slot=sidebar-menu-sub-button][data-active]]:bg-background!',
  '**:data-[slot=sidebar-menu-sub-button]:hover:bg-transparent!',
].join(' ')

export function AppShell({
  navGroups,
  activeItemId,
  onNavigate,
  environment,
  environments,
  onEnvironmentChange,
  user,
  productName = 'Flexprice',
  logo,
  onSearch,
  pinned,
  breadcrumb,
  accountMenu,
  children,
}: AppShellProps) {
  const isProduction = environment.kind === 'production'

  return (
    <SidebarProvider
      className={cn('h-screen', SELECTION)}
      style={{ '--sidebar-width': '260px' } as CSSProperties}
    >
      {/*
        A marker across the whole shell, not only on the switcher — visible
        wherever the eye is, so someone deep in a form can still tell they are
        editing live data.
      */}
      {isProduction ? (
        <div aria-hidden className="bg-destructive fixed inset-x-0 top-0 z-50 h-1" />
      ) : null}

      <Sidebar collapsible="icon" variant="inset" aria-label="Main">
        <SidebarHeader className="gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-h-9 items-center gap-2 px-0.5">
              {logo ?? (
                <span
                  aria-hidden
                  className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold"
                >
                  F
                </span>
              )}
              <span className="truncate text-sm font-medium in-data-[state=collapsed]:hidden">
                {productName}
              </span>
            </div>
            <SidebarTrigger className="opacity-60 hover:opacity-100" />
          </div>

          {/*
            The environment switcher sits at the top, not in the footer where
            the block puts its workspace picker. It is the most consequential
            control in the product — editing a live plan is not the same act as
            editing a sandbox one — and burying it would contradict that.
          */}
          <div className="in-data-[state=collapsed]:hidden">
            <EnvironmentSwitcher
              current={environment}
              environments={environments}
              onChange={onEnvironmentChange}
            />
          </div>
        </SidebarHeader>

        <SidebarContent>
          {/* Search lives in the sidebar, as the block has it. */}
          <div className="px-2 py-2 in-data-[state=collapsed]:hidden">
            <form
              role="search"
              className="relative"
              onSubmit={(event) => {
                event.preventDefault()
                onSearch?.(new FormData(event.currentTarget).get('q')?.toString() ?? '')
              }}
            >
              <SearchIcon
                aria-hidden
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
              />
              <Input
                type="search"
                name="q"
                aria-label="Search"
                placeholder="Search"
                className="h-8 pl-8"
              />
            </form>
          </div>

          <ShellNav
            groups={navGroups}
            {...(activeItemId === undefined ? {} : { activeItemId })}
            onNavigate={onNavigate}
          />

          {pinned ? (
            <div className="mt-auto px-2 pb-2 in-data-[state=collapsed]:hidden">{pinned}</div>
          ) : null}
        </SidebarContent>

        <SidebarFooter>
          {accountMenu ?? (
            <div className="flex min-w-0 flex-col px-2 py-1 in-data-[state=collapsed]:hidden">
              <span className="truncate text-sm font-medium">{user.name}</span>
              <span className="text-muted-foreground truncate text-xs">{user.email}</span>
            </div>
          )}
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="ml-0! flex min-h-0 flex-col overflow-hidden">
        <header
          className={cn('flex h-12 shrink-0 items-center gap-2 px-4', isProduction && 'pt-1')}
        >
          <SidebarTrigger className="-ml-1 md:hidden" />
          {breadcrumb}
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
