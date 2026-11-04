import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import { CopyIcon, PencilIcon, PowerIcon, TicketPercentIcon, Trash2Icon } from '@ui/icons'
import { CatalogStatusBadge, type CatalogStatus } from '../../shared/StatusBadge'
import { CatalogDetailFrame, type CatalogDetailFrameProps } from './CatalogDetailFrame'

const TAB_LABELS = ['Overview', 'Redemptions', 'Information', 'Activity', 'Settings']

function makeTabs(count: number) {
  return TAB_LABELS.slice(0, count).map((label) => ({
    value: label.toLowerCase(),
    label,
    content: <p className="text-muted-foreground py-6 text-sm">{label} tab content.</p>,
  }))
}

function makeMenu(count: number) {
  const items = [
    { id: 'edit', label: 'Edit', icon: <PencilIcon aria-hidden />, onSelect: fn() },
    { id: 'duplicate', label: 'Duplicate', icon: <CopyIcon aria-hidden />, onSelect: fn() },
    {
      id: 'delete',
      label: 'Delete',
      icon: <Trash2Icon aria-hidden />,
      onSelect: fn(),
      destructive: true,
    },
  ]
  return items.slice(0, count)
}

/** Holds the active tab so clicking the strip works. */
function Frame(props: CatalogDetailFrameProps) {
  const [tab, setTab] = useState(props.tab ?? props.tabs[0]?.value ?? '')
  return <CatalogDetailFrame {...props} tab={tab} onTabChange={setTab} />
}

const meta = {
  title: 'App/Product catalog/Catalog detail frame',
  component: CatalogDetailFrame,
  parameters: { layout: 'fullscreen' },
  render: (args) => <Frame {...args} />,
  args: {
    listLabel: 'Coupons',
    onBack: fn(),
    icon: <TicketPercentIcon aria-hidden />,
    title: 'Launch 20% off',
    badges: <CatalogStatusBadge status="published" />,
    id: 'coupon_01HZX3',
    menuLabel: 'Coupon actions',
    menu: makeMenu(3),
    tabs: makeTabs(3),
  },
  argTypes: {
    listLabel: { control: 'text' },
    title: { control: 'text' },
    id: { control: 'text' },
    menuLabel: { control: 'text' },
    tab: { control: false },
    badges: { control: false },
    icon: { control: false },
    children: { control: false },
    onBack: { control: false },
    onTabChange: { control: false },
    menu: { control: false },
    tabs: { control: false },
  },
} satisfies Meta<typeof CatalogDetailFrame>

export default meta
type Story = StoryObj<typeof meta>

interface PlaygroundArgs {
  listLabel: string
  title: string
  status: CatalogStatus
  showBadge: boolean
  id: string
  tabCount: number
  menuItems: number
}

/** Title, status chip, tab count and the number of menu items are controls. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    listLabel: 'Add-ons',
    title: 'Priority support',
    status: 'published',
    showBadge: true,
    id: 'addon_01HZX3',
    tabCount: 3,
    menuItems: 3,
  },
  argTypes: {
    listLabel: { control: 'text' },
    title: { control: 'text' },
    status: { control: 'inline-radio', options: ['published', 'archived'] },
    showBadge: { control: 'boolean' },
    id: { control: 'text' },
    tabCount: { control: { type: 'range', min: 1, max: 5, step: 1 } },
    menuItems: { control: { type: 'range', min: 0, max: 3, step: 1 } },
  },
  render: (a) => (
    <Frame
      listLabel={a.listLabel}
      onBack={fn()}
      icon={<TicketPercentIcon aria-hidden />}
      title={a.title}
      id={a.id}
      menuLabel="More actions"
      menu={makeMenu(a.menuItems)}
      tabs={makeTabs(a.tabCount)}
      {...(a.showBadge ? { badges: <CatalogStatusBadge status={a.status} /> } : {})}
    />
  ),
}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Coupon actions' })).toBeInTheDocument()
    await expect(canvas.getByText('Active')).toBeVisible()
    await expect(canvas.getByRole('tab', { name: 'Overview' })).toBeInTheDocument()
  },
}

/** Switching tabs shows that tab's panel. */
export const SwitchesTabs: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: 'Redemptions' }))
    await expect(await canvas.findByText('Redemptions tab content.')).toBeInTheDocument()
  },
}

/** The overflow menu lists its actions and runs the chosen one. */
export const OverflowMenu: Story = {
  parameters: {
    // Base UI renders aria-hidden focus guards with tabindex=0 around portalled menus; vendored, not ours.
    a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } },
  },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Coupon actions' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    await expect(args.menu?.[0]?.onSelect).toHaveBeenCalled()
  },
}

/** A disabled menu item stays in the list but cannot be chosen. */
export const DisabledItem: Story = {
  args: {
    menu: [
      {
        id: 'activate',
        label: 'Activate',
        icon: <PowerIcon aria-hidden />,
        onSelect: fn(),
        disabled: true,
      },
    ],
  },
  parameters: {
    a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } },
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Coupon actions' }))
    await expect(await screen.findByRole('menuitem', { name: 'Activate' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  },
}

/** No menu: just the title and tabs. */
export const ReadOnly: Story = {
  render: (args) => <Frame {...args} menu={[]} />,
}
