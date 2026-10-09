import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { ThemeProvider } from './ThemeProvider'
import { ThemeToggle } from './ThemeToggle'

const meta = {
  title: 'Building blocks/Shell/ThemeToggle',
  component: ThemeToggle,
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
} satisfies Meta<typeof ThemeToggle>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/**
 * One control, two states.
 *
 * The name is "Dark mode" in both, because the control is the preference and
 * whether it is on is state. A button whose label flips between "Dark" and
 * "Light" reads as two different controls.
 */
export const TogglesTheDocumentClass: Story = {
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Dark mode' })

    await userEvent.click(button)
    await expect(document.documentElement).toHaveClass('dark')

    await userEvent.click(button)
    await expect(document.documentElement).not.toHaveClass('dark')
  },
}
