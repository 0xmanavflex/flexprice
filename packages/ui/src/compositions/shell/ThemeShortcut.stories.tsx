import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useTheme } from 'next-themes'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { ThemeProvider } from './ThemeProvider'
import { ThemeShortcut } from './ThemeShortcut'

/** Shows the theme the shortcut is flipping, so the keypress has something to act on. */
function Probe() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return (
    <div className="bg-background text-foreground flex flex-col gap-1 rounded-lg border p-4 text-sm">
      <p>
        Press <kbd className="rounded border px-1 font-mono text-xs">Ctrl</kbd> or{' '}
        <kbd className="rounded border px-1 font-mono text-xs">⌘</kbd> +{' '}
        <kbd className="rounded border px-1 font-mono text-xs">D</kbd> to flip light and dark.
      </p>
      <p className="text-muted-foreground" aria-live="polite">
        Current theme: <span data-testid="theme">{mounted ? resolvedTheme : '…'}</span>
      </p>
    </div>
  )
}

/**
 * Renders nothing: it only listens for ⌘D / Ctrl+D. The component takes no
 * props, so there are no controls; the story is the keypress.
 */
const meta = {
  title: 'Building blocks/Shell/ThemeShortcut',
  component: ThemeShortcut,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
        <Probe />
      </ThemeProvider>
    ),
  ],
} satisfies Meta<typeof ThemeShortcut>

export default meta
type Story = StoryObj<typeof meta>

const isDark = () => document.documentElement.classList.contains('dark')

/** Try it: press Ctrl+D (or ⌘D) with the canvas focused. */
export const Playground: Story = {}

/** Ctrl+D flips the theme and a second press flips it back. */
export const FlipsOnCtrlD: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvas.getByTestId('theme')).not.toHaveTextContent('…'))
    const before = isDark()

    await userEvent.keyboard('{Control>}d{/Control}')
    await waitFor(() => expect(isDark()).toBe(!before))

    await userEvent.keyboard('{Control>}d{/Control}')
    await waitFor(() => expect(isDark()).toBe(before))
  },
}

/** Extra modifiers are left to the browser: Ctrl+Shift+D does nothing here. */
export const IgnoresShiftedChord: Story = {
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(within(canvasElement).getByTestId('theme')).not.toHaveTextContent('…'),
    )
    const before = isDark()
    await userEvent.keyboard('{Control>}{Shift>}d{/Shift}{/Control}')
    await expect(isDark()).toBe(before)
  },
}

/** A bare D is just a letter, so typing in a field never flips the theme. */
export const IgnoresPlainD: Story = {
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(within(canvasElement).getByTestId('theme')).not.toHaveTextContent('…'),
    )
    const before = isDark()
    await userEvent.keyboard('d')
    await expect(isDark()).toBe(before)
  },
}
