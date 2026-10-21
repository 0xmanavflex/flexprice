import { useMemo, useState, type ReactNode } from 'react'
import {
  BarChart3Icon,
  BookOpenIcon,
  CreditCardIcon,
  ReceiptIcon,
  RepeatIcon,
  UserPlusIcon,
  CodeXmlIcon,
  GalleryHorizontalEndIcon,
  LinkIcon as IntegrationsIcon,
  HouseIcon,
  Layers2Icon,
  LandmarkIcon,
  UsersIcon,
  FileSignatureIcon,
  HandCoinsIcon,
  SettingsIcon,
} from '@fp/ui/icons'
import {
  AppShell,
  EnvironmentSwitcher,
  ShellBreadcrumb,
  ShellCreateMenu,
  ShellDetailTrailProvider,
  type ShellCrumb,
  type ShellDetailCrumb,
  type ShellEnvironment,
  type ShellSearchItem,
  type ShellUser,
} from '@fp/ui/compositions'
import { EnvironmentFormPage } from '@/pages/environments/EnvironmentFormPage'
import { EnvironmentRenameFormPage } from '@/pages/environments/EnvironmentRenameFormPage'
import { CREATE_ACTIONS, pathForCreateAction } from './createActions'
import { useMockAccounts } from '@/app/selfBilling/mockAccounts'
import { SUPPORT_CHAT_ACTION_ID, searchableDestinations, useGlobalSearch } from './useGlobalSearch'
import { openSupportChat } from '@/app/supportChat/SupportChat'
import {
  breadcrumbForPath,
  FOOTER_NAV,
  hrefForNavId,
  labelForNavId,
  NAV,
  navEntryForPath,
  parentForNavId,
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
  customers: <UsersIcon className="size-4" />,
  subscriptions: <FileSignatureIcon className="size-4" />,
  collections: <HandCoinsIcon className="size-4" />,
  catalog: <Layers2Icon className="size-4" />,
  billing: <LandmarkIcon className="size-4" />,
  revenue: <BarChart3Icon className="size-4" />,
  developers: <CodeXmlIcon className="size-4" />,
  integrations: <IntegrationsIcon className="size-4" />,
  'pricing-widget': <GalleryHorizontalEndIcon className="size-4" />,
  docs: <BookOpenIcon className="size-4" />,
}

/** Attached here for the same reason the nav icons are: this file owns the JSX. */
const CREATE_ICONS: Record<string, ReactNode> = {
  subscription: <RepeatIcon className="size-4" />,
  customer: <UserPlusIcon className="size-4" />,
  invoice: <ReceiptIcon className="size-4" />,
  payment: <CreditCardIcon className="size-4" />,
}

/** Record results carry the icon of the sidebar section they live in. */
const RECORD_ICONS: Record<string, ReactNode> = {
  customer: ICONS.customers,
  plan: ICONS.catalog,
  feature: ICONS.catalog,
  invoice: ICONS.billing,
}

/**
 * The sidebar's glyph for a search row: a page takes its section's icon (a
 * child like Invoices takes Billing's), an action takes its Create-menu icon,
 * and a record takes the icon of the section it belongs to.
 */
function withSearchIcon(item: ShellSearchItem): ShellSearchItem {
  const [kind = '', key = ''] = item.id.split(':')
  let icon: ReactNode
  if (kind === 'page') {
    const section = parentForNavId(key)?.id ?? key
    icon = ICONS[section] ?? <SettingsIcon className="size-4" />
  } else if (kind === 'action') {
    icon = CREATE_ICONS[key]
  } else {
    icon = RECORD_ICONS[kind]
  }
  return icon ? { ...item, icon } : item
}

export interface ConsoleShellProps {
  pathname: string
  /** The query string (`?section=team`), so a Settings tab can be the active row. */
  search?: string
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
  search = '',
  onNavigate,
  environment,
  environments,
  onEnvironmentChange,
  user,
  onSignOut,
  headerActions,
  children,
}: ConsoleShellProps) {
  const activeItemId = navEntryForPath(pathname, search)
  const [detailTrail, setDetailTrail] = useState<ShellDetailCrumb[] | null>(null)
  const [creatingEnvironment, setCreatingEnvironment] = useState(false)
  const mockAccounts = useMockAccounts()
  const [renamingEnvironment, setRenamingEnvironment] = useState<ShellEnvironment | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const destinations = useMemo(() => searchableDestinations(), [])
  const found = useGlobalSearch(searchTerm)
  const searchItems = useMemo(() => destinations.items.map(withSearchIcon), [destinations])
  const searchResults = useMemo(() => found.results.map(withSearchIcon), [found.results])

  const open = (href: string) => {
    if (/^https?:\/\//.test(href)) window.open(href, '_blank', 'noopener,noreferrer')
    else onNavigate(href)
  }

  const goTo = (id: string) => {
    const href = hrefForNavId(id)
    if (href) {
      open(href)
      return
    }
    // A parent: go to its first child rather than doing nothing.
    const firstChild = [...NAV, ...FOOTER_NAV].find((entry) => entry.id === id)?.children?.[0]
    const childHref = firstChild ? hrefForNavId(firstChild.id) : undefined
    if (childHref) onNavigate(childHref)
  }

  // A detail page hands up "list, page": the list crumb becomes a link back
  // and the page type ("Customer details") is appended, never the record id.
  // The group crumb goes where the sidebar's group goes — its first page.
  // The page crumb is a link whenever you are somewhere under it.
  const pagePath = activeItemId ? pathForNavId(activeItemId) : undefined
  const pageHref = activeItemId ? hrefForNavId(activeItemId) : undefined
  const pageLabel = activeItemId ? labelForNavId(activeItemId) : undefined
  const parent = parentForNavId(activeItemId)
  const navTrail: ShellCrumb[] = breadcrumbForPath(pathname, search).map((crumb) => {
    if (parent && crumb.label === parent.label) {
      return { ...crumb, onClick: () => goTo(parent.id) }
    }
    if (pageHref && pageLabel && crumb.label === pageLabel && pathname !== pagePath) {
      return { ...crumb, onClick: () => onNavigate(pageHref) }
    }
    return crumb
  })
  const trail: ShellCrumb[] =
    detailTrail && detailTrail.length >= 2 && navTrail.length > 0
      ? [
          ...navTrail.slice(0, -1),
          {
            ...navTrail[navTrail.length - 1]!,
            ...(detailTrail[0]!.hasClick ? { onClick: detailTrail[0]!.onClick } : {}),
          },
          { label: detailTrail[detailTrail.length - 1]!.label },
        ]
      : navTrail

  return (
    <ShellDetailTrailProvider value={setDetailTrail}>
      <AppShell
        navGroups={toNavGroups(ICONS)}
        {...(activeItemId === undefined ? {} : { activeItemId })}
        onNavigate={goTo}
        user={user}
        onSettings={() => goTo('settings')}
        {...(onSignOut ? { onSignOut } : {})}
        /*
         * The environment leads the trail, and it is where you change it too — the
         * switcher moved out of the sidebar and became this first crumb. The one
         * place people look while working is the top of the page they are working
         * on, so the most consequential control in the product lives there and
         * nowhere else — including managing environments: create and rename are
         * in the switcher itself, not on a Settings page. Production is marked
         * green and sandbox yellow, because a two-state signal beats
         * colour-versus-nothing.
         */
        breadcrumb={
          <ShellBreadcrumb
            trail={[
              {
                label: environment.name,
                content: (
                  <EnvironmentSwitcher
                    current={environment}
                    environments={environments}
                    onChange={onEnvironmentChange}
                    {...(mockAccounts ? { mockAccounts } : {})}
                    onCreate={() => setCreatingEnvironment(true)}
                    onRename={(id) =>
                      setRenamingEnvironment(environments.find((e) => e.id === id) ?? null)
                    }
                    /*
                     * No `onDelete`: the API has no route to delete an
                     * environment (list, create, get, update and clone only),
                     * so offering one would be a control that cannot work.
                     */
                  />
                ),
              },
              ...trail,
            ]}
          />
        }
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
        search={{
          items: searchItems,
          results: searchResults,
          isSearching: found.isSearching,
          hasError: found.hasError,
          onRetry: found.retry,
          onTermChange: setSearchTerm,
          onSelect: (item) => {
            if (item.id === SUPPORT_CHAT_ACTION_ID) return openSupportChat()
            const path = destinations.paths.get(item.id) ?? found.paths.get(item.id)
            if (path) open(path)
          },
        }}
      >
        {children}
      </AppShell>
      <EnvironmentFormPage
        open={creatingEnvironment}
        onOpenChange={setCreatingEnvironment}
        environments={environments}
        onSelectEnvironment={onEnvironmentChange}
      />
      <EnvironmentRenameFormPage
        environment={renamingEnvironment}
        onClose={() => setRenamingEnvironment(null)}
      />
    </ShellDetailTrailProvider>
  )
}
