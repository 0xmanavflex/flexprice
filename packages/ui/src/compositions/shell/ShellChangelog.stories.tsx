import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, screen, userEvent, waitFor, within } from 'storybook/test'
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

const VIDEO_ENTRY: ShellChangelogEntry = {
  ...(ENTRIES[0] as ShellChangelogEntry),
  id: 'console-walkthrough',
  summary: 'Watch the 90-second walkthrough of what moved and what is new.',
  href: 'https://www.loom.com/share/demo',
  video: 'about:blank',
  duration: '1:29',
  announcement: {
    eyebrow: 'Product update',
    title: 'Meet your new Flexprice Console',
    description: 'Explore the redesigned experience for managing customers and billing.',
  },
}

/**
 * A card with a video: its picture is the play button. The dialog announces it, shows a still
 * with one play button, loads the player only when pressed, and links out to the video.
 */
export const PlaysAVideo: Story = {
  args: { entries: [VIDEO_ENTRY, ...ENTRIES.slice(1)] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('link', { name: /Read more/ })).toBeNull()
    await expect(canvas.getByText('1:29')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Watch: A new console' }))
    const dialog = within(
      await screen.findByRole('dialog', { name: 'Meet your new Flexprice Console' }),
    )
    await expect(dialog.getByText('Product update')).toBeVisible()
    // No player until asked for: a clean still with one play button.
    await expect(dialog.queryByTitle('Meet your new Flexprice Console')).toBeNull()
    await userEvent.click(dialog.getByRole('button', { name: /^Play:/ }))
    await expect(dialog.getByTitle('Meet your new Flexprice Console')).toHaveAttribute(
      'src',
      expect.stringContaining('autoplay=1'),
    )
    await expect(dialog.getByRole('link', { name: /Open in new tab/ })).toHaveAttribute(
      'href',
      'https://www.loom.com/share/demo',
    )
    await userEvent.keyboard('{Escape}')
  },
}

/** An announcement opens by itself the first time the stack shows, and only once. */
export const AnnouncesOnce: Story = {
  args: {
    entries: [{ ...VIDEO_ENTRY, autoOpen: true }, ...ENTRIES.slice(1)],
    storageKey: 'story.changelog.announce',
  },
  beforeEach: () => {
    localStorage.removeItem('story.changelog.announce')
    localStorage.removeItem('story.changelog.announce.played')
  },
  play: async () => {
    await expect(
      await screen.findByRole('dialog', { name: 'Meet your new Flexprice Console' }),
    ).toBeVisible()
    await expect(
      JSON.parse(localStorage.getItem('story.changelog.announce.played') ?? '[]'),
    ).toEqual(['console-walkthrough'])
    await userEvent.keyboard('{Escape}')
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
