import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { ShellChangelog, type ShellChangelogEntry } from './ShellChangelog'
import { DOCS } from '@fp/domain'

/** The "What's new" stack at the foot of the sidebar, at the width it renders there. */
const ENTRIES: ShellChangelogEntry[] = [
  {
    id: 'console-v2',
    title: 'A new console',
    summary: 'Search every record with ⌘K, and switch environments from the breadcrumb.',
    href: DOCS.home,
    scene: 'home',
  },
  {
    id: 'contracts',
    title: 'Subscriptions are now contracts',
    summary: 'Charges split into Current, Upcoming and History, and a contract can have a parent.',
    href: DOCS.subscriptionCreate,
    scene: 'contracts',
  },
  {
    id: 'addons',
    title: 'Add-ons work like plans',
    summary: 'Charges, entitlements and credit grants together on one Overview.',
    href: DOCS.addons,
    scene: 'catalog',
  },
]

const meta = {
  title: 'Building blocks/Shell/ShellChangelog',
  component: ShellChangelog,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-56 pt-10">
        <Story />
      </div>
    ),
  ],
  args: { entries: ENTRIES },
} satisfies Meta<typeof ShellChangelog>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

/** The top card links to its docs; the cards behind it are out of the reading order. */
export const NewestOnTop: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('link', { name: /Read more/ })).toHaveAttribute('href', DOCS.home)
    await expect(canvas.getAllByRole('link', { name: /Read more/ })).toHaveLength(1)
  },
}

/** Dismissing takes the top card off and remembers it under the storage key. */
export const DismissIsRemembered: Story = {
  args: { storageKey: 'storybook.changelog.dismissed' },
  beforeEach: () => {
    localStorage.removeItem('storybook.changelog.dismissed')
    return () => localStorage.removeItem('storybook.changelog.dismissed')
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss' }))
    await waitFor(() =>
      expect(canvas.getByRole('link', { name: /Read more/ })).toHaveAttribute(
        'href',
        DOCS.subscriptionCreate,
      ),
    )
    await expect(JSON.parse(localStorage.getItem('storybook.changelog.dismissed') ?? '[]')).toEqual(
      ['console-v2'],
    )
  },
}

/** Clearing the last card says so, briefly. */
export const AllCaughtUp: Story = {
  args: { entries: ENTRIES.slice(0, 1) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss' }))
    await expect(await canvas.findByText(/all caught up/)).toBeInTheDocument()
  },
}
