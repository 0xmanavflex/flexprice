import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import {
  type AnalyticsQuery,
  CustomerAnalyticsView,
  DEMO_FEATURE_ANALYTICS,
  type FeatureAnalytics,
} from './CustomerAnalyticsView'

const NAMES = [
  ['API Calls', 'calls'],
  ['AI Tokens', 'tokens'],
  ['Video Minutes', 'minutes'],
  ['Compute Minutes', 'minutes'],
  ['Storage Writes', 'GB'],
  ['Image Generations', 'images'],
  ['Email Sends', 'emails'],
  ['Seats', 'seats'],
] as const

/** Deterministic features: the same count always gives the same breakdown. */
function makeFeatures(count: number): FeatureAnalytics[] {
  return Array.from({ length: count }, (_, i) => {
    const [name, unit] = NAMES[i % NAMES.length] ?? NAMES[0]
    const thousands = 80 + i * 83
    const revenue = 240 + ((i * 397) % 1600)
    return {
      id: `f${i + 1}`,
      name: i >= NAMES.length ? `${name} ${Math.floor(i / NAMES.length) + 1}` : name,
      usage: `${thousands},000`,
      short: `${thousands}K`,
      unit,
      revenue,
      cost: Math.round(revenue * (0.35 + ((i * 7) % 40) / 100) * 100) / 100,
    }
  })
}

const meta = {
  title: 'App/Customers/Customer analytics',
  component: CustomerAnalyticsView,
  parameters: { layout: 'padded' },
  args: { features: DEMO_FEATURE_ANALYTICS },
} satisfies Meta<typeof CustomerAnalyticsView>

export default meta
type Story = StoryObj<typeof meta>

/** Holds the date range and children switch so the toolbar works while `query` is driven from outside. */
function Controlled({
  features,
  initial,
}: {
  features: FeatureAnalytics[]
  initial: AnalyticsQuery
}) {
  const [query, setQuery] = useState(initial)
  return <CustomerAnalyticsView features={features} query={query} onQueryChange={setQuery} />
}

interface PlaygroundArgs {
  features: number
  from: string
  to: string
  includeChildren: boolean
}

/** Drag features from 0 to 12; the chart tabs and breakdown table follow. Edit the range from the dates. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: { features: 4, from: '2026-09-01', to: '2026-09-30', includeChildren: false },
  argTypes: {
    features: { control: { type: 'range', min: 0, max: 12, step: 1 } },
    from: { control: 'text', description: 'ISO date, YYYY-MM-DD.' },
    to: { control: 'text', description: 'ISO date, YYYY-MM-DD.' },
    includeChildren: { control: 'boolean' },
  },
  render: ({ features, from, to, includeChildren }) => (
    <Controlled
      key={`${from}|${to}|${includeChildren}`}
      features={makeFeatures(features)}
      initial={{ from, to, includeChildren }}
    />
  ),
}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Features' })).toBeInTheDocument()
    await expect(canvas.getByText('Margin %')).toBeInTheDocument()
  },
}

/** No metered features: the totals are zero and there is no chart. */
export const NoFeatures: Story = { args: { features: [] } }

export const SingleFeature: Story = { args: { features: makeFeatures(1) } }

export const ManyFeatures: Story = { args: { features: makeFeatures(10) } }

/** A caller-owned query, including the children switch turned on. */
export const IncludingChildren: Story = {
  args: {
    query: { from: '2026-08-01', to: '2026-08-31', includeChildren: true },
    onQueryChange: fn(),
  },
}
