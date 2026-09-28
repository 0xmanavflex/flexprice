import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Button } from '@ui/primitives/button'
import { ThemeProvider } from './ThemeProvider'

/**
 * Theming, wrapped so the app never names the library. It is a context
 * provider with no visual output of its own, so this renders a small themed
 * sample as its children to show it mounts and its tokens resolve.
 */
const meta = {
  title: 'Foundation/Compositions/Shell/ThemeProvider',
  component: ThemeProvider,
  parameters: { layout: 'padded' },
  args: {
    children: (
      <div className="bg-background text-foreground flex flex-col items-start gap-3 rounded-lg border p-4">
        <p className="text-muted-foreground text-sm">A sample surface using the theme tokens.</p>
        <Button>Save changes</Button>
      </div>
    ),
  },
} satisfies Meta<typeof ThemeProvider>

export default meta
type Story = StoryObj<typeof meta>

/** A smoke test: the provider mounts and renders its children. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Save changes' })).toBeVisible()
  },
}
