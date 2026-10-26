import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import {
  type AnalyticsQuery,
  CustomerAnalyticsView,
  type FeatureAnalytics,
} from './CustomerAnalyticsView'

const days = (values: number[]) => values.map((value, i) => ({ label: `Oct ${i + 1}`, value }))

/** What the page hands the view: already formatted, from the usage and cost analytics. */
const FEATURES: FeatureAnalytics[] = [
  {
    id: 'feat_api',
    name: 'API Calls',
    usage: '120,000',
    short: '120K',
    unit: 'calls',
    revenue: '$240.00',
    share: 0.48,
    cost: '$100.80',
    points: days([3200, 4100, 3900, 4500, 5200, 4800, 3600]),
  },
  {
    id: 'feat_tokens',
    name: 'AI Tokens',
    usage: '203,000',
    short: '203K',
    unit: 'tokens',
    revenue: '$180.00',
    share: 0.36,
    cost: '$90.20',
    points: days([6100, 7400, 6800, 7900, 8800, 8100, 7000]),
  },
  {
    id: 'feat_minutes',
    name: 'Voice Minutes',
    usage: '8,400',
    short: '8.4K',
    unit: 'minutes',
    revenue: '$80.00',
    share: 0.16,
    cost: null,
    points: days([210, 260, 240, 300, 330, 310, 280]),
  },
]

const QUERY: AnalyticsQuery = { from: '2026-10-01', to: '2026-10-22', includeChildren: false }

const meta = {
  title: 'App/Customers/Customer analytics',
  component: CustomerAnalyticsView,
  parameters: { layout: 'padded' },
  args: {
    features: FEATURES,
    totals: { revenue: '$500.00', cost: '$191.00', margin: '$309.00', marginPercent: '61.8%' },
    query: QUERY,
    onQueryChange: fn(),
    featureOptions: FEATURES.map(({ id, name }) => ({ id, name })),
    selectedFeatureIds: [],
    onSelectedFeatureIdsChange: fn(),
  },
} satisfies Meta<typeof CustomerAnalyticsView>

export default meta
type Story = StoryObj<typeof meta>

/** Revenue, cost and margin up top, a tab per feature, and the breakdown below. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('$309.00')).toBeInTheDocument()
    await expect(canvas.getByText('61.8%')).toBeInTheDocument()
    await expect(canvas.getByText('Usage breakdown')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Features' })).toHaveTextContent('All features')
  },
}

/** No cost sheet: cost and margin read "—", never a made-up zero. */
export const WithoutCostSheet: Story = {
  args: {
    totals: { revenue: '$500.00', cost: null, margin: null, marginPercent: null },
    features: FEATURES.map((f) => ({ ...f, cost: null })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByText('—').length).toBeGreaterThanOrEqual(3)
  },
}

/** Narrowing the features hands the page the ids to ask the API for. */
export const NarrowsTheFeatures: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Features' }))
    await userEvent.click(
      await within(document.body).findByRole('menuitemcheckbox', { name: 'AI Tokens' }),
    )
    await expect(args.onSelectedFeatureIdsChange).toHaveBeenCalledWith(['feat_api', 'feat_minutes'])
  },
}

/** The children switch is part of the query the page sends. */
export const IncludesChildren: Story = {
  render: function Render(args) {
    const [query, setQuery] = useState(args.query)
    return <CustomerAnalyticsView {...args} query={query} onQueryChange={setQuery} />
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getAllByLabelText('Include children')[0]!)
    await expect(canvas.getAllByText(/including child customers/).length).toBeGreaterThan(0)
  },
}

export const Loading: Story = {
  args: {
    features: [],
    totals: { revenue: null, cost: null, margin: null, marginPercent: null },
    isLoading: true,
  },
}

export const Empty: Story = {
  args: { features: [], totals: { revenue: null, cost: null, margin: null, marginPercent: null } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No usage in this period')).toBeInTheDocument()
  },
}

export const Failed: Story = {
  args: { features: [], error: 'The analytics service did not answer.', onRetry: fn() },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Analytics could not be loaded'),
    ).toBeInTheDocument()
  },
}

/** A contract's usage: filters and Include children sit on the heading row. */
export const WithHeading: Story = {
  args: { title: 'Usage by feature' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Usage by feature' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Features' })).toBeVisible()
    await expect(canvas.getByRole('switch', { name: 'Include children' })).toBeVisible()
    await expect(canvas.queryByText(/Usage of this contract's metered features/)).toBeNull()
  },
}
