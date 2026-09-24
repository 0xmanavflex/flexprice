import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import {
  BarChart3Icon,
  HouseIcon,
  PackageIcon,
  ReceiptIcon,
  SettingsIcon,
  UsersIcon,
} from 'lucide-react'
import { AppShell } from './AppShell'
import type { ShellEnvironment, ShellNavGroup, ShellSection } from './types'

/**
 * The shell, in the arrangements that actually occur.
 *
 * Every one is reached by passing props — no router, no provider, no session.
 * "The user is in Catalog, in production, with an empty coupon list" is a
 * story, which is only possible because the shell holds no state of its own.
 */
const sections: ShellSection[] = [
  { id: 'home', label: 'Home', icon: <HouseIcon className="size-5" /> },
  { id: 'customers', label: 'Customers', icon: <UsersIcon className="size-5" /> },
  { id: 'billing', label: 'Billing', icon: <ReceiptIcon className="size-5" /> },
  { id: 'catalog', label: 'Catalog', icon: <PackageIcon className="size-5" /> },
  { id: 'usage', label: 'Usage', icon: <BarChart3Icon className="size-5" /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon className="size-5" /> },
]

const catalogNav: ShellNavGroup[] = [
  {
    id: 'catalog',
    items: [
      { id: 'features', label: 'Features', count: 12 },
      { id: 'plans', label: 'Plans', count: 5 },
      { id: 'addons', label: 'Add-ons', count: 3 },
      { id: 'coupons', label: 'Coupons', count: 0 },
      { id: 'price-units', label: 'Price units', count: 2 },
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
    sections,
    activeSectionId: 'catalog',
    onSectionChange: fn(),
    navGroups: catalogNav,
    activeItemId: 'features',
    onNavigate: fn(),
    environment: sandbox,
    environments: [sandbox, production],
    onEnvironmentChange: fn(),
    user: { name: 'Dinesh K', email: 'dinesh@flexprice.io' },
    onOpenSearch: fn(),
    children: <div className="p-6 text-sm text-muted-foreground">Page content.</div>,
  },
} satisfies Meta<typeof AppShell>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/**
 * Sandbox carries no badge.
 *
 * An environment named "Sandbox" next to a badge reading "Sandbox" says one
 * thing twice, and repetition is how a marker becomes invisible. The kind is
 * still in the accessible name.
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

/** A section with no children renders no second panel rather than an empty one. */
export const SectionWithoutChildren: Story = {
  args: { activeSectionId: 'home', navGroups: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText('Features')).not.toBeInTheDocument()
  },
}

/** Counts answer "is there anything here?" before the click. */
export const CountsAreVisible: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('12')).toBeInTheDocument()
    // Zero is shown, not hidden — an empty coupon list is the thing worth knowing.
    await expect(canvas.getByText('0')).toBeInTheDocument()
  },
}

export const ReportsSectionChange: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Customers' }))
    await expect(args.onSectionChange).toHaveBeenCalledWith('customers')
  },
}

export const ReportsNavigation: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Plans' }))
    await expect(args.onNavigate).toHaveBeenCalledWith('plans')
  },
}

/** The current location is announced, not only highlighted. */
export const AnnouncesCurrentLocation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Catalog' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(canvas.getByRole('button', { name: 'Features' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  },
}
