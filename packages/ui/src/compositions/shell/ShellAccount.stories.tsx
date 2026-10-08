import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import { SidebarProvider } from '@ui/components/primitives/sidebar'
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
    onDocs: fn(),
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
 * Documentation lives here, beside Settings.
 */
export const OffersDocumentation: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /account: dinesh k/i }))
    // `waitFor` so the visibility check retries while the menu animates open.
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Settings' })).toBeVisible())
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Documentation' }))
    await expect(args.onDocs).toHaveBeenCalledOnce()
  },
}

/**
 * Without an organization the menu has no organisation heading.
 *
 * The trigger's two lines are the name and the email either way.
 */
export const WithoutOrganization: Story = {
  args: { user: { name: 'Dinesh K', email: 'dinesh@flexprice.io' } },
}

/**
 * No name on file, so the display name *is* the email.
 *
 * When the name is the email, the trigger prints it once, not twice (which had
 * read as a bug in the account rather than a gap in the profile).
 */
export const NameIsTheEmail: Story = {
  args: { user: { name: 'dkinsh123@gmail.com', email: 'dkinsh123@gmail.com' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByText('dkinsh123@gmail.com')).toHaveLength(1)
  },
}
