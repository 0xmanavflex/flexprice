import type { ReactNode } from 'react'
import { fn } from 'storybook/test'
import {
  BoxesIcon,
  CodeIcon,
  CreditCardIcon,
  FileTextIcon,
  HouseIcon,
  PackageIcon,
  ReceiptIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
} from '@ui/icons'
import { AppShell } from '@ui/compositions/shell/AppShell'
import { EnvironmentSwitcher } from '@ui/compositions/shell/EnvironmentSwitcher'
import { ShellBreadcrumb } from '@ui/compositions/shell/ShellBreadcrumb'
import { ShellDetailTrailProvider } from '@ui/compositions/shell/ShellDetailTrail'
import type { ShellEnvironment, ShellNavGroup, ShellUser } from '@ui/compositions/shell/types'

/*
 * Shared shell fixtures for the composed page stories.
 *
 * Not a story file: it only supplies the chrome (sidebar, breadcrumb, account)
 * that surrounds every console page, so each page story can show the page the
 * way the product frames it. The ids mirror apps/console's navigation tree.
 */

/** The console sidebar, as `apps/console` builds it from its NAV tree. */
export const SHELL_NAV_GROUPS: ShellNavGroup[] = [
  {
    id: 'main',
    items: [
      { id: 'home', label: 'Home', icon: <HouseIcon className="size-4" /> },
      { id: 'customers', label: 'Customers', icon: <UsersIcon className="size-4" /> },
      {
        id: 'subscriptions',
        label: 'Contracts',
        icon: <FileTextIcon className="size-4" />,
      },
      {
        id: 'billing',
        label: 'Billing',
        icon: <ReceiptIcon className="size-4" />,
        items: [
          { id: 'invoices', label: 'Invoices' },
          { id: 'credit-notes', label: 'Credit memos' },
        ],
      },
      {
        id: 'collections',
        label: 'Collections',
        icon: <WalletIcon className="size-4" />,
        items: [{ id: 'payments', label: 'Payments' }],
      },
      { id: 'revenue', label: 'Revenue', icon: <TrendingUpIcon className="size-4" /> },
      {
        id: 'catalog',
        label: 'Product catalog',
        icon: <PackageIcon className="size-4" />,
        items: [
          { id: 'features', label: 'Features' },
          { id: 'plans', label: 'Plans' },
          { id: 'addons', label: 'Add-ons' },
          { id: 'coupons', label: 'Coupons' },
        ],
      },
      {
        id: 'developers',
        label: 'Developers',
        icon: <CodeIcon className="size-4" />,
        items: [
          { id: 'events', label: 'Events debugger' },
          { id: 'webhooks', label: 'Webhooks' },
        ],
      },
    ],
  },
  {
    id: 'secondary',
    pinned: true,
    items: [
      { id: 'settings', label: 'Settings', icon: <CreditCardIcon className="size-4" /> },
      { id: 'integrations', label: 'Integrations', icon: <BoxesIcon className="size-4" /> },
    ],
  },
]

export const SHELL_SANDBOX: ShellEnvironment = { id: 'env_dev', name: 'Sandbox', kind: 'sandbox' }
export const SHELL_PRODUCTION: ShellEnvironment = {
  id: 'env_prod',
  name: 'Production',
  kind: 'production',
}

export const SHELL_USER: ShellUser = {
  name: 'Dinesh K',
  email: 'dinesh@flexprice.io',
  organization: 'Flexprice',
}

/**
 * The console's shell draws a detail page's trail in its own header, so the page
 * publishes it upward and renders no second breadcrumb. The story's header trail
 * is fixed, so the published one is dropped.
 */
const ignoreDetailTrail = () => undefined

export interface PageShellProps {
  /** The sidebar row to mark active, e.g. `customers` or `features`. */
  activeItemId: string
  /** Crumbs after the environment, outermost first. The last is the current page. */
  trail: string[]
  /** Which environment leads the breadcrumb. */
  environment?: ShellEnvironment
  children: ReactNode
}

/**
 * The console chrome around one page.
 *
 * `AppShell` owns the single `main` landmark, so a page rendered inside it must
 * not add another.
 */
export function PageShell({
  activeItemId,
  trail,
  environment = SHELL_SANDBOX,
  children,
}: PageShellProps) {
  return (
    <AppShell
      navGroups={SHELL_NAV_GROUPS}
      activeItemId={activeItemId}
      onNavigate={fn()}
      user={SHELL_USER}
      onSettings={fn()}
      onSignOut={fn()}
      search={{
        items: [
          { id: 'page:customers', label: 'Customers', group: 'Pages' },
          { id: 'page:invoices', label: 'Invoices', group: 'Pages' },
        ],
        onSelect: fn(),
      }}
      breadcrumb={
        <ShellBreadcrumb
          trail={[
            {
              label: environment.name,
              content: (
                <EnvironmentSwitcher
                  current={environment}
                  environments={[SHELL_SANDBOX, SHELL_PRODUCTION]}
                  onChange={fn()}
                />
              ),
            },
            ...trail.map((label) => ({ label })),
          ]}
        />
      }
    >
      <ShellDetailTrailProvider value={ignoreDetailTrail}>{children}</ShellDetailTrailProvider>
    </AppShell>
  )
}

/**
 * Parameters every composed page story shares: fullscreen, and the focus-guard
 * rule off because the shell's menus open Base UI portals.
 */
export const PAGE_STORY_PARAMETERS = {
  layout: 'fullscreen',
  a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } },
} as const

/** The rows a server would return for `page`, so paging in a story really pages. */
export function paginate<T>(all: readonly T[], page: number, pageSize: number): T[] {
  return all.slice((page - 1) * pageSize, page * pageSize)
}

/** A list failure as `ListState` takes it: the sentence, and whether retrying can help. */
export function listFailure(hasError: boolean, noun: string) {
  return hasError ? { message: `Flexprice had a problem loading ${noun}.`, canRetry: true } : null
}
