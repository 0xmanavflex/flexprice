import type { ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { BarChart3Icon, HouseIcon, PackageIcon, ReceiptIcon, SettingsIcon } from '@ui/icons'
import { SidebarProvider } from '@ui/components/primitives/sidebar'
import { TooltipProvider } from '@ui/components/primitives/tooltip'
import { ShellNav } from './ShellNav'
import type { ShellNavGroup, ShellNavItem } from './types'

/**
 * Nested navigation. A group is open because something inside it is active:
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
  },
  {
    id: 'secondary',
    title: 'Quick links',
    items: [{ id: 'settings', label: 'Settings', icon: <SettingsIcon className="size-4" /> }],
  },
]

const FOOTER_GROUP: ShellNavGroup = {
  id: 'footer',
  pinned: true,
  items: [
    { id: 'integrations', label: 'Integrations' },
    {
      id: 'settings-menu',
      label: 'Developers',
      items: [
        { id: 'api-keys', label: 'API keys' },
        { id: 'webhooks', label: 'Webhooks' },
      ],
    },
  ],
}

const NAV_IDS = [
  'home',
  'features',
  'plans',
  'coupons',
  'customers',
  'invoices',
  'revenue',
  'settings',
  'api-keys',
  'webhooks',
]

function shapeItem(item: ShellNavItem, showIcons: boolean): ShellNavItem {
  const { icon, items, ...rest } = item
  return {
    ...rest,
    ...(showIcons && icon ? { icon } : {}),
    ...(items ? { items: items.map((child) => shapeItem(child, showIcons)) } : {}),
  }
}

type PlaygroundArgs = Omit<ComponentProps<typeof ShellNav>, 'groups'> & {
  showIcons: boolean
  showGroupTitles: boolean
  showPinnedFooter: boolean
}

const meta = {
  title: 'Building blocks/Shell/ShellNav',
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
  argTypes: {
    groups: { control: false },
    activeItemId: { control: 'select', options: NAV_IDS, description: 'Its parent group opens.' },
    onNavigate: { control: false },
  },
} satisfies Meta<typeof ShellNav>

export default meta
type Story = StoryObj<typeof meta>

/** Move the active item to open a different group, and toggle icons, group titles and the pinned footer. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    activeItemId: 'features',
    showIcons: true,
    showGroupTitles: true,
    showPinnedFooter: false,
    onNavigate: fn(),
  },
  argTypes: {
    showIcons: { control: 'boolean' },
    showGroupTitles: { control: 'boolean' },
    showPinnedFooter: { control: 'boolean', description: 'Adds a pinned group under a rule.' },
  },
  render: ({ showIcons, showGroupTitles, showPinnedFooter, ...args }) => (
    <ShellNav
      {...args}
      groups={[...navGroups, ...(showPinnedFooter ? [FOOTER_GROUP] : [])].map(
        ({ title, items, ...group }): ShellNavGroup => ({
          ...group,
          ...(showGroupTitles && title ? { title } : {}),
          items: items.map((item) => shapeItem(item, showIcons)),
        }),
      )}
    />
  ),
}

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
 * A child row runs to the end of the sidebar, so the hover and active fill
 * covers the whole row rather than hugging the label.
 */
export const ChildRowSpansTheSidebar: Story = {
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByRole('button', { name: /^features/i })
    const item = row.closest('li')!
    // The row carries a 1px `-translate-x-px`, so allow that much.
    const gap = item.getBoundingClientRect().right - row.getBoundingClientRect().right
    await expect(Math.abs(gap)).toBeLessThanOrEqual(2)
  },
}

/**
 * A `pinned` group sits at the foot of the sidebar under a rule, and only one
 * section is open across both groups.
 */
export const PinnedFooter: Story = {
  args: {
    activeItemId: 'plans',
    groups: [
      ...navGroups.filter((group) => group.id !== 'secondary'),
      {
        id: 'footer',
        pinned: true,
        items: [
          { id: 'integrations', label: 'Integrations' },
          {
            id: 'settings',
            label: 'Settings',
            items: [
              { id: 'settings-team', label: 'Team' },
              { id: 'settings-taxes', label: 'Taxes' },
            ],
          },
        ],
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const catalog = canvas.getByRole('button', { name: /product catalog/i })
    const settings = canvas.getByRole('button', { name: /^settings/i })
    await expect(settings.closest('[data-pinned]')).not.toBeNull()
    await expect(catalog).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(settings)
    await expect(settings).toHaveAttribute('aria-expanded', 'true')
    await expect(catalog).toHaveAttribute('aria-expanded', 'false')
  },
}
