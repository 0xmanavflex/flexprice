import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import { SidebarProvider } from '@ui/primitives/sidebar'
import { ShellAccount } from './ShellAccount'

/**
 * The footer identity: who am I signed in as, and how do I leave. Sits inside
 * the sidebar, so it is mounted in a `SidebarProvider` here.
 */
const meta = {
  title: 'Foundation/Compositions/Shell/ShellAccount',
  component: ShellAccount,
  decorators: [
    (Story) => (
      <SidebarProvider className="block h-auto w-64 p-2">
        <Story />
      </SidebarProvider>
    ),
  ],
  parameters: {
    // Base UI's portal focus guards on the dropdown. See AppShell.stories.tsx.
    a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } },
  },
  args: {
    user: { name: 'Dinesh K', email: 'dinesh@flexprice.io', organization: 'Flexprice' },
    onProfile: fn(),
    onSettings: fn(),
    onSignOut: fn(),
  },
} satisfies Meta<typeof ShellAccount>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** Signing out is how someone leaves, so it is reachable in one click. */
export const SignsOut: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /account: dinesh k/i }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sign out' }))
    await expect(args.onSignOut).toHaveBeenCalledOnce()
  },
}

/**
 * Without an organization the second line falls back to the email.
 *
 * The two lines answer different questions — who am I, and whose data am I
 * looking at — and the org line is the one people forget.
 */
export const WithoutOrganization: Story = {
  args: { user: { name: 'Dinesh K', email: 'dinesh@flexprice.io' } },
}
