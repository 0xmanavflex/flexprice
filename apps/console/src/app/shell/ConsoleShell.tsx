import type { ReactNode } from 'react'
import {
  BarChart3Icon,
  BookOpenIcon,
  CreditCardIcon,
  FileTextIcon,
  LayersIcon,
  ReceiptIcon,
  RepeatIcon,
  UserPlusIcon,
  CodeXmlIcon,
  GalleryHorizontalEndIcon,
  HouseIcon,
  Layers2Icon,
  LandmarkIcon,
  PuzzleIcon,
  SettingsIcon,
} from 'lucide-react'
import { useNavCounts } from '@fp/query'
import {
  AppShell,
  ShellBreadcrumb,
  ShellCreateMenu,
  type ShellEnvironment,
  type ShellUser,
} from '@fp/ui/compositions'
import { CREATE_ACTIONS, pathForCreateAction } from './createActions'
import {
  breadcrumbForPath,
  GROUP_COUNTS,
  groupForNavId,
  NAV,
  navEntryForPath,
  pathForNavId,
  toNavGroups,
} from './navigation'

/**
 * Icons match the current dashboard's, deliberately.
 *
 * Someone who has used Flexprice for a year recognises Billing by its landmark
 * before they read the word. Changing the glyphs would spend that recognition
 * for nothing.
 */
const ICONS: Record<string, ReactNode> = {
  home: <HouseIcon className="size-4" />,
  catalog: <Layers2Icon className="size-4" />,
  billing: <LandmarkIcon className="size-4" />,
  revenue: <BarChart3Icon className="size-4" />,
  developers: <CodeXmlIcon className="size-4" />,
  integrations: <PuzzleIcon className="size-4" />,
  'pricing-widget': <GalleryHorizontalEndIcon className="size-4" />,
  settings: <SettingsIcon className="size-4" />,
  docs: <BookOpenIcon className="size-4" />,
}

/** Attached here for the same reason the nav icons are: this file owns the JSX. */
const CREATE_ICONS: Record<string, ReactNode> = {
  subscription: <RepeatIcon className="size-4" />,
  customer: <UserPlusIcon className="size-4" />,
  plan: <LayersIcon className="size-4" />,
  feature: <FileTextIcon className="size-4" />,
  invoice: <ReceiptIcon className="size-4" />,
  payment: <CreditCardIcon className="size-4" />,
}

export interface ConsoleShellProps {
  pathname: string
  onNavigate: (path: string) => void
  environment: ShellEnvironment
  environments: ShellEnvironment[]
  onEnvironmentChange: (id: string) => void
  user: ShellUser
  onSignOut?: () => void
  /** One control belonging to the page as a whole, rendered in the header. */
  headerActions?: ReactNode
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
  onSignOut,
  headerActions,
  children,
}: ConsoleShellProps) {
  const activeItemId = navEntryForPath(pathname)
  const openGroup = groupForNavId(activeItemId)
  const counts = useNavCounts(openGroup ? (GROUP_COUNTS[openGroup] ?? []) : [])

  const goTo = (id: string) => {
    const path = pathForNavId(id)
    if (path) {
      onNavigate(path)
      return
    }
    // A parent: go to its first child rather than doing nothing.
    const firstChild = NAV.find((entry) => entry.id === id)?.children?.[0]
    const childPath = firstChild ? pathForNavId(firstChild.id) : undefined
    if (childPath) onNavigate(childPath)
  }

  return (
    <AppShell
      navGroups={toNavGroups(ICONS, counts)}
      {...(activeItemId === undefined ? {} : { activeItemId })}
      onNavigate={goTo}
      environment={environment}
      environments={environments}
      onEnvironmentChange={onEnvironmentChange}
      user={user}
      onSettings={() => goTo('settings')}
      {...(onSignOut ? { onSignOut } : {})}
      breadcrumb={<ShellBreadcrumb trail={breadcrumbForPath(pathname)} />}
      /*
       * Create sits in the header rather than on each page, because the things
       * people start cold — a subscription, a customer — do not live on the
       * screen they happen to be looking at.
       */
      headerActions={
        <>
          {headerActions}
          <ShellCreateMenu
            actions={CREATE_ACTIONS.map((action) => ({
              ...action,
              ...(CREATE_ICONS[action.id] ? { icon: CREATE_ICONS[action.id] } : {}),
            }))}
            onCreate={(id) => {
              const path = pathForCreateAction(id)
              if (path) onNavigate(path)
            }}
          />
        </>
      }
      /*
       * Notifications are declared empty rather than omitted: the bell is part
       * of the shell from the start, and an empty list is the honest state
       * until `POST /events/search` is wired to it. It is not loading, and it
       * has not failed — there is nothing yet.
       */
      notifications={[]}
    >
      {children}
    </AppShell>
  )
}
