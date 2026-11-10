import type { ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import { SidebarProvider } from '@ui/components/primitives/sidebar'
import { ShellAccount } from './ShellAccount'

/**
 * The footer identity: who am I signed in as, and how do I leave. Sits inside
 * the sidebar, so it is mounted in a `SidebarProvider` here.
 */
const meta = {
  title: 'Building blocks/Shell/ShellAccount',
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
  argTypes: {
    user: { control: 'object', description: 'name, email, optional organization and avatarUrl.' },
    onProfile: { control: false },
    onSettings: { control: false },
    onSignOut: { control: false },
  },
} satisfies Meta<typeof ShellAccount>

export default meta
type Story = StoryObj<typeof meta>

type PlaygroundArgs = ComponentProps<typeof ShellAccount> & {
  showProfile: boolean
  showSettings: boolean
  showSignOut: boolean
}

/** Edit the user, and drop any menu item by switching its handler off. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    user: { name: 'Dinesh K', email: 'dinesh@flexprice.io', organization: 'Flexprice' },
    showProfile: true,
    showSettings: true,
    showSignOut: true,
    onProfile: fn(),
    onSettings: fn(),
    onSignOut: fn(),
  },
  argTypes: {
    showProfile: { control: 'boolean' },
    showSettings: { control: 'boolean' },
    showSignOut: { control: 'boolean' },
  },
  render: ({ showProfile, showSettings, showSignOut, onProfile, onSettings, onSignOut, user }) => (
    <ShellAccount
      user={user}
      {...(showProfile && onProfile ? { onProfile } : {})}
      {...(showSettings && onSettings ? { onSettings } : {})}
      {...(showSignOut && onSignOut ? { onSignOut } : {})}
    />
  ),
}

export const Default: Story = {}

/** Signing out is how someone leaves, so it is reachable in one click. */
export const SignsOut: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /account: dinesh k/i }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sign out' }))
    await expect(args.onSignOut).toHaveBeenCalledOnce()
  },
}

/** On a self-hosted deployment the menu offers changing your own password. */
export const ChangesPassword: Story = {
  args: { onChangePassword: fn() },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /account: dinesh k/i }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Change password' }))
    await expect(args.onChangePassword).toHaveBeenCalledOnce()
  },
}

/** Where the deployment has no such action, the item is not drawn. */
export const NoChangePasswordByDefault: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /account: dinesh k/i }))
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Settings' })).toBeVisible())
    await expect(
      screen.queryByRole('menuitem', { name: 'Change password' }),
    ).not.toBeInTheDocument()
  },
}

/**
 * Documentation is not in the account menu: it lives only in the sidebar's
 * pinned footer, so there is one place to find it.
 */
export const OmitsDocumentation: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /account: dinesh k/i }))
    // `waitFor` so the visibility check retries while the menu animates open.
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Settings' })).toBeVisible())
    await expect(screen.queryByRole('menuitem', { name: 'Documentation' })).not.toBeInTheDocument()
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
