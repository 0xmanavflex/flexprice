import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { ShellStrip } from './ShellStrip'

/** The strip under the shell's top bar that links back to the old console. */
const meta = {
  title: 'Building blocks/Shell/ShellStrip',
  component: ShellStrip,
  parameters: { layout: 'fullscreen' },
  args: {
    message: 'You are on the new Flexprice console.',
    actionLabel: 'Go back to old UI',
    href: 'https://admin.flexprice.io',
  },
} satisfies Meta<typeof ShellStrip>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole('link', { name: /Go back to old UI/ })
    await expect(link).toHaveAttribute('href', 'https://admin.flexprice.io')
    await expect(link).toHaveAttribute('target', '_blank')
  },
}
