import { type ReactNode } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@ui/components/primitives/tabs'
import { EmptyState } from '@ui/compositions/EmptyState'
import { Source, provenance } from '@ui/provenance'

/**
 * Settings: a line-tab strip over a `max-w-4xl` column of panels, as the
 * reference settings page has it.
 *
 * Sections are the strip; a section with more than one tab shows those beneath
 * it as a second, quieter row. The content below is whatever the page renders
 * — Frame-style panels, stacked with `gap-4`.
 *
 * Presentation only and fully controlled: the page owns `sectionId`/`tabId`
 * (both URL-backed). Choosing a section reports `onSectionChange` only; the
 * page decides which tab that section opens on.
 */
export const SettingsShellProvenance = provenance({
  source: Source.COMPOSITION,
  composes: ['ui/tabs'],
  note: "Line tabs for sections (the reference settings header), pill tabs for a section's own tabs, then a max-w-4xl panel column.",
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
  /** Kept for callers that pass one; the reference's section tabs are text only. */
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
    <div className="flex min-w-0 flex-1 flex-col gap-5 px-10 pt-8 pb-16 2xl:px-14">
      <Tabs value={section?.id ?? ''} onValueChange={(next) => onSectionChange(String(next))}>
        <TabsList
          variant="line"
          aria-label="Settings"
          className="w-full justify-start gap-6 overflow-x-auto border-b"
        >
          {sections.map((entry) => (
            <TabsTrigger key={entry.id} value={entry.id} className="flex-none px-0 pb-2.5">
              {entry.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {tabs.length > 1 ? (
        <Tabs value={activeTab?.id ?? ''} onValueChange={(next) => onTabChange(String(next))}>
          <TabsList
            aria-label={`${section?.label ?? 'Settings'} tabs`}
            className="max-w-full overflow-x-auto"
          >
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}

      <div className="grid max-w-4xl min-w-0 gap-4">
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
