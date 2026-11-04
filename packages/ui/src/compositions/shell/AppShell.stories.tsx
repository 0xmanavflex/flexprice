import type { ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import { BarChart3Icon, HouseIcon, PackageIcon, ReceiptIcon, SettingsIcon } from '@ui/icons'
import { AppShell } from './AppShell'
import { EnvironmentSwitcher } from './EnvironmentSwitcher'
import { ShellBreadcrumb } from './ShellBreadcrumb'
import { ShellChangelog } from './ShellChangelog'
import { ShellCreateMenu } from './ShellCreateMenu'
import type { ShellEnvironment, ShellNavGroup } from './types'
import { DOCS } from '@fp/domain'

/**
 * The shell, in the arrangements that actually occur.
 *
 * Every one is reached by passing props: no router, no provider, no session.
 * "In the catalogue, in production, with an empty coupon list" is a story,
 * which is only possible because the shell holds no state of its own.
 */
const navGroups: ShellNavGroup[] = [
  {
    id: 'main',
    items: [
      { id: 'home', label: 'Home', icon: <HouseIcon className="size-4" /> },
      {
        id: 'catalog',
        label: 'Product Catalog',
        icon: <PackageIcon className="size-4" />,
        items: [
          { id: 'features', label: 'Features' },
          { id: 'plans', label: 'Plans' },
          { id: 'coupons', label: 'Coupons' },
        ],
      },
      {
        id: 'billing',
        label: 'Billing',
        icon: <ReceiptIcon className="size-4" />,
        items: [
          { id: 'customers', label: 'Customers' },
          { id: 'invoices', label: 'Invoices' },
        ],
      },
      { id: 'revenue', label: 'Revenue', icon: <BarChart3Icon className="size-4" /> },
    ],
    title: 'Workspace',
  },
  {
    id: 'secondary',
    title: 'Quick links',
    items: [{ id: 'settings', label: 'Settings', icon: <SettingsIcon className="size-4" /> }],
  },
]

const sandbox: ShellEnvironment = { id: 'env_dev', name: 'Sandbox', kind: 'sandbox' }
const production: ShellEnvironment = { id: 'env_prod', name: 'Production', kind: 'production' }

/**
 * The breadcrumb as the shell actually receives it: the environment switcher
 * leads the trail, then the page's own crumbs. The switcher moved here from the
 * sidebar, so this is where the production marking now lives.
 */
const environmentTrail = (current: ShellEnvironment) => (
  <ShellBreadcrumb
    trail={[
      {
        label: current.name,
        content: (
          <EnvironmentSwitcher
            current={current}
            environments={[sandbox, production]}
            onChange={fn()}
          />
        ),
      },
      { label: 'Product Catalog' },
      { label: 'Features' },
    ]}
  />
)

const ACTIVE_IDS = [
  'home',
  'features',
  'plans',
  'coupons',
  'customers',
  'invoices',
  'revenue',
  'settings',
]

type PlaygroundArgs = ComponentProps<typeof AppShell> & {
  environment: 'sandbox' | 'production'
  showBreadcrumb: boolean
  showSearch: boolean
  showCreateMenu: boolean
  showPinned: boolean
  showHeaderActions: boolean
}

const meta = {
  title: 'Building blocks/Shell/AppShell',
  component: AppShell,
  parameters: {
    layout: 'fullscreen',
    a11y: {
      config: {
        /*
         * Base UI renders `aria-hidden` focus guards with `tabindex="0"` on
         * either side of every portalled surface: menu, popover, dialog. Axe
         * flags them, correctly, and we cannot fix them without forking the
         * library. The rule stays on everywhere else; this file is the one
         * that opens portals.
         */
        rules: [{ id: 'aria-hidden-focus', enabled: false }],
      },
    },
  },
  args: {
    navGroups,
    activeItemId: 'features',
    onNavigate: fn(),
    user: { name: 'Dinesh K', email: 'dinesh@flexprice.io', organization: 'Flexprice' },
    onSettings: fn(),
    onSignOut: fn(),
    search: {
      items: [{ id: 'page:customers', label: 'Customers', group: 'Pages' }],
      onSelect: fn(),
    },
    children: <div className="text-muted-foreground p-6 text-sm">Page content.</div>,
  },
  argTypes: {
    activeItemId: {
      control: 'select',
      options: ACTIVE_IDS,
      description: 'The active destination; its group opens.',
    },
    productName: { control: 'text', description: 'Shown when the user has no organization.' },
    user: { control: 'object', description: 'name, email, optional organization and avatarUrl.' },
    navGroups: { control: 'object' },
    onNavigate: { control: false },
    onProfile: { control: false },
    onSettings: { control: false },
    onSignOut: { control: false },
    search: { control: false },
    logo: {
      control: false,
      description: 'Replaces the default Flexprice icon at the top of the sidebar.',
    },
    pinned: { control: false },
    breadcrumb: { control: false },
    headerActions: { control: false },
    children: { control: false },
  },
} satisfies Meta<typeof AppShell>

export default meta
type Story = StoryObj<typeof meta>

/** Switch the active page, environment and every optional slot; the sidebar collapses and the groups navigate. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    activeItemId: 'features',
    productName: 'Flexprice',
    environment: 'sandbox',
    showBreadcrumb: true,
    showSearch: true,
    showCreateMenu: true,
    showPinned: false,
    showHeaderActions: false,
  },
  argTypes: {
    environment: { control: 'inline-radio', options: ['sandbox', 'production'] },
    showBreadcrumb: { control: 'boolean' },
    showSearch: { control: 'boolean' },
    showCreateMenu: { control: 'boolean' },
    showPinned: { control: 'boolean' },
    showHeaderActions: { control: 'boolean' },
  },
  render: ({
    environment,
    showBreadcrumb,
    showSearch,
    showCreateMenu,
    showPinned,
    showHeaderActions,
    search,
    ...args
  }) => (
    <AppShell
      {...args}
      {...(showSearch && search ? { search } : {})}
      {...(showBreadcrumb
        ? { breadcrumb: environmentTrail(environment === 'production' ? production : sandbox) }
        : {})}
      {...(showPinned
        ? {
            pinned: (
              <div className="rounded-lg border p-3 text-xs">
                <p className="font-medium">3 invoices overdue</p>
                <p className="text-muted-foreground">Oldest is 35 days past due.</p>
              </div>
            ),
          }
        : {})}
      headerActions={
        <>
          {showHeaderActions ? (
            <span className="text-muted-foreground rounded-md border px-2 py-1 text-xs">
              All systems normal
            </span>
          ) : null}
          {showCreateMenu ? (
            <ShellCreateMenu
              actions={[
                { id: 'subscription', label: 'New contract' },
                { id: 'customer', label: 'New customer' },
                { id: 'plan', label: 'New plan', startsGroup: true },
              ]}
              onCreate={fn()}
            />
          ) : null}
        </>
      }
    />
  ),
}

export const Default: Story = {}

/**
 * The group containing the active item is open; the others are not.
 *
 * Expansion is derived from the active id rather than stored, so a deep link
 * opens the right group with nothing to wire and no second source of truth to
 * fall out of step with the URL.
 */
export const ActiveGroupIsExpanded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Catalog holds the active item, so its children are visible.
    await expect(canvas.getByRole('button', { name: /features/i })).toBeInTheDocument()
    // Billing does not, so its children are not rendered at all.
    await expect(canvas.queryByRole('button', { name: /^invoices/i })).not.toBeInTheDocument()

    await expect(canvas.getByRole('button', { name: /product catalog/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  },
}

/**
 * The whole tree stays legible.
 *
 * This is the reason for choosing a nested sidebar over a rail that swaps its
 * panel: standing in the catalogue you can still see Billing exists.
 */
export const OtherGroupsRemainVisible: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /billing/i })).toBeVisible()
    await expect(canvas.getByRole('button', { name: /revenue/i })).toBeVisible()
  },
}

export const ReportsNavigation: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /^plans/i }))
    await expect(args.onNavigate).toHaveBeenCalledWith('plans')
  },
}

/**
 * The Flexprice icon heads the sidebar beside the tenant's name. It is
 * decorative (the name beside it already says whose workspace this is), so it
 * carries no alt text, and there is no theme control in the header.
 */
export const BrandMarkHeadsTheSidebar: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const mark = canvasElement.querySelector('[data-slot="sidebar-header"] img')
    await expect(mark).not.toBeNull()
    await expect(mark).toHaveAttribute('aria-hidden', 'true')
    await expect(canvas.getByText('Flexprice')).toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: /theme/i })).not.toBeInTheDocument()
  },
}

export const ReportsAGroupClick: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /billing/i }))
    await expect(args.onNavigate).toHaveBeenCalledWith('billing')
  },
}

/**
 * Production is marked, and not only by colour.
 *
 * Editing a live plan must not look identical to editing a sandbox one, and
 * the marker has to survive someone who cannot distinguish the colour.
 */
/**
 * Production is marked, and not only by colour.
 *
 * The switcher leads the breadcrumb, carrying the mark: the environment's
 * name beside a red dot, in the one place people look while they work.
 */
export const Production: Story = {
  args: { breadcrumb: environmentTrail(production) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Production')).toBeInTheDocument()
    await expect(
      canvas.getByRole('button', { name: /environment: production, production/i }),
    ).toBeInTheDocument()
  },
}

/** Sandbox is named the same way, with an amber dot rather than a red one. */
export const Sandbox: Story = {
  args: { breadcrumb: environmentTrail(sandbox) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Sandbox')).toBeInTheDocument()
    await expect(
      canvas.getByRole('button', { name: /environment: sandbox, sandbox/i }),
    ).toBeInTheDocument()
  },
}

/**
 * Search is a button that opens a dialog, not a field that sits there.
 *
 * An always-present input is a tab stop on every screen and an implicit
 * promise to filter *something*: but what it searches changes by page, which
 * is how the current dashboard ends up with a box that sometimes does nothing.
 *
 * The dialog is a portal, so it is asserted on the document rather than on the
 * canvas.
 */
export const SearchOpensADialog: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Search' }))

    const dialog = within(await screen.findByRole('dialog'))
    await userEvent.type(dialog.getByRole('combobox', { name: 'Search' }), 'cust{Enter}')
    await expect(args.search?.onSelect).toHaveBeenCalled()
  },
}

/**
 * The account menu is how someone leaves, so it is reachable in one click.
 * Documentation is not in it: its one home is the sidebar footer.
 */
export const AccountMenu: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /account: dinesh k/i }))
    // `waitFor` so the visibility checks retry while the menu animates open.
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Settings' })).toBeVisible())
    // Documentation lives in the sidebar footer only, not here as well.
    await expect(screen.queryByRole('menuitem', { name: 'Documentation' })).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sign out' }))
    await expect(args.onSignOut).toHaveBeenCalled()
  },
}

/**
 * The breadcrumb names the group as well as the page.
 *
 * With navigation two levels deep, "Features" alone does not say it sits under
 * Product Catalog.
 */
export const WithBreadcrumb: Story = {
  args: {
    breadcrumb: (
      <ShellBreadcrumb
        trail={[
          {
            label: 'Sandbox',
            mark: <span aria-hidden className="bg-muted-foreground/50 size-2 rounded-full" />,
          },
          { label: 'Product Catalog' },
          { label: 'Features' },
        ]}
      />
    ),
  },
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole('navigation', { name: 'breadcrumb' })

    // Every crumb is named even at widths where its label is hidden.
    await expect(within(nav).getByLabelText('Sandbox')).toBeInTheDocument()
    await expect(within(nav).getByText('Product Catalog')).toBeVisible()

    // The current page is not a link. A link to where you already are does
    // nothing, and offering it is a promise the interface cannot keep.
    await expect(within(nav).getByLabelText('Features').tagName).not.toBe('BUTTON')
    await expect(within(nav).queryByRole('button', { name: 'Features' })).not.toBeInTheDocument()
  },
}

/**
 * Collapsing must not hide the way back out.
 *
 * On a desktop the header's own trigger is hidden, so the edge rail is the only
 * way to toggle the sidebar and it must still be there once collapsed.
 */
export const RailCanBeReopened: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Toggle Sidebar' }))

    await expect(await canvas.findByRole('button', { name: 'Toggle Sidebar' })).toBeVisible()

    // And the groups are still reachable, as a menu rather than inline.
    await userEvent.click(canvas.getByRole('button', { name: 'Billing' }))
    // `waitFor` so the visibility check retries while the menu animates open.
    await waitFor(() => expect(screen.getByRole('menuitem', { name: /^invoices/i })).toBeVisible())
  },
}

export const WithHeaderActions: Story = {
  args: {
    headerActions: (
      <span className="text-muted-foreground rounded-md border px-2 py-1 text-xs">
        All systems normal
      </span>
    ),
  },
}

/** The pinned slot: whatever is always worth seeing for this product. */
export const WithPinnedContent: Story = {
  args: {
    pinned: (
      <div className="rounded-lg border p-3 text-xs">
        <p className="font-medium">3 invoices overdue</p>
        <p className="text-muted-foreground">Oldest is 35 days past due.</p>
      </div>
    ),
  },
  // No group here is pinned: the content still reaches the foot of the sidebar.
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('3 invoices overdue')).toBeInTheDocument()
  },
}

/** What's new: the console's changelog stack, where it lives, above the account menu. */
export const WithChangelog: Story = {
  args: {
    pinned: (
      <ShellChangelog
        entries={[
          {
            id: 'console-v2',
            title: 'A new console',
            summary: 'Search every record with ⌘K, and switch environments from the breadcrumb.',
            href: DOCS.home,
            scene: 'home',
          },
          {
            id: 'contracts',
            title: 'Subscriptions are now contracts',
            summary:
              'Charges split into Current, Upcoming and History, and a contract can have a parent.',
            href: DOCS.subscriptionCreate,
            scene: 'contracts',
          },
        ]}
      />
    ),
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('region', { name: "What's new" }),
    ).toBeInTheDocument()
  },
}

/**
 * Create, in the header, from every screen.
 *
 * The things a finance person starts cold: a subscription, a customer: do
 * not live on the screen they happen to be looking at, so reaching them costs
 * a navigation and a search before any work begins.
 *
 * The menu's own behaviour is covered in `ShellCreateMenu.stories.tsx`; this
 * one is about where it sits.
 */
export const CreateMenu: Story = {
  args: {
    headerActions: (
      <ShellCreateMenu
        actions={[
          { id: 'subscription', label: 'New contract' },
          { id: 'customer', label: 'New customer' },
          { id: 'invoice', label: 'New invoice' },
          { id: 'payment', label: 'Record a payment' },
        ]}
        onCreate={fn()}
      />
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Beside the breadcrumb, in the header: not in the sidebar, and not on
    // the page.
    await expect(canvas.getByRole('button', { name: /create/i })).toBeVisible()
  },
}
