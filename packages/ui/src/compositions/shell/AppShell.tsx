import { type CSSProperties, type ReactNode } from 'react'
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
import { ShellSearch } from './ShellSearch'
import type { ShellEnvironment, ShellNavGroup, ShellNotification, ShellUser } from './types'

/**
 * The application shell, adapted from `@reui/app-shell-3`.
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
 * The block's selection and icon treatment, lifted as written.
 *
 * Expressed as data-slot selectors because they reach inside the Sidebar
 * primitive's own markup — which is vendored, and which we must not fork to
 * restyle. The icon rules are half of why the block reads as layered: idle
 * icons sit at 60% and the active one takes the primary colour, so the eye
 * finds the current row before it reads a word.
 */
const SELECTION = [
  '[--sidebar-border:transparent]',

  '[&_[data-slot=sidebar-menu-button][data-active]]:border-border/60!',
  '[&_[data-slot=sidebar-menu-button][data-active]]:border',
  '[&_[data-slot=sidebar-menu-button][data-active]]:shadow-xs!',
  '[&_[data-slot=sidebar-menu-button][data-active]]:shadow-black/5!',
  '[&_[data-slot=sidebar-menu-button][data-active]]:bg-background!',
  '[&_[data-slot=sidebar-menu-button][data-active]]:hover:bg-background!',
  '**:data-[slot=sidebar-menu-button]:hover:bg-transparent!',
  '[&_[data-slot=sidebar-menu-button][data-active]]:text-foreground',
  '[&_[data-slot=sidebar-menu-button][data-active]>svg]:text-primary',
  '[&_[data-slot=sidebar-menu-button][data-active]>svg]:opacity-100',
  '**:data-[slot=sidebar-menu-button]:text-accent-foreground/80',
  '**:data-[slot=sidebar-menu-button]:hover:text-foreground',
  '[&_[data-collapsible=icon]_[data-slot=sidebar-menu-button][data-active]>svg]:-ml-px',
  '[&_[data-slot=sidebar-menu-button]:hover>svg]:opacity-100',
  '[&_[data-slot=sidebar-menu-button]>svg]:opacity-60',

  '[&_[data-slot=sidebar-menu-sub-button][data-active]]:border-border/60!',
  '[&_[data-slot=sidebar-menu-sub-button][data-active]]:border',
  '[&_[data-slot=sidebar-menu-sub-button][data-active]]:shadow-xs!',
  '[&_[data-slot=sidebar-menu-sub-button][data-active]]:shadow-black/5!',
  '[&_[data-slot=sidebar-menu-sub-button][data-active]]:bg-background!',
  '[&_[data-slot=sidebar-menu-sub-button][data-active]]:hover:bg-background!',
  '**:data-[slot=sidebar-menu-sub-button]:hover:bg-transparent!',
  '[&_[data-slot=sidebar-menu-sub-button][data-active]]:text-foreground',
  '**:data-[slot=sidebar-menu-sub-button]:text-accent-foreground/80',
  '**:data-[slot=sidebar-menu-sub-button]:hover:text-foreground',
].join(' ')

export function AppShell({
  navGroups,
  activeItemId,
  onNavigate,
  environment,
  environments,
  onEnvironmentChange,
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

            <div className="flex items-center gap-0.5 in-data-[state=collapsed]:hidden">
              <ShellNotifications
                notifications={notifications}
                isLoading={notificationsLoading}
                error={notificationsError}
                {...(onMarkNotificationsRead ? { onMarkAllRead: onMarkNotificationsRead } : {})}
                {...(onOpenNotification ? { onOpenNotification } : {})}
              />
              <SidebarTrigger className="opacity-60 hover:opacity-100 [&_svg]:transition-transform [&_svg]:duration-200" />
            </div>
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

      <SidebarInset className="ml-0! flex min-h-0 flex-col overflow-hidden">
        <header
          className={cn(
            'flex h-12 shrink-0 items-center gap-2 px-4',
            isProduction && 'pt-1',
          )}
        >
          {/* The rail trigger is in the sidebar header; on mobile there is no
              sidebar to put it in, so the header carries one. */}
          <SidebarTrigger className="-ml-1 md:hidden" />
          {breadcrumb}
          {headerActions ? <div className="ml-auto flex items-center gap-2">{headerActions}</div> : null}
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
