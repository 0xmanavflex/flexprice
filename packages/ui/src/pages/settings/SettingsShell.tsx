import { type ReactNode } from 'react'
import { ChevronRightIcon } from 'lucide-react'
import { EmptyState } from '@ui/compositions/EmptyState'
import { cn } from '@ui/lib/cn'
import { Source, provenance } from '@ui/provenance'

/**
 * Settings: one vertical, nested navigation beside the content.
 *
 * Sections are the top level; the active section opens to show its tabs beneath
 * it. There is no horizontal strip — every destination lives in the one rail,
 * so where you are and what else is nearby read from a single place.
 *
 * Presentation only and fully controlled: the page owns `sectionId`/`tabId`
 * (both URL-backed). Choosing a section reports `onSectionChange` only; the
 * page decides which tab that section opens on.
 */
export const SettingsShellProvenance = provenance({
  source: Source.COMPOSITION,
  composes: ['@reui/settings-7'],
  note: "settings-7's vertical section rail, nested: the active section expands its tabs in place. The horizontal tab strip is gone.",
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

const FOCUS_RING = 'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none'

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
    <div className="flex w-full min-w-0 flex-col gap-6 lg:flex-row lg:gap-8">
      <nav aria-label="Settings" className="w-full shrink-0 lg:w-56">
        <ul className="flex flex-col gap-0.5">
          {sections.map((entry) => {
            const isOpen = entry.id === section?.id
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => onSectionChange(entry.id)}
                  className={cn(
                    'flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm transition-colors',
                    FOCUS_RING,
                    isOpen
                      ? 'text-foreground font-medium'
                      : 'text-foreground/70 hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  {entry.icon}
                  <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                  <ChevronRightIcon
                    aria-hidden
                    className={cn(
                      'size-3.5 shrink-0 opacity-50 transition-transform',
                      isOpen && 'rotate-90',
                    )}
                  />
                </button>

                {isOpen && entry.tabs.length > 0 ? (
                  <ul className="border-border/60 mt-0.5 mb-1 ml-5 flex flex-col gap-0.5 border-l pl-2">
                    {entry.tabs.map((tab) => {
                      const isActive = tab.id === tabId
                      return (
                        <li key={tab.id}>
                          <button
                            type="button"
                            aria-current={isActive ? 'page' : undefined}
                            onClick={() => onTabChange(tab.id)}
                            className={cn(
                              'flex h-8 w-full items-center rounded-lg px-3 text-left text-sm transition-colors',
                              FOCUS_RING,
                              isActive
                                ? 'bg-muted text-foreground font-medium'
                                : 'text-foreground/70 hover:bg-muted/60 hover:text-foreground',
                            )}
                          >
                            <span className="truncate whitespace-nowrap">{tab.label}</span>
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

      <div className="min-w-0 flex-1">
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
