import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { BarChart3Icon, HouseIcon, PackageIcon, ReceiptIcon, SettingsIcon } from 'lucide-react'
import { AppShell } from './AppShell'
import type { ShellEnvironment, ShellNavGroup } from './types'

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
      { id: 'settings', label: 'Settings', icon: <SettingsIcon className="size-4" /> },
    ],
  },
]

const sandbox: ShellEnvironment = { id: 'env_dev', name: 'Sandbox', kind: 'sandbox' }
const production: ShellEnvironment = { id: 'env_prod', name: 'Production', kind: 'production' }

const meta = {
  title: 'Foundation/Compositions/AppShell',
  component: AppShell,
  parameters: { layout: 'fullscreen' },
  args: {
    navGroups,
    activeItemId: 'features',
    onNavigate: fn(),
    environment: sandbox,
    environments: [sandbox, production],
    onEnvironmentChange: fn(),
    user: { name: 'Dinesh K', email: 'dinesh@flexprice.io' },
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

/** Counts answer "is there anything here?" before the click — zero included. */
export const CountsAreVisible: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('12')).toBeInTheDocument()
    await expect(canvas.getByText('0')).toBeInTheDocument()
  },
}

/**
 * Production is marked, and not only by colour.
 *
 * Editing a live plan must not look identical to editing a sandbox one, and
 * the marker has to survive someone who cannot distinguish the colour.
 */
export const Production: Story = {
  args: { environment: production },
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText('Live')).not.toBeInTheDocument()
    await expect(
      canvas.getByRole('button', { name: /environment: sandbox, sandbox/i }),
    ).toBeInTheDocument()
  },
}

export const SearchIsInTheSidebar: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const field = canvas.getByRole('searchbox', { name: 'Search' })
    await userEvent.type(field, 'acme{Enter}')
    await expect(args.onSearch).toHaveBeenCalledWith('acme')
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
