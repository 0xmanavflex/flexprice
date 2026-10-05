import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { BarChart3Icon, HouseIcon, PackageIcon, ReceiptIcon, SettingsIcon } from 'lucide-react'
import { SidebarProvider } from '@ui/components/primitives/sidebar'
import { TooltipProvider } from '@ui/components/primitives/tooltip'
import { ShellNav } from './ShellNav'
import type { ShellNavGroup } from './types'

/**
 * Nested navigation. A group is open because something inside it is active —
 * expansion is derived from the active id, not stored, so a deep link opens
 * the right group with nothing to wire.
 */
const navGroups: ShellNavGroup[] = [
  {
    id: 'main',
    title: 'Workspace',
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
  },
  {
    id: 'secondary',
    title: 'Quick links',
    items: [{ id: 'settings', label: 'Settings', icon: <SettingsIcon className="size-4" /> }],
  },
]

const meta = {
  title: 'Foundation/Compositions/Shell/ShellNav',
  component: ShellNav,
  decorators: [
    (Story) => (
      <SidebarProvider className="block h-auto w-64 p-2">
        <TooltipProvider delay={0}>
          <Story />
        </TooltipProvider>
      </SidebarProvider>
    ),
  ],
  args: {
    groups: navGroups,
    activeItemId: 'features',
    onNavigate: fn(),
  },
} satisfies Meta<typeof ShellNav>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** The group holding the active item is open; the others stay collapsed. */
export const ActiveGroupIsExpanded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /product catalog/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    // Billing does not hold the active item, so its children are not rendered.
    await expect(canvas.queryByRole('button', { name: /^invoices/i })).not.toBeInTheDocument()
  },
}

export const ReportsNavigation: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /^plans/i }))
    await expect(args.onNavigate).toHaveBeenCalledWith('plans')
  },
}

/**
 * Counts answer "is there anything here?" before the click — zero included.
 *
 * They render outside the row's button, so they sit outside the accessible
 * name too, which is why the row states the count itself.
 */
export const CountsAreVisible: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('12')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Coupons, 0' })).toBeInTheDocument()
  },
}

/**
 * A child row runs to the end of the sidebar, so the hover and active fill
 * covers the whole row rather than hugging the label.
 */
export const ChildRowSpansTheSidebar: Story = {
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByRole('button', { name: /^features/i })
    const item = row.closest('li')!
    await expect(Math.round(row.getBoundingClientRect().right)).toBe(
      Math.round(item.getBoundingClientRect().right),
    )
  },
}
