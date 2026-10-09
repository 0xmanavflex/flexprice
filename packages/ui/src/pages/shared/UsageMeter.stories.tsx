import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { UsageMeter } from './UsageMeter'

const meta = {
  title: 'Building blocks/Charts & metrics/UsageMeter',
  component: UsageMeter,
  parameters: { layout: 'padded' },
  args: { label: 'API calls', used: 4200, limit: 10000, unit: 'calls', locale: 'en-US' },
  argTypes: {
    label: { control: 'text' },
    used: { control: { type: 'number', min: 0, step: 100 } },
    limit: { control: { type: 'number', min: 0, step: 100 }, description: 'null is unlimited.' },
    unit: { control: 'text' },
    locale: { control: 'select', options: ['en-US', 'en-GB', 'de-DE', 'fr-FR', 'en-IN'] },
  },
} satisfies Meta<typeof UsageMeter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

interface PlaygroundArgs {
  label: string
  used: number
  limit: number
  unlimited: boolean
  unit: string
  locale: string
}

/** Drag used past the limit, set the limit to 0, or tick unlimited to see each state. */
export const Playground = {
  args: {
    label: 'API calls',
    used: 4200,
    limit: 10000,
    unlimited: false,
    unit: 'calls',
    locale: 'en-US',
  },
  argTypes: {
    label: { control: 'text' },
    used: { control: { type: 'number', min: 0, step: 100 } },
    limit: { control: { type: 'number', min: 0, step: 100 } },
    unlimited: { control: 'boolean', description: 'Sets limit to null.' },
    unit: { control: 'text' },
    locale: { control: 'select', options: ['en-US', 'en-GB', 'de-DE', 'fr-FR', 'en-IN'] },
  },
  parameters: { controls: { include: ['label', 'used', 'limit', 'unlimited', 'unit', 'locale'] } },
  render: ({ unlimited, limit, ...rest }) => (
    <UsageMeter {...rest} limit={unlimited ? null : limit} />
  ),
} satisfies StoryObj<PlaygroundArgs>

export const NearLimit: Story = { args: { used: 9600 } }

/** The bar caps; the number does not. */
export const OverLimit: Story = {
  args: { used: 12400, limit: 10000 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('12,400 of 10,000 calls')).toBeInTheDocument()
    await expect(canvas.getByText(/over the included amount by 2,400/i)).toBeInTheDocument()
  },
}

/** Unlimited is not 100%, and not 0% — there is no denominator. */
export const Unlimited: Story = {
  args: { limit: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Unlimited')).toBeInTheDocument()
    await expect(canvas.queryByRole('progressbar')).not.toBeInTheDocument()
  },
}

/** A zero allowance is how a naive implementation renders NaN%. */
export const ZeroAllowance: Story = {
  args: { used: 0, limit: 0 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText(/NaN/)).not.toBeInTheDocument()
  },
}
