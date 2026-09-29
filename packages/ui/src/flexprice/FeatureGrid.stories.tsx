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
    // Type and status render as the shared pill.
    await expect(canvas.getAllByText('Published').length).toBeGreaterThan(0)
    // Non-metered features measure nothing; the cell says so rather than
    // rendering blank, which reads as missing data.
    await expect(canvas.getAllByText('—').length).toBeGreaterThan(0)
  },
}

/** The shared table's geometry, as this surface renders it. */
export const Layout: Story = {
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText('API calls')

    const header = canvasElement.querySelector('thead th') as HTMLElement
    await expect(Math.round(header.getBoundingClientRect().height)).toBe(44)

    const cell = canvasElement.querySelector('tbody td') as HTMLElement
    await expect(Math.round(cell.getBoundingClientRect().height)).toBe(60)
    await expect(getComputedStyle(cell).paddingLeft).toBe('16px')
  },
}

/** The status dropdown carries the server's counts and writes the query. */
export const StatusDropdown: Story = {
  args: { statusCounts: { total: 64, published: 51, archived: 13 } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('combobox', { name: /status/i }))
    const listbox = within(await within(document.body).findByRole('listbox'))
    await expect(listbox.getByText('51')).toBeInTheDocument()
    await userEvent.click(listbox.getByRole('option', { name: /archived/i }))

    const spy = args.onQueryChange as unknown as { mock: { calls: unknown[][] } }
    await waitFor(() =>
      expect(
        spy.mock.calls
          .map((call) => call[0] as { statuses?: string[] })
          .some((query) => query.statuses?.[0] === 'archived'),
      ).toBe(true),
    )
  },
}

export const Loading: Story = { args: { features: [], total: 0, isLoading: true } }

/** A filter emptied the list — the toolbar survives, so it can be undone. */
export const FilteredEmpty: Story = {
  args: {
    features: [],
    total: 0,
    query: { ...fixtureFeatureQuery, search: 'zzz' },
    onClearFilters: fn(),
  },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/no features match these filters/i),
    ).toBeInTheDocument()
  },
}

/** Nothing measured yet: the illustration, the CTA, and three guide cards. */
export const FirstRun: Story = {
  args: { features: [], total: 0, onCreate: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Nothing is being measured yet')).toBeInTheDocument()
    await expect(canvas.getAllByText('Read docs')).toHaveLength(3)
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

/** Paging reports a page number, never an offset, and never drops a query key. */
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
