import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { AppFailure } from './AppFailure'

const meta = {
  title: 'Foundation/Compositions/AppFailure',
  component: AppFailure,
  parameters: { layout: 'fullscreen' },
  args: { title: 'Something went wrong' },
} satisfies Meta<typeof AppFailure>

export default meta
type Story = StoryObj<typeof meta>

/** The case that caused this component to exist. */
export const Misconfigured: Story = {
  args: {
    title: 'Flexprice is not configured',
    detail: 'VITE_FLEXPRICE_API_URL is not set, and mocks are switched off.',
    fix: 'Copy apps/console/.env.example to .env.local, or set VITE_USE_MOCKS=true.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toBeInTheDocument()
    // The fix is on screen, not in a console nobody opened.
    await expect(canvas.getByText(/\.env\.local/)).toBeInTheDocument()
  },
}

export const Crashed: Story = {
  args: {
    title: 'This page could not be loaded',
    detail: 'The error was reported and the rest of the console still works.',
    onRetry: fn(),
    technical: "TypeError: Cannot read properties of undefined (reading 'items')",
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}

/** Technical detail is available but never the headline. */
export const TechnicalDetailIsCollapsed: Story = {
  args: { title: 'This page could not be loaded', technical: 'ReferenceError: x is not defined' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText(/ReferenceError/)).not.toBeVisible()
    await userEvent.click(canvas.getByText('Technical detail'))
    await expect(canvas.getByText(/ReferenceError/)).toBeVisible()
  },
}
