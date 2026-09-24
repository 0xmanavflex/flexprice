import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import { ReceiptIcon, RepeatIcon, UserPlusIcon } from 'lucide-react'
import { ShellCreateMenu } from './ShellCreateMenu'

const meta = {
  title: 'Foundation/Compositions/ShellCreateMenu',
  component: ShellCreateMenu,
  parameters: {
    a11y: {
      // Base UI's portal focus guards — see AppShell.stories.tsx.
      config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] },
    },
  },
  args: {
    actions: [
      { id: 'subscription', label: 'New subscription', icon: <RepeatIcon className="size-4" /> },
      { id: 'customer', label: 'New customer', icon: <UserPlusIcon className="size-4" /> },
      {
        id: 'invoice',
        label: 'New invoice',
        icon: <ReceiptIcon className="size-4" />,
        startsGroup: true,
      },
    ],
    onCreate: fn(),
  },
} satisfies Meta<typeof ShellCreateMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const ListsTheFlows: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /create/i }))

    const items = await screen.findAllByRole('menuitem')
    await expect(items.map((item) => item.textContent)).toEqual([
      'New subscription',
      'New customer',
      'New invoice',
    ])
  },
}

/** Choosing a flow reports which one. Where that goes is the caller's decision. */
export const ReportsTheChoice: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /create/i }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'New subscription' }))
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
