import type { ReactNode } from 'react'
import {
  BarChart3Icon,
  HouseIcon,
  PackageIcon,
  ReceiptIcon,
  SettingsIcon,
  UsersIcon,
} from 'lucide-react'
import { AppShell, type ShellEnvironment, type ShellSection } from '@fp/ui/compositions'
import {
  SECTION_IDS,
  SECTION_LABEL,
  SECTION_NAV,
  type SectionId,
  navEntryForPath,
  sectionForPath,
  toNavGroups,
} from './navigation'

const ICONS: Record<SectionId, ReactNode> = {
  home: <HouseIcon className="size-5" />,
  customers: <UsersIcon className="size-5" />,
  billing: <ReceiptIcon className="size-5" />,
  catalog: <PackageIcon className="size-5" />,
  usage: <BarChart3Icon className="size-5" />,
  settings: <SettingsIcon className="size-5" />,
}

const SECTIONS: ShellSection[] = SECTION_IDS.map((id) => ({
  id,
  label: SECTION_LABEL[id],
  icon: ICONS[id],
}))

export interface ConsoleShellProps {
  pathname: string
  onNavigate: (path: string) => void
  environment: ShellEnvironment
  environments: ShellEnvironment[]
  onEnvironmentChange: (id: string) => void
  user: { name: string; email: string }
  counts?: Partial<Record<string, number>>
  children: ReactNode
}

/**
 * The shell, bound to routes.
 *
 * All the routing knowledge lives here rather than in `@fp/ui`: the shell is
 * given a section and a list, and reports which one was clicked. This is what
 * lets the shell be a story with no router mounted.
 *
 * A section with no children navigates to its first entry, or nowhere if it has
 * none — clicking "Home" on the rail should go Home, not select an empty panel.
 */
export function ConsoleShell({
  pathname,
  onNavigate,
  environment,
  environments,
  onEnvironmentChange,
  user,
  counts,
  children,
}: ConsoleShellProps) {
  const section = sectionForPath(pathname)
  const activeItemId = navEntryForPath(pathname)

  return (
    <AppShell
      sections={SECTIONS}
      activeSectionId={section}
      onSectionChange={(next) => {
        const first = SECTION_NAV[next as SectionId][0]
        if (first) onNavigate(first.path)
      }}
      navGroups={toNavGroups(section, counts)}
      {...(activeItemId === undefined ? {} : { activeItemId })}
      onNavigate={(itemId) => {
        const entry = SECTION_NAV[section].find((candidate) => candidate.id === itemId)
        if (entry) onNavigate(entry.path)
      }}
      environment={environment}
      environments={environments}
      onEnvironmentChange={onEnvironmentChange}
      user={user}
    >
      {children}
    </AppShell>
  )
}
