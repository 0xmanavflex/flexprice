import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { AppFailure } from './AppFailure'

const meta = {
  title: 'Foundation/Compositions/AppFailure',
  component: AppFailure,
  parameters: { layout: 'fullscreen' },
  args: { title: 'Something went wrong' },
  argTypes: {
    title: { control: 'text', description: 'The headline.' },
    detail: { control: 'text', description: 'One line of context under the headline.' },
    fix: { control: 'text', description: 'What the reader can do, shown as a distinct block.' },
    technical: { control: 'text', description: 'The raw error, collapsed under a disclosure.' },
    onRetry: { control: false },
    children: { control: false },
  },
} satisfies Meta<typeof AppFailure>

export default meta
type Story = StoryObj<typeof meta>

/** Every prop as a control: clear `fix` or `technical` to drop those blocks; the Try again button is wired. */
export const Playground: Story = {
  args: {
    title: 'This page could not be loaded',
    detail: 'The error was reported and the rest of the console still works.',
    fix: 'Reload the page, or check that the API URL is reachable.',
    technical: "TypeError: Cannot read properties of undefined (reading 'items')",
    onRetry: fn(),
  },
}

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
