import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@ui/lib/cn'
import { EmptyState } from '@ui/compositions/feedback/EmptyState'
import { DetailTabs } from '@ui/compositions/detail/DetailKit'
import { Source, provenance } from '@ui/provenance'

/**
 * Settings, laid out as the ReUI `settings-7` block lays out its account
 * settings: a flat vertical rail of sections on the left (a scrolling strip above the content on narrow screens), and the active
 * section's content in a column on the right. There is no visible page or
 * section title and no subtitle: each section opens straight onto its table
 * or form. The headings are still there, `sr-only`, so the page has an outline
 * for assistive tech; what a section is for is said by its empty state.
 *
 * The block itself keeps hard-coded tabs and its own state, so it cannot take
 * Flexprice's sections; this composition reproduces its layout and leaves `components/blocks/settings-7` untouched. Its
 * cards and rows (`settingsSurface`) are what the panels are drawn with.
 *
 * A section with more than one tab shows them as a line-tab strip above its
 * content; the rail itself never nests. Presentation only and fully controlled: the page owns
 * `sectionId`/`tabId` (both URL-backed). Choosing a section reports
 * `onSectionChange` only; the page decides which tab that section opens on.
 */
export const SettingsShellProvenance = provenance({
  source: Source.COMPOSITION,
  composes: ['compositions/DetailKit'],
  note: "Layout of the settings-7 block (heading, flat vertical section rail, content column); a section's own pages are a line-tab strip above its content.",
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
  /** Reachable and renderable, but not a row in the rail. */
  hidden?: boolean
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

  // Below `lg` the rail is a scrolling strip; keep the open section in view.
  const rail = useRef<HTMLElement>(null)
  useEffect(() => {
    rail.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView?.({ block: 'nearest', inline: 'center' })
  }, [section?.id])

  return (
    <div className="flex min-w-0 flex-1 items-start justify-center px-4 py-8 sm:px-6 md:px-10 md:pb-16">
      <div className="w-full max-w-6xl">
        <h1 className="sr-only">Settings</h1>

        <div className="flex w-full flex-col gap-4 lg:flex-row lg:gap-8">
          <nav
            ref={rail}
            aria-label="Settings"
            className="w-full min-w-0 overflow-x-auto lg:w-56 lg:shrink-0 lg:overflow-visible"
          >
            <ul className="flex gap-1 lg:flex-col">
              {sections
                .filter((entry) => !entry.hidden)
                .map((entry) => {
                  const active = entry.id === section?.id
                  return (
                    <li key={entry.id}>
                      <button
                        type="button"
                        aria-current={active ? 'page' : undefined}
                        onClick={() => onSectionChange(entry.id)}
                        className={cn(
                          'hover:bg-muted focus-visible:ring-ring/50 flex shrink-0 items-center gap-3 rounded-lg px-3 py-1.5 text-left text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-3 lg:w-full [&_svg]:size-4 [&_svg]:shrink-0',
                          active ? 'bg-muted' : 'text-muted-foreground',
                        )}
                      >
                        {entry.icon}
                        <span className="truncate">{entry.label}</span>
                      </button>
                    </li>
                  )
                })}
            </ul>
          </nav>

          <div className="flex min-w-0 flex-1 flex-col gap-5">
            {section ? <h2 className="sr-only">{section.label}</h2> : null}
            {tabs.length > 1 ? (
              <div className="min-w-0 overflow-x-auto">
                <DetailTabs
                  tabs={tabs.map((tab) => ({ value: tab.id, label: tab.label }))}
                  value={activeTab?.id ?? tabs[0]?.id ?? ''}
                  onValueChange={onTabChange}
                />
              </div>
            ) : null}
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
      scene="settings"
      size="inline"
      title={title}
      description={reason ?? 'It cannot be opened from here yet.'}
    />
  )
}
