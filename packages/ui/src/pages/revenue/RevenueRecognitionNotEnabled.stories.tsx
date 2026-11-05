import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { RevenueRecognitionNotEnabled } from './RevenueRecognitionNotEnabled'

const meta = {
  title: 'App/Revenue/Revenue recognition not enabled',
  component: RevenueRecognitionNotEnabled,
  args: { onContact: fn() },
} satisfies Meta<typeof RevenueRecognitionNotEnabled>

export default meta
type Story = StoryObj<typeof meta>

/** Off for the environment: what it does, and one outline way to ask for it. */
export const NotEnabled: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("Revenue recognition isn't enabled yet")).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Contact us to enable it' }))
    await expect(args.onContact).toHaveBeenCalledOnce()
  },
}

/** A deployment with no contact options: the message stands alone, with no dead button. */
export const WithoutContact: Story = {
  render: () => <RevenueRecognitionNotEnabled />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("Revenue recognition isn't enabled yet")).toBeVisible()
    await expect(canvas.queryByRole('button')).toBeNull()
  },
}
