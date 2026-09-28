import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Badge } from '@ui/components/reui/badge'
import { Button } from '@ui/primitives/button'
import { DetailShell } from './DetailShell'

/**
 * The shared opening of every detail page: a large title with badges and an
 * identifier, an actions cluster, a metric rail, and the body.
 */
const meta = {
  title: 'Foundation/Compositions/DetailShell',
  component: DetailShell,
  parameters: { layout: 'fullscreen' },
  args: {
    title: 'Scale',
    identifier: 'plan_scale_monthly',
    description: 'Usage-based plan for growing teams.',
    badges: <Badge variant="success-light">Published</Badge>,
    actions: <Button variant="outline">Edit</Button>,
    metrics: [
      { label: 'Active subscriptions', value: '128', hint: '+12 this month', sentiment: 'positive' },
      { label: 'Starts at', value: '$29', hint: 'per month' },
      { label: 'Charges', value: '3' },
      { label: 'Currency', value: 'USD' },
    ],
    children: <p className="text-sm text-muted-foreground">The tabbed body goes here.</p>,
  },
} satisfies Meta<typeof DetailShell>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** No metrics: the rail is omitted, not rendered empty. */
export const WithoutMetrics: Story = {
  args: { metrics: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1, name: 'Scale' })).toBeInTheDocument()
    await expect(canvas.queryByText('Active subscriptions')).not.toBeInTheDocument()
  },
}
