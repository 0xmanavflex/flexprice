import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { SidebarProvider } from '@ui/components/primitives/sidebar'
import { ShellRailHandle } from './ShellRailHandle'

/**
 * The collapse handle on the seam between the sidebar and the page — the one
 * people find without being told, because it is on the boundary it moves. It
 * reads the sidebar state, so it is mounted in a `SidebarProvider`.
 */
const meta = {
  title: 'Foundation/Compositions/Shell/ShellRailHandle',
  component: ShellRailHandle,
  decorators: [
    (Story) => (
      <SidebarProvider className="block h-96 w-64 p-2">
        <Story />
      </SidebarProvider>
    ),
  ],
} satisfies Meta<typeof ShellRailHandle>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/**
 * It is a toggle, so its state is in the name rather than a changing glyph:
 * "Collapse" when open, "Expand" when collapsed.
 */
export const TogglesTheSidebar: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const handle = canvas.getByRole('button', { name: 'Collapse sidebar' })
    await expect(handle).toHaveAttribute('aria-expanded', 'true')

    await userEvent.click(handle)
    await expect(await canvas.findByRole('button', { name: 'Expand sidebar' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  },
}
