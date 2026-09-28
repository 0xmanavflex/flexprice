import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { FeatureGrid } from './FeatureGrid'
import { featureFixtures, fixtureFeatureQuery, manyFeatures } from './featureFixtures'

const meta = {
  title: 'Surfaces/FeatureGrid',
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
    // Each column is a single value: the measurement is the aggregation, not the
    // event name repeated from the feature's own key.
    await expect(canvas.getByText('Count of events')).toBeInTheDocument()
    // Type and status render as the shared catalogue badge.
    await expect(canvas.getAllByText('Published').length).toBeGreaterThan(0)
    // Non-metered features measure nothing; the cell says so rather than
    // rendering blank, which reads as missing data.
    await expect(canvas.getAllByText('—').length).toBeGreaterThan(0)
  },
}

export const Loading: Story = { args: { features: [], total: 0, isLoading: true } }

/** The same rows, read as cards. `query.view` drives the layout. */
export const Cards: Story = {
  args: { query: { ...fixtureFeatureQuery, view: 'cards' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('API calls')).toBeInTheDocument()
    // The card shows measurement as one line, "api_call · Count of events".
    await expect(canvas.getByText(/count of events/i)).toBeInTheDocument()
  },
}

/** The toggle reports a layout, and leaves the rest of the query untouched. */
export const ViewToggle: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('tab', { name: /card view/i }))

    const spy = args.onQueryChange as unknown as { mock: { calls: unknown[][] } }
    const reported = spy.mock.calls.at(-1)?.[0] as Record<string, unknown>
    expect(reported).toMatchObject({ view: 'cards' })
  },
}

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

    // The grid can also fire onQueryChange as it settles, so the Next click is
    // not necessarily call[0]. Wait for — then read — the call that reported
    // page 2, rather than racing whichever call landed first.
    const spy = args.onQueryChange as unknown as { mock: { calls: unknown[][] } }
    const reportedPage = () =>
      spy.mock.calls.map((call) => call[0] as Record<string, unknown>).find((q) => q['page'] === 2)
    await waitFor(() => expect(reportedPage()).toBeDefined())
    const reported = reportedPage() as Record<string, unknown>
    expect(reported).toMatchObject({ page: 2 })
    expect(Object.keys(reported).sort()).toEqual(Object.keys(fixtureFeatureQuery).sort())
  },
}
