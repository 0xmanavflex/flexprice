import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { FitToWindow } from './FitToWindow'

const meta = {
  title: 'Foundation/Compositions/FitToWindow',
  component: FitToWindow,
  args: { pressed: false, onPressedChange: fn() },
} satisfies Meta<typeof FitToWindow>

export default meta
type Story = StoryObj<typeof meta>

export const Off: Story = {}
export const On: Story = { args: { pressed: true } }

/**
 * It is a toggle, so its state is `aria-pressed` rather than a changing label.
 *
 * A control whose name changes with its state is two controls as far as
 * anything reading the page is concerned.
 */
export const StateIsPressedNotLabel: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole('button', { name: 'Fit to window' })
    await expect(button).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(button)
    await expect(args.onPressedChange).toHaveBeenCalledWith(true)
    // The name did not change — only the state would have.
    await expect(canvas.getByRole('button', { name: 'Fit to window' })).toBeInTheDocument()
  },
}
