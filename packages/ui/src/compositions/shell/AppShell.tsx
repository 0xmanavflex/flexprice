import { type CSSProperties, type ReactNode } from 'react'
import { TooltipProvider } from '@ui/primitives/tooltip'
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
import { ShellAccount } from './ShellAccount'
import { ShellNav } from './ShellNav'
import { ShellNotifications } from './ShellNotifications'
import { ShellRailHandle } from './ShellRailHandle'
import { ShellSearch } from './ShellSearch'
import { ThemeToggle } from './ThemeToggle'
import type { ShellEnvironment, ShellNavGroup, ShellNotification, ShellUser } from './types'

/**
 * The application shell: `@reui/app-shell-3`'s layout, ReUI's Flux template's
 * surface treatment.
 *
 * One inset sidebar that collapses to icons, with nested navigation, search and
 * notifications *inside* the sidebar, a pinned slot above the footer, and the
 * account menu at the bottom. The header carries the breadcrumb and whatever
 * one control belongs to the whole page rather than to its content.
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
  composes: [
    '@reui/app-shell-3',
    'ui/sidebar',
    'ui/breadcrumb',
    'ui/dropdown-menu',
    '@reui/badge',
  ],
  note: "app-shell-3's layout with the Flux template's surface treatment, and our controlled contract.",
})

export interface AppShellProps {
  navGroups: ShellNavGroup[]
  activeItemId?: string
  onNavigate: (itemId: string) => void

  environment: ShellEnvironment
  environments: ShellEnvironment[]
  onEnvironmentChange: (environmentId: string) => void
  /** Absent means creating one is not offered — better than a dead menu item. */
  onCreateEnvironment?: () => void
  onManageEnvironments?: () => void

  user: ShellUser
  onProfile?: () => void
  onSettings?: () => void
  onSignOut?: () => void

  productName?: string
  logo?: ReactNode
  onSearch?: (term: string) => void

  notifications?: ShellNotification[]
  notificationsLoading?: boolean
  notificationsError?: { message: string } | null
  onMarkNotificationsRead?: () => void
  onOpenNotification?: (id: string) => void

  /** Pinned above the footer — an allowance, a usage meter, an alert count. */
  pinned?: ReactNode
  breadcrumb?: ReactNode
  /** One control that belongs to the page as a whole, not to its content. */
  headerActions?: ReactNode
  children: ReactNode
}

/**
 * The sidebar's surface, taken from ReUI's Flux template as written.
 *
 * Two ideas carry it. Every row owns a *transparent* border at rest, so hover
 * and selection can add a visible one without the row changing size — the
 * usual cause of a list that twitches under the cursor. And the selected row
 * is a tinted, bordered surface rather than a raised white card: on a sidebar
 * that is itself tinted, the card floats; the tint belongs.
 *
 * Icons sit at 60% until hovered and take the primary colour when active, so
 * the eye finds the current row before it reads a word. Labels sit slightly
 * under full strength for the same reason — the active one is the only one at
 * full contrast.
 *
 * The geometry is Flux's too: h-9 rows, `rounded-xl`, horizontal padding, and
 * a gap small enough that a group reads as one object rather than a stack of
 * chips.
 *
 * Written as data-slot selectors because they reach inside the Sidebar
 * primitive's own markup, which is vendored and must not be forked to restyle.
 */
const FLUX = [
  '[--sidebar-border:transparent]',

  // A border always present, only sometimes visible — so nothing resizes.
  '[&_[data-sidebar=menu-button]]:border!',
  '[&_[data-sidebar=menu-button]]:border-transparent!',
  '[&_[data-sidebar=menu-button]:hover]:border-border/60!',
  '[&_[data-sidebar=menu-button]:hover]:bg-sidebar-accent/80!',
  '[&_[data-sidebar=menu-button]:hover]:text-foreground!',
  '[&_[data-sidebar=menu-button][data-active]]:border-border/60!',
  '[&_[data-sidebar=menu-button][data-active]]:bg-sidebar-accent!',
  '[&_[data-sidebar=menu-button][data-active]]:hover:bg-sidebar-accent!',
  '[&_[data-sidebar=menu-button][data-active]]:text-foreground',
  '[&_[data-sidebar=menu-button][data-active]>svg]:text-primary',
  '[&_[data-sidebar=menu-button][data-active]>svg]:opacity-100',
  '**:data-[sidebar=menu-button]:text-accent-foreground/80',
  '**:data-[sidebar=menu-button]:hover:text-foreground',
  '[&_[data-sidebar=menu-button]:hover>svg]:opacity-100',
  '[&_[data-sidebar=menu-button]>svg]:opacity-60',

  // Rows: h-9, rounded-xl, px-3 — against the primitive's h-8/rounded-md/p-2.
  '**:data-[slot=sidebar-menu-button]:h-9',
  '**:data-[slot=sidebar-menu-button]:rounded-xl',
  '**:data-[slot=sidebar-menu-button]:px-3',
  '[&_[data-collapsible=icon]_[data-slot=sidebar-menu-button]]:px-0!',
  '[&_[data-collapsible=icon]_[data-slot=sidebar-menu-button]]:justify-center',
  /*
   * In the rail, the label is hidden rather than merely clipped. The primitive
   * truncates it, but a truncated span still claims the width left over beside
   * the icon in a 32px row — which showed up as the first letter of every
   * destination bleeding out past the rail, once, next to its own icon.
   */
  '[&_[data-collapsible=icon]_[data-slot=sidebar-menu-button]>span]:hidden',
  /*
   * In the rail a row is a circle, not a rounded square. At 32px the two are
   * nearly the same shape, and Flux takes the circle — which is what makes the
   * active icon read as a chip on a column of bare glyphs rather than as a
   * slightly darker patch.
   */
  '[&_[data-collapsible=icon]_[data-slot=sidebar-menu-button]]:rounded-full!',

  // Nearly touching, so a group reads as one object rather than a list of chips.
  '**:data-[slot=sidebar-menu]:gap-0.25',

  // Headings recede; they are labels, not destinations.
  '**:data-[slot=sidebar-group-label]:rounded-xl',
  '**:data-[slot=sidebar-group-label]:px-3',
  '**:data-[slot=sidebar-group-label]:text-sidebar-foreground/70',
].join(' ')

export function AppShell({
  navGroups,
  activeItemId,
  onNavigate,
  environment,
  environments,
  onEnvironmentChange,
  onCreateEnvironment,
  onManageEnvironments,
  user,
  onProfile,
  onSettings,
  onSignOut,
  productName = 'Flexprice',
  logo,
  onSearch,
  notifications = [],
  notificationsLoading = false,
  notificationsError = null,
  onMarkNotificationsRead,
  onOpenNotification,
  pinned,
  breadcrumb,
  headerActions,
  children,
}: AppShellProps) {
  return (
    <SidebarProvider
      className={cn('bg-sidebar h-screen', FLUX)}
      /*
       * Width only. The sidebar's colours live in `styles.css` under `:root`
       * and `.dark` — set here, they were a fixed light grey that survived the
       * theme switch, so dark mode rendered light text on a light sidebar.
       */
      style={{ '--sidebar-width': '260px' } as CSSProperties}
    >
      {/*
        Collapsed, a tooltip is the only thing naming a row — so it cannot wait
        600ms, which is Base UI's default when no provider sets one. Without
        this the icon rail feels broken before it feels slow.
      */}

      <TooltipProvider delay={0}>
      <ShellRailHandle />
      <Sidebar collapsible="icon" variant="inset" aria-label="Main">
        <SidebarHeader className="gap-2">
          <div className="flex items-center justify-between gap-2 in-data-[state=collapsed]:flex-col in-data-[state=collapsed]:items-start">
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

            {/*
              Only the bell. There was a collapse trigger beside it, which the
              edge handle now replaces — and two controls that do the same
              thing, one of them permanently in the corner of the rail, is one
              too many for a 48px column.
            */}
            <div className="flex items-center gap-0.5 in-data-[state=collapsed]:flex-col">
              <ShellNotifications
                notifications={notifications}
                isLoading={notificationsLoading}
                error={notificationsError}
                {...(onMarkNotificationsRead ? { onMarkAllRead: onMarkNotificationsRead } : {})}
                {...(onOpenNotification ? { onOpenNotification } : {})}
              />
              <ThemeToggle />
            </div>
          </div>

          {/*
            The environment switcher sits at the top, not in the footer where
            the block puts its workspace picker. It is the most consequential
            control in the product — editing a live plan is not the same act as
            editing a sandbox one — and burying it would contradict that.
          */}
          <div className="-mx-1 in-data-[state=collapsed]:mx-0">
            <EnvironmentSwitcher
              current={environment}
              environments={environments}
              onChange={onEnvironmentChange}
              {...(onCreateEnvironment ? { onCreate: onCreateEnvironment } : {})}
              {...(onManageEnvironments ? { onManage: onManageEnvironments } : {})}
            />
          </div>
        </SidebarHeader>

        <SidebarContent>
          <div className="py-2">
            <ShellSearch {...(onSearch ? { onSearch } : {})} />
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
          <ShellAccount
            user={user}
            {...(onProfile ? { onProfile } : {})}
            {...(onSettings ? { onSettings } : {})}
            {...(onSignOut ? { onSignOut } : {})}
          />
        </SidebarFooter>
      </Sidebar>

      {/*
        The content plane is lifted off the sidebar: a border, a rounded
        corner, and one soft shadow all the way around. Subtle on purpose —
        the panel should read as sitting slightly in front of the sidebar, not
        as a card thrown onto it.
      */}
      <SidebarInset className="ml-0! flex min-h-0 flex-col overflow-hidden border shadow-[0_0_18px_-6px_rgba(0,0,0,0.12)]! md:peer-data-[variant=inset]:rounded-2xl">
        {/* A rule under the header, so the breadcrumb is not floating over
            whatever the page happens to start with. */}
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          {/* The edge handle is desktop-only — on mobile the sidebar is a
              sheet, and this is the only thing that opens it. */}
          <SidebarTrigger className="-ml-1 md:hidden" />
          {breadcrumb}
          {headerActions ? <div className="ml-auto flex items-center gap-2">{headerActions}</div> : null}
        </header>

        {/*
          A div, not a `main`. `SidebarInset` is already the `main` landmark —
          nesting another inside it produces two, and a document may have one.

          `overflow-hidden`, not `auto`: a list page fills this region and scrolls
          its own grid, so the pagination footer stays pinned to the bottom and
          fit-to-window has a bounded height to measure. Pages that read top to
          bottom (forms) own their scroll with `h-full overflow-y-auto`.
        */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </SidebarInset>
      </TooltipProvider>
    </SidebarProvider>
  )
}
