import { type ReactNode } from 'react'
import { cn } from '@ui/lib/cn'
import { EmptyState } from '@ui/compositions/EmptyState'
import { Source, provenance } from '@ui/provenance'

/**
 * Settings, laid out as the ReUI `settings-7` block lays out its account
 * settings: a heading, a vertical rail of sections on the left, and the active
 * section's content in a column on the right.
 *
 * The block itself keeps hard-coded tabs and its own state, so it cannot take
 * Flexprice's sections; this composition reproduces its layout and leaves `components/blocks/settings-7` untouched. Its
 * cards and rows (`settingsSurface`) are what the panels are drawn with.
 *
 * A section with more than one tab expands in the rail to list those tabs
 * beneath it; there is no second nav above the content. Presentation only and fully controlled: the page owns
 * `sectionId`/`tabId` (both URL-backed). Choosing a section reports
 * `onSectionChange` only; the page decides which tab that section opens on.
 */
export const SettingsShellProvenance = provenance({
  source: Source.COMPOSITION,
  composes: [],
  note: "Layout of the settings-7 block (heading, vertical section rail, content column); the active section's own pages nest under it in the rail.",
})

export interface SettingsTab {
  id: string
  label: string
  /** Render an unavailable state instead of content. */
  unavailable?: boolean
  /**
   * Why it is unavailable, in the caller's own words. A caller that does not
   * know the reason gets a sentence that claims nothing.
   */
  unavailableReason?: string
}

export interface SettingsSection {
  id: string
  label: string
  /** Shown beside the label in the section rail. */
  icon?: ReactNode
  tabs: SettingsTab[]
}

export interface SettingsShellProps {
  sections: SettingsSection[]
  sectionId: string
  tabId: string
  onSectionChange: (sectionId: string) => void
  onTabChange: (tabId: string) => void
  /** The active tab's content, chosen by the caller. */
  children: ReactNode
}

export function SettingsShell({
  sections,
  sectionId,
  tabId,
  onSectionChange,
  onTabChange,
  children,
}: SettingsShellProps) {
  const section = sections.find((candidate) => candidate.id === sectionId) ?? sections[0]
  const tabs = section?.tabs ?? []
  const activeTab = tabs.find((candidate) => candidate.id === tabId)

  // A section can be entirely unavailable and still has to be reachable.
  const sectionUnavailable = tabs.length > 0 && tabs.every((tab) => tab.unavailable)
  const tabUnavailable = activeTab?.unavailable ?? false

  return (
    <div className="flex min-w-0 flex-1 items-start justify-center px-4 py-8 sm:px-6 md:px-10 md:pb-16">
      <div className="w-full max-w-5xl space-y-8">
        <header className="px-1">
          <h1 className="text-xl font-medium tracking-tight">Settings</h1>
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
            Manage your organization, team, billing, developer tools, and preferences.
          </p>
        </header>

        <div className="flex w-full flex-col gap-4 lg:flex-row lg:gap-8">
          <nav aria-label="Settings" className="w-full min-w-0 lg:w-52 lg:shrink-0">
            <ul className="flex flex-col gap-1">
              {sections.map((entry) => {
                const active = entry.id === section?.id
                const nested = active && entry.tabs.length > 1
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      aria-current={active && !nested ? 'page' : undefined}
                      aria-expanded={entry.tabs.length > 1 ? active : undefined}
                      onClick={() => onSectionChange(entry.id)}
                      className={cn(
                        'hover:bg-muted focus-visible:ring-ring/50 flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-left text-sm font-medium outline-none focus-visible:ring-3 [&_svg]:size-4 [&_svg]:shrink-0',
                        active ? 'bg-muted' : 'text-muted-foreground',
                      )}
                    >
                      {entry.icon}
                      <span className="truncate">{entry.label}</span>
                    </button>
                    {nested ? (
                      <ul
                        aria-label={`${entry.label} pages`}
                        className="border-border mt-1 mb-1 ml-5 flex flex-col gap-0.5 border-l pl-2"
                      >
                        {entry.tabs.map((tab) => {
                          const current = tab.id === activeTab?.id
                          return (
                            <li key={tab.id}>
                              <button
                                type="button"
                                aria-current={current ? 'page' : undefined}
                                onClick={() => onTabChange(tab.id)}
                                className={cn(
                                  'hover:bg-muted focus-visible:ring-ring/50 w-full rounded-md px-3 py-1 text-left text-sm outline-none focus-visible:ring-3',
                                  current ? 'bg-muted font-medium' : 'text-muted-foreground',
                                )}
                              >
                                <span className="block truncate">{tab.label}</span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="flex min-w-0 flex-1 flex-col gap-5">
            <div className="grid min-w-0 gap-4">
              {sectionUnavailable || tabUnavailable ? (
                <Unavailable
                  title={
                    sectionUnavailable && section
                      ? `${section.label} is unavailable`
                      : `${activeTab?.label ?? 'This tab'} is unavailable`
                  }
                  {...(activeTab?.unavailableReason ? { reason: activeTab.unavailableReason } : {})}
                />
              ) : (
                children
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Says so, rather than showing an empty panel. */
function Unavailable({ title, reason }: { title: string; reason?: string }) {
  return (
    <EmptyState
      size="inline"
      title={title}
      description={reason ?? 'It cannot be opened from here yet.'}
    />
  )
}
