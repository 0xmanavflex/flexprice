import { useEffect, useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import { SidebarProvider } from '@ui/components/primitives/sidebar'
import { EnvironmentSwitcher } from './EnvironmentSwitcher'
import type { ShellEnvironment } from './types'

/**
 * The switcher, at the sizes it actually has to work at.
 *
 * Two environments is the tenant on day one; eight is the tenant the list was
 * designed for, and is where grouping stops being decoration. Past a dozen this
 * becomes a command palette: see the note on the component.
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

type PlaygroundArgs = Omit<
  ComponentProps<typeof EnvironmentSwitcher>,
  'current' | 'environments' | 'onCreate' | 'onRename' | 'onDelete'
> & {
  environmentCount: number
  currentId: string
  showCreate: boolean
  showRename: boolean
  showDelete: boolean
  onCreate: () => void
  onRename: (id: string) => void
  onDelete: (id: string) => void
}

function LiveSwitcher({
  environmentCount,
  currentId,
  showCreate,
  showRename,
  showDelete,
  onCreate,
  onRename,
  onDelete,
  onChange,
}: PlaygroundArgs) {
  const environments = eight.slice(0, environmentCount)
  const [id, setId] = useState(currentId)
  // Follow the `currentId` control; picking from the menu still switches in between.
  useEffect(() => setId(currentId), [currentId])
  const current = environments.find((e) => e.id === id) ?? environments[0] ?? eight[0]!
  return (
    <EnvironmentSwitcher
      current={current}
      environments={environments}
      onChange={(next) => {
        setId(next)
        onChange(next)
      }}
      {...(showCreate ? { onCreate } : {})}
      {...(showRename ? { onRename } : {})}
      {...(showDelete ? { onDelete } : {})}
    />
  )
}

const meta = {
  title: 'Building blocks/Shell/EnvironmentSwitcher',
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
          // Base UI's portal focus guards: see AppShell.stories.tsx.
          { id: 'aria-hidden-focus', enabled: false },
          // The environment list scrolls once it is long. axe wants a scrollable
          // region to be tabbable or to hold tabbable content; a menu holds
          // neither, because it is driven by arrow keys: Base UI moves focus
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
  argTypes: {
    current: { control: 'object' },
    environments: { control: 'object', description: 'id, name and kind (production or sandbox).' },
    onChange: { control: false },
    onCreate: { control: false },
    onRename: { control: false },
    onDelete: { control: false },
  },
} satisfies Meta<typeof EnvironmentSwitcher>

export default meta
type Story = StoryObj<typeof meta>

/** A sandbox is marked yellow: the warning token. */
export const Sandbox: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('.bg-warning')).not.toBeNull()
  },
}

/** Grow the list from 1 to 8 environments, pick the current one, and toggle create and the row actions. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    environmentCount: 4,
    currentId: 'dev',
    showCreate: true,
    showRename: true,
    showDelete: true,
    onChange: fn(),
    onCreate: fn(),
    onRename: fn(),
    onDelete: fn(),
  },
  argTypes: {
    environmentCount: { control: { type: 'range', min: 1, max: 8, step: 1 } },
    currentId: { control: 'select', options: eight.map((e) => e.id) },
    showCreate: { control: 'boolean', description: 'Off omits `onCreate`, so no menu item.' },
    showRename: { control: 'boolean', description: 'Off omits `onRename`, so no pencil on rows.' },
    showDelete: { control: 'boolean', description: 'Off omits `onDelete`, so no delete on rows.' },
    onCreate: { control: false },
    onRename: { control: false },
    onDelete: { control: false },
  },
  render: (args) => <LiveSwitcher {...args} />,
}

/**
 * Production is marked green and a sandbox yellow: and not only by colour.
 *
 * Editing a live plan must not look identical to editing a sandbox one, and
 * the marker has to survive someone who cannot distinguish the colour.
 */
export const Production: Story = {
  args: { current: two[0]! },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Production')).toBeVisible()
    await expect(
      canvas.getByRole('button', { name: /environment: production, production/i }),
    ).toBeInTheDocument()
    // Green for production: the success token, never the destructive one.
    await expect(canvasElement.querySelector('.bg-success')).not.toBeNull()
    await expect(canvasElement.querySelector('.bg-destructive')).toBeNull()
  },
}

/**
 * Under mocks, the menu also lists the self-billing account states to preview,
 * as the prototype's switcher does; the current one is ticked.
 */
export const MockAccounts: Story = {
  args: {
    current: two[1]!,
    mockAccounts: {
      value: 'trial',
      options: [
        { value: 'trial', name: 'Trial', note: '15 days left', tone: 'info' },
        {
          value: 'limit',
          name: 'Account locked',
          note: 'Event limit reached',
          tone: 'destructive',
        },
        { value: 'active', name: 'Live', note: 'Paid', tone: 'success' },
      ],
      onChange: fn(),
    },
  },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /environment:/i }))
    await expect(await screen.findByText('Mock accounts')).toBeVisible()
    await expect(screen.getByRole('menuitem', { name: /^Trial/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
    await userEvent.click(screen.getByRole('menuitem', { name: /Account locked/ }))
    await expect(args.mockAccounts!.onChange).toHaveBeenCalledWith('limit')
  },
}

/**
 * The switcher is the first crumb of the header's trail: the environment's
 * name beside its mark, opening a menu with the create action.
 */
export const InBreadcrumb: Story = {
  args: { current: two[0]!, onCreate: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Production')).toBeVisible()

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
 * One flat list, production first, with a tick on the current one: and, at
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

/**
 * Environments are managed from here: "New environment" below a rule, and
 * no "Manage environments" link out to Settings.
 */
export const WithManagementActions: Story = {
  args: { onCreate: fn(), onRename: fn(), onDelete: fn() },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: /change environment/i }),
    )
    await expect(
      await screen.findByRole('menuitem', { name: 'New environment' }),
    ).toBeInTheDocument()
    await expect(
      screen.queryByRole('menuitem', { name: /manage environments/i }),
    ).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('menuitem', { name: 'New environment' }))
    await expect(args.onCreate).toHaveBeenCalled()
  },
}

/**
 * The pencil on a row renames that environment, and does not switch to it.
 *
 * It is a sibling menu item, not a button nested in the row, so choosing it
 * reports a rename and never a change.
 */
export const RenamesFromTheRow: Story = {
  args: { current: two[1]!, onRename: fn(), onDelete: fn() },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: /change environment/i }),
    )
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Rename Production' }))
    await expect(args.onRename).toHaveBeenCalledWith('prod')
    await expect(args.onChange).not.toHaveBeenCalled()
  },
}

/**
 * Delete is offered on the other rows, never on the current one: deleting the
 * environment you are standing in would leave the console pointed at nothing.
 */
export const DeletesFromTheRow: Story = {
  args: { current: two[1]!, onRename: fn(), onDelete: fn() },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: /change environment/i }),
    )
    await expect(
      await screen.findByRole('menuitem', { name: 'Rename Sandbox' }),
    ).toBeInTheDocument()
    await expect(screen.queryByRole('menuitem', { name: 'Delete Sandbox' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete Production' }))
    await expect(args.onDelete).toHaveBeenCalledWith('prod')
    await expect(args.onChange).not.toHaveBeenCalled()
  },
}

/**
 * A long list does not bury create.
 *
 * The environments scroll inside their cap; create sits below that scroll
 * area, so "New environment" is reachable without scrolling to the end of
 * eight environments first: the whole point of pinning it.
 */
export const ManyWithPinnedActions: Story = {
  args: { environments: eight, current: eight[3]!, onCreate: fn(), onRename: fn() },
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
 * click to learn the product cannot do the thing it just offered. The same
 * holds for the row actions.
 */
export const NoManagementActions: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: /change environment/i }),
    )
    await screen.findByRole('menuitem', { name: 'Sandbox' })
    await expect(
      screen.queryByRole('menuitem', { name: 'New environment' }),
    ).not.toBeInTheDocument()
    await expect(screen.queryByRole('menuitem', { name: /^rename/i })).not.toBeInTheDocument()
    await expect(screen.queryByRole('menuitem', { name: /^delete/i })).not.toBeInTheDocument()
  },
}
