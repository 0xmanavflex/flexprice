import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import { ShellNotifications } from './ShellNotifications'
import type { ShellNotification } from './types'

/**
 * Notifications, in each of the four states it can be in.
 *
 * This is the one surface guaranteed to be on screen during an incident, which
 * is exactly why an empty list from a failed request would be a lie: it would
 * assert "all clear" on no evidence.
 */
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

const meta = {
  title: 'Foundation/Compositions/Shell/ShellNotifications',
  component: ShellNotifications,
  parameters: {
    layout: 'padded',
    // The bell opens a Base UI popover; its portal focus guards trip axe. The
    // trigger and panel are both labelled. See AppShell.stories.tsx.
    a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } },
  },
  args: {
    notifications,
    onMarkAllRead: fn(),
    onOpenNotification: fn(),
  },
} satisfies Meta<typeof ShellNotifications>

export default meta
type Story = StoryObj<typeof meta>

/** The unread count is in the trigger's name, not only in a dot. */
export const Unread: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /1 unread/i }))
    await expect(await screen.findByText('Payment failed for Acme Corp')).toBeInTheDocument()
  },
}

/** Nothing waiting: no dot, and the name does not claim a count. */
export const Empty: Story = {
  args: { notifications: [] },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Notifications' }))
    await expect(await screen.findByText('You are all caught up.')).toBeInTheDocument()
  },
}

export const Loading: Story = {
  args: { notifications: [], isLoading: true },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Notifications' }))
    await expect(await screen.findByText('Loading notifications')).toBeInTheDocument()
  },
}

/** A failed request says so, rather than showing zero. */
export const Failed: Story = {
  args: { notifications: [], error: { message: 'The service did not respond.' } },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Notifications' }))
    await expect(await screen.findByRole('alert')).toHaveTextContent(/could not be loaded/i)
  },
}
