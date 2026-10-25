import type { ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import { CreditCardIcon, PackageIcon, ReceiptIcon, RepeatIcon, UserPlusIcon } from '@ui/icons'
import { ShellCreateMenu, type ShellCreateAction } from './ShellCreateMenu'

const ACTION_POOL: ShellCreateAction[] = [
  { id: 'subscription', label: 'New contract', icon: <RepeatIcon className="size-4" /> },
  { id: 'customer', label: 'New customer', icon: <UserPlusIcon className="size-4" /> },
  { id: 'invoice', label: 'New invoice', icon: <ReceiptIcon className="size-4" /> },
  { id: 'payment', label: 'Record a payment', icon: <CreditCardIcon className="size-4" /> },
  { id: 'plan', label: 'New plan', icon: <PackageIcon className="size-4" /> },
]

type PlaygroundArgs = Omit<ComponentProps<typeof ShellCreateMenu>, 'actions'> & {
  actionCount: number
  groupBreak: boolean
}

const meta = {
  title: 'Building blocks/Shell/ShellCreateMenu',
  component: ShellCreateMenu,
  parameters: {
    a11y: {
      // Base UI's portal focus guards: see AppShell.stories.tsx.
      config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] },
    },
  },
  args: {
    actions: [
      { id: 'subscription', label: 'New contract', icon: <RepeatIcon className="size-4" /> },
      { id: 'customer', label: 'New customer', icon: <UserPlusIcon className="size-4" /> },
      { id: 'invoice', label: 'New invoice', icon: <ReceiptIcon className="size-4" /> },
      { id: 'payment', label: 'Record a payment', icon: <CreditCardIcon className="size-4" /> },
    ],
    onCreate: fn(),
  },
  argTypes: {
    label: { control: 'text', description: 'The trigger button text.' },
    actions: { control: false },
    onCreate: { control: false },
  },
} satisfies Meta<typeof ShellCreateMenu>

export default meta
type Story = StoryObj<typeof meta>

/** Take 0 to 5 flows, relabel the button, and split the menu before the last flow. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: { label: 'Create', actionCount: 3, groupBreak: true, onCreate: fn() },
  argTypes: {
    actionCount: {
      control: { type: 'range', min: 0, max: 5, step: 1 },
      description: '0 renders no button at all.',
    },
    groupBreak: { control: 'boolean', description: 'Starts a new group at the last flow.' },
    onCreate: { control: false },
  },
  render: ({ actionCount, groupBreak, ...args }) => (
    <ShellCreateMenu
      {...args}
      actions={ACTION_POOL.slice(0, actionCount).map((action, i, all) => ({
        ...action,
        ...(groupBreak && i === all.length - 1 && i > 0 ? { startsGroup: true } : {}),
      }))}
    />
  ),
}

export const Default: Story = {}

export const ListsTheFlows: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /create/i }))

    const items = await screen.findAllByRole('menuitem')
    await expect(items.map((item) => item.textContent)).toEqual([
      'New contract',
      'New customer',
      'New invoice',
      'Record a payment',
    ])
    // One flat list: no rule between the flows.
    await expect(screen.queryByRole('separator')).not.toBeInTheDocument()
  },
}

/** Choosing a flow reports which one. Where that goes is the caller's decision. */
export const ReportsTheChoice: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /create/i }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'New contract' }))
    await expect(args.onCreate).toHaveBeenCalledWith('subscription')
  },
}

/**
 * Nothing to create means no button.
 *
 * A Create button that opens an empty menu is worse than its absence: it costs
 * a click to learn there was nothing behind it.
 */
export const NothingToCreate: Story = {
  args: { actions: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).not.toBeInTheDocument()
  },
}
