import type { ReactNode } from 'react'
import {
  BarChart3Icon,
  CodeIcon,
  HouseIcon,
  PackageIcon,
  ReceiptIcon,
  SettingsIcon,
} from 'lucide-react'
import { useNavCounts } from '@fp/query'
import { AppShell, type ShellEnvironment } from '@fp/ui/compositions'
import {
  GROUP_COUNTS,
  groupForNavId,
  navEntryForPath,
  pathForNavId,
  toNavGroups,
} from './navigation'

const ICONS: Record<string, ReactNode> = {
  home: <HouseIcon className="size-4" />,
  catalog: <PackageIcon className="size-4" />,
  billing: <ReceiptIcon className="size-4" />,
  revenue: <BarChart3Icon className="size-4" />,
  developers: <CodeIcon className="size-4" />,
  settings: <SettingsIcon className="size-4" />,
}

export interface ConsoleShellProps {
  pathname: string
  onNavigate: (path: string) => void
  environment: ShellEnvironment
  environments: ShellEnvironment[]
  onEnvironmentChange: (id: string) => void
  user: { name: string; email: string }
  children: ReactNode
}

/**
 * The shell, bound to routes.
 *
 * All routing knowledge lives here rather than in `@fp/ui`: the shell is given
 * a tree and an active id, and reports which one was clicked. That is what lets
 * the shell be a story with no router mounted.
 *
 * Clicking a parent navigates to its first child. A group heading that does
 * nothing when clicked is a dead control, and the child is what the person
 * wanted anyway.
 */
export function ConsoleShell({
  pathname,
  onNavigate,
  environment,
  environments,
  onEnvironmentChange,
  user,
  children,
}: ConsoleShellProps) {
  const activeItemId = navEntryForPath(pathname)
  const openGroup = groupForNavId(activeItemId)
  const counts = useNavCounts(openGroup ? (GROUP_COUNTS[openGroup] ?? []) : [])

  return (
    <AppShell
      navGroups={toNavGroups(ICONS, counts)}
      {...(activeItemId === undefined ? {} : { activeItemId })}
      onNavigate={(id) => {
        const path = pathForNavId(id)
        if (path) {
          onNavigate(path)
          return
        }
        // A parent: go to its first child rather than doing nothing.
        const group = toNavGroups()[0]?.items.find((item) => item.id === id)
        const first = group?.items?.[0]
        const childPath = first ? pathForNavId(first.id) : undefined
        if (childPath) onNavigate(childPath)
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
