import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import { BarChart3Icon, HouseIcon, PackageIcon, ReceiptIcon, SettingsIcon } from 'lucide-react'
import { AppShell } from './AppShell'
import { EnvironmentSwitcher } from './EnvironmentSwitcher'
import { ShellBreadcrumb } from './ShellBreadcrumb'
import { ShellCreateMenu } from './ShellCreateMenu'
import type { ShellEnvironment, ShellNavGroup, ShellNotification } from './types'

/**
 * The shell, in the arrangements that actually occur.
 *
 * Every one is reached by passing props — no router, no provider, no session.
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
          { id: 'features', label: 'Features', count: 12 },
          { id: 'plans', label: 'Plans', count: 5 },
          { id: 'coupons', label: 'Coupons', count: 0 },
        ],
      },
      {
        id: 'billing',
        label: 'Billing',
        icon: <ReceiptIcon className="size-4" />,
        items: [
          { id: 'customers', label: 'Customers', count: 30 },
          { id: 'invoices', label: 'Invoices', count: 40 },
        ],
      },
      { id: 'revenue', label: 'Revenue', icon: <BarChart3Icon className="size-4" /> },
    ],
    title: 'Workspace',
  },
  {
    id: 'secondary',
    title: 'Quick links',
    collapsible: true,
    items: [{ id: 'settings', label: 'Settings', icon: <SettingsIcon className="size-4" /> }],
  },
]

const notifications: ShellNotification[] = [
  {
    id: 'n1',
    title: 'Payment failed for Acme Corp',
    description: 'Card declined on invoice INV-2041, $4,820.00.',
    timestamp: '12 minutes ago',
    unread: true,
  },
  {
    id: 'n2',
    title: 'Usage export finished',
    timestamp: 'Yesterday',
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
            variant="breadcrumb"
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

const meta = {
  title: 'Foundation/Compositions/AppShell',
  component: AppShell,
  parameters: {
    layout: 'fullscreen',
    a11y: {
      config: {
        /*
         * Base UI renders `aria-hidden` focus guards with `tabindex="0"` on
         * either side of every portalled surface — menu, popover, dialog. Axe
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
    onDocs: fn(),
    onSignOut: fn(),
    onSearch: fn(),
    children: <div className="p-6 text-sm text-muted-foreground">Page content.</div>,
  },
} satisfies Meta<typeof AppShell>

export default meta
type Story = StoryObj<typeof meta>

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

export const ReportsAGroupClick: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /billing/i }))
    await expect(args.onNavigate).toHaveBeenCalledWith('billing')
  },
}

/**
 * Counts answer "is there anything here?" before the click — zero included.
 *
 * They render outside the row's button, so that the number does not compete
 * with the label for width. That puts them outside the accessible name too,
 * which is why the row states the count itself.
 */
export const CountsAreVisible: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('12')).toBeInTheDocument()
    await expect(canvas.getByText('0')).toBeInTheDocument()

    await expect(canvas.getByRole('button', { name: 'Features, 12' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Coupons, 0' })).toBeInTheDocument()
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
 * The switcher now leads the breadcrumb, carrying the marks: the red dot and
 * the "Live" badge, in the one place people look while they work. There was
 * also a red bar across the top of the window; it was removed — a mark where
 * people already look beats one where they do not.
 */
export const Production: Story = {
  args: { breadcrumb: environmentTrail(production) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Live')).toBeInTheDocument()
    await expect(
      canvas.getByRole('button', { name: /environment: production, production/i }),
    ).toBeInTheDocument()
  },
}

/**
 * Sandbox carries no badge.
 *
 * An environment named "Sandbox" next to a badge reading "Sandbox" says one
 * thing twice, and repetition is how a marker becomes invisible.
 */
export const SandboxIsNotBadged: Story = {
  args: { breadcrumb: environmentTrail(sandbox) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText('Live')).not.toBeInTheDocument()
    await expect(
      canvas.getByRole('button', { name: /environment: sandbox, sandbox/i }),
    ).toBeInTheDocument()
  },
}

/**
 * Search is a button that opens a dialog, not a field that sits there.
 *
 * An always-present input is a tab stop on every screen and an implicit
 * promise to filter *something* — but what it searches changes by page, which
 * is how the current dashboard ends up with a box that sometimes does nothing.
 *
 * The dialog is a portal, so it is asserted on the document rather than on the
 * canvas.
 */
export const SearchOpensADialog: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Search' }))

    const dialog = within(await screen.findByRole('dialog'))
    await userEvent.type(dialog.getByRole('searchbox', { name: 'Search' }), 'acme{Enter}')
    await expect(args.onSearch).toHaveBeenCalledWith('acme')
  },
}

/**
 * Notifications, in each of the four states it can be in.
 *
 * This is the one surface guaranteed to be on screen during an incident, which
 * is exactly why it must not report "all clear" from a failed request.
 */
export const NotificationsUnread: Story = {
  args: { notifications, onMarkNotificationsRead: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /1 unread/i })).toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: /notifications/i }))
    const panel = within(await screen.findByText('Payment failed for Acme Corp'))
    await expect(panel).toBeDefined()
  },
}

export const NotificationsEmpty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // No dot, and the name does not claim a count.
    await expect(canvas.getByRole('button', { name: 'Notifications' })).toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: 'Notifications' }))
    await expect(await screen.findByText('You are all caught up.')).toBeInTheDocument()
  },
}

/**
 * A failed request says so.
 *
 * An empty list here would assert "nothing has happened", which is a different
 * claim from "we could not ask" — and the difference matters most when
 * something *has* happened.
 */
export const NotificationsFailed: Story = {
  args: { notificationsError: { message: 'The service did not respond.' } },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Notifications' }))
    await expect(await screen.findByRole('alert')).toHaveTextContent(
      /could not be loaded/i,
    )
  },
}

export const NotificationsLoading: Story = {
  args: { notificationsLoading: true },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Notifications' }))
    await expect(await screen.findByText('Loading notifications')).toBeInTheDocument()
  },
}

/**
 * The account menu is how someone leaves, so it is reachable in one click — and
 * it is where Documentation now lives, beside Settings, since "Quick links" left
 * the sidebar.
 */
export const AccountMenu: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: /account: dinesh k/i }),
    )
    await expect(await screen.findByRole('menuitem', { name: 'Settings' })).toBeVisible()
    await expect(await screen.findByRole('menuitem', { name: 'Documentation' })).toBeVisible()
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
 * An earlier version put the trigger in a cluster that was hidden when
 * collapsed, so on a desktop — where the page header's own trigger is
 * `md:hidden` — the rail was a one-way door. That trigger has since been
 * removed entirely in favour of the edge handle, which makes this the test
 * that the replacement actually replaced it.
 */
export const RailCanBeReopened: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Collapse sidebar' }))

    await expect(await canvas.findByRole('button', { name: 'Expand sidebar' })).toBeVisible()

    // And the groups are still reachable, as a menu rather than inline.
    await userEvent.click(canvas.getByRole('button', { name: 'Billing' }))
    await expect(await screen.findByRole('menuitem', { name: /invoices/i })).toBeVisible()
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

/**
 * The secondary group collapses; the primary one does not.
 *
 * Hiding the product's own map costs more than the space it saves.
 */
export const QuickLinksCollapse: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const heading = canvas.getByRole('button', { name: /quick links/i })

    await expect(canvas.getByRole('button', { name: /^settings/i })).toBeVisible()
    await userEvent.click(heading)
    await expect(canvas.queryByRole('button', { name: /^settings/i })).not.toBeInTheDocument()

    // The primary group has no such control.
    await expect(canvas.queryByRole('button', { name: /^workspace$/i })).not.toBeInTheDocument()
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
}

/**
 * Create, in the header, from every screen.
 *
 * The things a finance person starts cold — a subscription, a customer — do
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
          { id: 'subscription', label: 'New subscription' },
          { id: 'customer', label: 'New customer' },
          { id: 'plan', label: 'New plan', startsGroup: true },
        ]}
        onCreate={fn()}
      />
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Beside the breadcrumb, in the header — not in the sidebar, and not on
    // the page.
    await expect(canvas.getByRole('button', { name: /create/i })).toBeVisible()
  },
}
