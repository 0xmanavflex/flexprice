import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import { SidebarProvider } from '@ui/primitives/sidebar'
import { EnvironmentSwitcher } from './EnvironmentSwitcher'
import type { ShellEnvironment } from './types'

/**
 * The switcher, at the sizes it actually has to work at.
 *
 * Two environments is the tenant on day one; eight is the tenant the list was
 * designed for, and is where grouping stops being decoration. Past a dozen this
 * becomes a command palette — see the note on the component.
 */
const two: ShellEnvironment[] = [
  { id: 'prod', name: 'Production', kind: 'production' },
  { id: 'dev', name: 'Sandbox', kind: 'sandbox' },
]

const eight: ShellEnvironment[] = [
  { id: 'prod-us', name: 'Production · US', kind: 'production' },
  { id: 'prod-eu', name: 'Production · EU', kind: 'production' },
  { id: 'staging', name: 'Staging', kind: 'sandbox' },
  { id: 'dev', name: 'Sandbox', kind: 'sandbox' },
  { id: 'qa', name: 'QA', kind: 'sandbox' },
  { id: 'demo', name: 'Demos', kind: 'sandbox' },
  { id: 'migration', name: 'Migration rehearsal', kind: 'sandbox' },
  { id: 'scratch', name: 'Scratch', kind: 'sandbox' },
]

const meta = {
  title: 'Foundation/Compositions/EnvironmentSwitcher',
  component: EnvironmentSwitcher,
  decorators: [
    (Story) => (
      <SidebarProvider className="block h-auto w-64 p-2">
        <Story />
      </SidebarProvider>
    ),
  ],
  parameters: {
    a11y: {
      config: {
        rules: [
          // Base UI's portal focus guards — see AppShell.stories.tsx.
          { id: 'aria-hidden-focus', enabled: false },
          // The environment list scrolls once it is long. axe wants a scrollable
          // region to be tabbable or to hold tabbable content; a menu holds
          // neither, because it is driven by arrow keys — Base UI moves focus
          // between the menuitems and scrolls the focused one into view. The
          // region is reachable by keyboard, just not by Tab, so the rule is a
          // false positive for a menu list.
          { id: 'scrollable-region-focusable', enabled: false },
        ],
      },
    },
  },
  args: {
    current: two[1]!,
    environments: two,
    onChange: fn(),
  },
} satisfies Meta<typeof EnvironmentSwitcher>

export default meta
type Story = StoryObj<typeof meta>

export const Sandbox: Story = {}

/**
 * Production is marked, and not only by colour.
 *
 * Editing a live plan must not look identical to editing a sandbox one, and
 * the marker has to survive someone who cannot distinguish the colour.
 */
export const Production: Story = {
  args: { current: two[0]! },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Live')).toBeVisible()
    await expect(
      canvas.getByRole('button', { name: /environment: production, production/i }),
    ).toBeInTheDocument()
  },
}

/**
 * The breadcrumb variant: the compact trigger that leads the header's trail.
 *
 * Same menu and the same marks as the sidebar row — production keeps its dot
 * and its "Live" badge — but sized to sit inline beside a chevron rather than
 * to fill a sidebar row. This is the switcher's home now that it has left the
 * sidebar.
 */
export const InBreadcrumb: Story = {
  args: { current: two[0]!, variant: 'breadcrumb', onCreate: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Live')).toBeVisible()

    await userEvent.click(
      canvas.getByRole('button', { name: /environment: production, production/i }),
    )
    // The same grouped menu opens, with its management action. `waitFor` so the
    // visibility check retries while the menu animates open rather than racing it.
    await waitFor(() =>
      expect(screen.getByRole('menuitem', { name: 'New environment' })).toBeVisible(),
    )
  },
}

/**
 * One flat list, production first, with a tick on the current one — and, at
 * eight, past the ~three rows the menu shows, so the list scrolls inside its
 * cap rather than running off the screen. No section headings: the mark on each
 * row already says which kind it is.
 */
export const EightEnvironments: Story = {
  args: { current: eight[3]!, environments: eight },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: /change environment/i }),
    )

    const items = await screen.findAllByRole('menuitem')
    await expect(items.map((item) => item.textContent)).toEqual([
      'Production · US',
      'Production · EU',
      'Staging',
      'Sandbox',
      'QA',
      'Demos',
      'Migration rehearsal',
      'Scratch',
    ])

    // The current one is marked for assistive tech, not only with a glyph.
    await expect(screen.getByRole('menuitem', { name: 'Sandbox' })).toHaveAttribute(
      'aria-current',
      'true',
    )
  },
}

export const ReportsTheChoice: Story = {
  args: { environments: eight, current: eight[3]! },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: /change environment/i }),
    )
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Production · EU' }))
    await expect(args.onChange).toHaveBeenCalledWith('prod-eu')
  },
}

/** The two management actions, below a rule. */
export const WithManagementActions: Story = {
  args: { onCreate: fn(), onManage: fn() },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: /change environment/i }),
    )
    await userEvent.click(await screen.findByRole('menuitem', { name: 'New environment' }))
    await expect(args.onCreate).toHaveBeenCalled()
  },
}

/**
 * A long list does not bury create.
 *
 * The environments scroll inside their cap; create and manage sit below that
 * scroll area, so "New environment" is reachable without scrolling to the end of
 * eight environments first — the whole point of pinning them.
 */
export const ManyWithPinnedActions: Story = {
  args: { environments: eight, current: eight[3]!, onCreate: fn(), onManage: fn() },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: /change environment/i }),
    )
    // Both the last environment and the pinned create action are present at once.
    await expect(await screen.findByRole('menuitem', { name: 'Scratch' })).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('menuitem', { name: 'New environment' }))
    await expect(args.onCreate).toHaveBeenCalled()
  },
}

/**
 * Without a handler there is no menu item.
 *
 * A "New environment" that opens nothing is worse than its absence: it costs a
 * click to learn the product cannot do the thing it just offered.
 */
export const NoManagementActions: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: /change environment/i }),
    )
    await screen.findByRole('menuitem', { name: 'Sandbox' })
    await expect(screen.queryByRole('menuitem', { name: 'New environment' })).not.toBeInTheDocument()
  },
}
