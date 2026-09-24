import { type CSSProperties, type ReactNode } from 'react'
import { SidebarProvider } from '@ui/primitives/sidebar'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { EnvironmentSwitcher } from './EnvironmentSwitcher'
import { ShellNav } from './ShellNav'
import { ShellRail } from './ShellRail'
import { ShellSearch } from './ShellSearch'
import type { ShellEnvironment, ShellNavGroup, ShellSection, ShellUser } from './types'

/**
 * The application shell, adapted from `@reui/app-shell-16`.
 *
 * Adapted, not merely built on its primitives: the dark rounded rail, the
 * `bg-muted` navigation panel with its raised active item, and the search that
 * collapses into a dialog below `lg` are the block's design. An earlier version
 * composed the same primitives from scratch and produced something much flatter
 * — the block is the baseline, and its treatment is most of what makes it one.
 *
 * What is ours is the contract. It is entirely controlled and entirely
 * presentational: no route state, no navigation, and it cannot import the query
 * layer. That is what lets every arrangement be a story — an empty catalogue, a
 * production environment, a section with no children.
 *
 * Two levels because Flexprice has six sections averaging three children each.
 * A single flat sidebar would be twenty-plus items with no grouping, and a
 * top-nav-only shell has nowhere to put the children at all.
 */
export const AppShellProvenance = provenance({
  source: 'composition',
  composes: ['@reui/app-shell-16', 'ui/sidebar', 'ui/button', 'ui/dialog', '@reui/badge'],
  note: 'Adapted from app-shell-16: its layout and treatment, our controlled contract.',
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
  logo?: ReactNode
  onSearch?: (term: string) => void
  breadcrumb?: ReactNode
  accountMenu?: ReactNode
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
  logo,
  onSearch,
  breadcrumb,
  accountMenu,
  children,
}: AppShellProps) {
  const activeSection = sections.find((section) => section.id === activeSectionId)
  const hasNav = navGroups.some((group) => group.items.length > 0)
  const isProduction = environment.kind === 'production'

  return (
    <SidebarProvider
      className="bg-muted dark:bg-background h-screen [--header-height:56px]"
      style={{ '--sidebar-width': '56px' } as CSSProperties}
    >
      {/*
        A marker across the whole shell, not only on the switcher — visible
        wherever the eye is, so someone deep in a form can still tell they are
        editing live data.
      */}
      {isProduction ? (
        <div aria-hidden className="bg-destructive fixed inset-x-0 top-0 z-50 h-1" />
      ) : null}

      <ShellRail
        sections={sections}
        activeSectionId={activeSectionId}
        onSectionChange={onSectionChange}
        user={user}
        {...(logo ? { logo } : {})}
      />

      {hasNav ? (
        <ShellNav
          title={activeSection?.label ?? ''}
          groups={navGroups}
          {...(activeItemId === undefined ? {} : { activeItemId })}
          onNavigate={onNavigate}
        />
      ) : null}

      {/*
        The content sits on its own rounded surface, the block's inset
        treatment — which is what separates it from the rail and panel rather
        than a border doing the work.
      */}
      <div className={cn('flex min-w-0 flex-1 flex-col p-2.5', isProduction && 'pt-3.5')}>
        <div className="bg-background flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border shadow-xs">
          <header className="flex h-(--header-height) shrink-0 items-center gap-3 border-b px-4">
            <EnvironmentSwitcher
              current={environment}
              environments={environments}
              onChange={onEnvironmentChange}
            />

            {breadcrumb ? (
              <div className="min-w-0 flex-1">{breadcrumb}</div>
            ) : (
              <div className="flex-1" />
            )}

            <ShellSearch {...(onSearch ? { onSearch } : {})} />

            {accountMenu ?? (
              <span className="text-muted-foreground hidden text-sm sm:inline" title={user.email}>
                {user.name}
              </span>
            )}
          </header>

          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  )
}
