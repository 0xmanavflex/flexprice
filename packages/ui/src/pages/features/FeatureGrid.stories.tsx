import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { FeatureGrid, type ProductLinkage } from './FeatureGrid'
import { featureFixtures, fixtureFeatureQuery, manyFeatures } from './featureFixtures'

/** Plans, entitlements and subscriptions for the first three fixture products. */
const linkage = new Map<string, ProductLinkage>([
  [
    'feat_01',
    {
      plans: [
        { id: 'plan_a', name: 'Starter' },
        { id: 'plan_b', name: 'Growth' },
        { id: 'plan_c', name: 'Scale' },
      ],
      entitlements: 3,
      subscriptions: 1280,
    },
  ],
  ['feat_02', { plans: [{ id: 'plan_b', name: 'Growth' }], entitlements: 1, subscriptions: 412 }],
  ['feat_03', { plans: [], entitlements: 0, subscriptions: 0 }],
])

const meta = {
  title: 'Surfaces/FeatureGrid',
  component: FeatureGrid,
  parameters: { layout: 'padded' },
  args: {
    features: featureFixtures,
    linkage,
    onCreateEntitlement: fn(),
    onFeatureClick: fn(),
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
    // Non-metered products measure nothing; the cell says so rather than
    // rendering blank, which reads as missing data.
    await expect(canvas.getAllByText('—').length).toBeGreaterThan(0)
  },
}

/** Plans as chips (the overflow collapses to +N), entitlements and subscriptions as counts. */
export const Linkage: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('API calls')
    await expect(canvas.getAllByText('Starter').length).toBeGreaterThan(0)
    await expect(canvas.getByText('+1')).toBeInTheDocument()
    await expect(canvas.getByText('3 entitlements')).toBeInTheDocument()
    await expect(canvas.getByText('1,280')).toBeInTheDocument()
  },
}

/** A product no plan grants offers to create the entitlement, without opening the row. */
export const AddEntitlement: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Add entitlement' }))
    await expect(args.onCreateEntitlement).toHaveBeenCalledOnce()
    await expect(args.onFeatureClick).not.toHaveBeenCalled()
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
      await within(canvasElement).findByText(/no products match these filters/i),
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
