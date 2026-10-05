import { type ReactNode } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@ui/components/primitives/tabs'
import { useIsMobile } from '@ui/hooks/use-mobile'
import { cn } from '@ui/lib/cn'
import { EmptyState } from '@ui/compositions/EmptyState'
import { Source, provenance } from '@ui/provenance'

/**
 * Settings, laid out as the ReUI `settings-7` block lays out its account
 * settings: a heading, a vertical rail of sections on the left, and the active
 * section's content in a column on the right.
 *
 * The block itself keeps hard-coded tabs and its own state, so it cannot take
 * Flexprice's sections; this composition reproduces its layout over the same
 * `Tabs` primitive and leaves `components/blocks/settings-7` untouched. Its
 * cards and rows (`settingsSurface`) are what the panels are drawn with.
 *
 * A section with more than one tab shows those as a second, quieter row above
 * the content. Presentation only and fully controlled: the page owns
 * `sectionId`/`tabId` (both URL-backed). Choosing a section reports
 * `onSectionChange` only; the page decides which tab that section opens on.
 */
export const SettingsShellProvenance = provenance({
  source: Source.COMPOSITION,
  composes: ['ui/tabs'],
  note: "Layout of the settings-7 block (heading, vertical section rail, content column) over the Tabs primitive; pill tabs for a section's own tabs.",
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

  const isMobile = useIsMobile()

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
          <Tabs
            value={section?.id ?? ''}
            onValueChange={(next) => onSectionChange(String(next))}
            orientation={isMobile ? 'horizontal' : 'vertical'}
            className={cn('min-w-0', isMobile ? 'w-full' : 'w-44 shrink-0')}
          >
            <div className={cn(isMobile && '-mx-1 overflow-x-auto px-1 pb-1')}>
              <TabsList
                aria-label="Settings"
                className={cn(
                  'h-auto items-stretch gap-1 bg-transparent p-0',
                  isMobile ? 'w-max min-w-max justify-start' : 'w-full flex-col',
                )}
              >
                {sections.map((entry) => (
                  <TabsTrigger
                    key={entry.id}
                    value={entry.id}
                    className={cn(
                      'w-full justify-start gap-3 px-3 py-1.5 shadow-none',
                      entry.id === section?.id ? 'bg-muted!' : 'bg-transparent',
                    )}
                  >
                    {entry.icon}
                    <span className="truncate">{entry.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </Tabs>

          <div className="flex min-w-0 flex-1 flex-col gap-5">
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
