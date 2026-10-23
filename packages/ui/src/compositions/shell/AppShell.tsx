import { type ReactNode } from 'react'
import flexpriceIcon from '@ui/assets/flexprice-icon.png'
import { TooltipProvider } from '@ui/components/primitives/tooltip'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@ui/components/primitives/sidebar'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { ShellAccount } from './ShellAccount'
import { ShellNav } from './ShellNav'
import { ShellSearch, type ShellSearchProps } from './ShellSearch'
import { ThemeShortcut } from './ThemeShortcut'
import type { ShellNavGroup, ShellUser } from './types'

/**
 * The application shell, as the reference app draws it.
 *
 * One inset sidebar that collapses to icons, with the brand mark and the
 * tenant's name at the top, nested navigation below, and the account menu at
 * the bottom. The header carries the breadcrumb — which leads
 * with the environment switcher — and, top-right, search beside whatever one
 * control belongs to the whole page rather than to its content.
 *
 * This replaces a two-level rail, and the reason is the product's own shape:
 * twenty-four destinations across three deep groups. A rail that swaps its
 * panel shows one group at a time, so standing in the catalogue you cannot see
 * that Billing has invoices under it. Nesting keeps the whole tree legible, and
 * it is the model the current dashboard already uses.
 *
 * Fully controlled and entirely presentational: no route state, no navigation,
 * and it cannot import the query layer. That is what lets every arrangement be
 * a story.
 */
export const AppShellProvenance = provenance({
  source: 'composition',
  composes: ['ui/sidebar'],
  note: "The reference shell's layout and surface, with our controlled contract. Lineage: @reui/app-shell-3, ui/breadcrumb, ui/dropdown-menu.",
})

export interface AppShellProps {
  navGroups: ShellNavGroup[]
  activeItemId?: string
  onNavigate: (itemId: string) => void

  user: ShellUser
  onProfile?: () => void
  onSettings?: () => void
  onSignOut?: () => void

  productName?: string
  logo?: ReactNode
  /** Global search: static items, async results and the select handler. */
  search?: ShellSearchProps

  /** Pinned above the footer — an allowance, a usage meter, an alert count. */
  pinned?: ReactNode
  breadcrumb?: ReactNode
  /** One control that belongs to the page as a whole, not to its content. */
  headerActions?: ReactNode
  /** A status chip that leads the cluster, left of search — the account's trial, say. */
  headerLeading?: ReactNode
  children: ReactNode
}

/**
 * The sidebar's surface, as the reference shell writes it.
 *
 * Rows sit at stock density with their label at 75% until hovered; the active
 * row is a plain background-coloured pill with a hairline border, no accent
 * colour. Written as data-slot selectors because they reach inside the Sidebar
 * primitive's own markup, which is vendored and must not be forked to restyle.
 */
const SHELL_CLASSES = cn(
  '[--sidebar-border:transparent] h-dvh',
  '**:data-[slot=sidebar-menu-button]:text-foreground/75 **:data-[slot=sidebar-menu-button]:hover:text-foreground',
  '**:data-[slot=sidebar-menu-sub-button]:text-foreground/75 **:data-[slot=sidebar-menu-sub-button]:hover:text-foreground',
  '[&_[data-slot=sidebar-menu-button]>svg]:opacity-60 [&_[data-slot=sidebar-menu-button]:hover>svg]:opacity-100',
  '[&_[data-slot=sidebar-menu-button][data-active]]:bg-background! [&_[data-slot=sidebar-menu-button][data-active]]:text-foreground! [&_[data-slot=sidebar-menu-button][data-active]]:font-normal',
  '[&_[data-slot=sidebar-menu-button][data-active]]:shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(0,0,0,0.04)] [&_[data-slot=sidebar-menu-button][data-active]>svg]:opacity-100',
  '[&_[data-slot=sidebar-menu-sub-button][data-active]]:bg-background! [&_[data-slot=sidebar-menu-sub-button][data-active]]:text-foreground!',
  '[&_[data-slot=sidebar-menu-sub-button][data-active]]:shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(0,0,0,0.04)]',
)

export function AppShell({
  navGroups,
  activeItemId,
  onNavigate,
  user,
  onProfile,
  onSettings,
  onSignOut,
  productName = 'Flexprice',
  logo,
  search,
  pinned,
  breadcrumb,
  headerActions,
  headerLeading,
  children,
}: AppShellProps) {
  // The pinned nav group already takes the free space above itself; a second
  // `mt-auto` would split that space and leave a gap between the two.
  const hasPinnedGroup = navGroups.some((group) => group.pinned)
  return (
    <SidebarProvider className={SHELL_CLASSES}>
      {/*
        Collapsed, a tooltip is the only thing naming a row. ~300ms is the
        hover-intent delay: prompt enough that the rail never feels broken, long
        enough that sweeping the cursor down the column does not flash a tooltip
        on every icon it passes.
      */}
      <TooltipProvider delay={300}>
        <ThemeShortcut />
        <Sidebar collapsible="icon" variant="inset" aria-label="Main">
          <SidebarHeader className="px-3 pt-3">
            {/*
              The Flexprice mark, then the tenant this console is signed in to —
              its name from `/users/me`, falling back to the product name until
              that resolves. The name drops out in the icon rail.
            */}
            <div className="flex h-8 items-center gap-2">
              {logo ?? (
                <img
                  src={flexpriceIcon}
                  alt=""
                  aria-hidden
                  className="size-7 shrink-0 rounded-md"
                />
              )}
              <span className="truncate text-[15px] font-medium tracking-tight in-data-[state=collapsed]:hidden">
                {user.organization ?? productName}
              </span>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <ShellNav
              groups={navGroups}
              {...(activeItemId === undefined ? {} : { activeItemId })}
              onNavigate={onNavigate}
            />

            {pinned ? (
              <div
                className={cn(
                  'px-2 pt-2 pb-2 in-data-[state=collapsed]:hidden',
                  !hasPinnedGroup && 'mt-auto',
                )}
              >
                {pinned}
              </div>
            ) : null}
          </SidebarContent>

          <SidebarFooter>
            <ShellAccount
              user={user}
              {...(onProfile ? { onProfile } : {})}
              {...(onSettings ? { onSettings } : {})}
              {...(onSignOut ? { onSignOut } : {})}
            />
          </SidebarFooter>

          {/* Collapse handle: a short grip on the sidebar's edge. */}
          <SidebarRail className="after:bg-border hover:after:bg-foreground/30 after:inset-y-auto after:top-1/2 after:h-6 after:-translate-y-1/2 after:rounded-full" />
        </Sidebar>

        <SidebarInset className="border-border/80 ml-0! min-h-0 overflow-hidden border shadow-none!">
          <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b px-4 sm:px-10 2xl:px-14">
            {/* The trigger is the only thing that opens the sheet below `lg`,
              where the sidebar is a sheet rather than a push panel. */}
            <div className="flex min-w-0 items-center gap-1.5 text-sm">
              <SidebarTrigger className="-ml-2 lg:hidden" />
              {breadcrumb}
            </div>
            {/* `shrink-0` so the cluster is never squeezed off by a long
              breadcrumb; the crumbs truncate instead, keeping Create reachable
              at 390. */}
            <div className="flex shrink-0 items-center gap-1.5">
              {headerLeading}
              <ShellSearch {...(search ?? {})} />
              {headerActions}
            </div>
          </header>

          {/*
            A div, not a `main`: `SidebarInset` is already the `main` landmark,
            and a document may have one. Pages own their padding; a list page
            fills this region and scrolls its own grid.
          */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
        </SidebarInset>
      </TooltipProvider>
    </SidebarProvider>
  )
}
