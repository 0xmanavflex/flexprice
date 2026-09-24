import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
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
      // Base UI's portal focus guards — see AppShell.stories.tsx.
      config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] },
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

/** Grouped by kind, production first, with a tick on the current one. */
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
