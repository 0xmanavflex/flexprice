import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { FeatureGrid } from './FeatureGrid'
import { featureFixtures, fixtureFeatureQuery, manyFeatures } from './featureFixtures'

const meta = {
  title: 'Flexprice/FeatureGrid',
  component: FeatureGrid,
  parameters: { layout: 'padded' },
  args: {
    features: featureFixtures,
    total: featureFixtures.length,
    query: fixtureFeatureQuery,
    onQueryChange: fn(),
    locale: 'en-US',
  },
} satisfies Meta<typeof FeatureGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(await canvas.findByText('API calls')).toBeInTheDocument()
    await expect(canvas.getByText('api_call')).toBeInTheDocument()
    await expect(canvas.getByText('Count of events')).toBeInTheDocument()
    // Non-metered features measure nothing; the cell says so rather than
    // rendering blank, which reads as missing data.
    await expect(canvas.getAllByText('—').length).toBeGreaterThan(0)
  },
}

export const Loading: Story = { args: { features: [], total: 0, isLoading: true } }

export const Empty: Story = {
  args: { features: [], total: 0 },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/no features match these filters/i),
    ).toBeInTheDocument()
  },
}

export const Error: Story = {
  args: {
    features: [],
    total: 0,
    error: 'You do not have access to features in this environment.',
    onRetry: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: /try again/i }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}

/** Paging reports a page number, never an offset. */
export const PaginationReportsDomainQuery: Story = {
  args: { features: manyFeatures(25), total: 120, query: { ...fixtureFeatureQuery, page: 1 } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.click(await canvas.findByRole('button', { name: /next|go to next page/i }))

    const spy = args.onQueryChange as unknown as { mock: { calls: unknown[][] } }
    const reported = spy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(reported).toMatchObject({ page: 2 })
    expect(Object.keys(reported).sort()).toEqual(Object.keys(fixtureFeatureQuery).sort())
  },
}
