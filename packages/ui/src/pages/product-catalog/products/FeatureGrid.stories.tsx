import { type ComponentProps, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import type { Feature } from '@fp/domain'
import { FeatureGrid, type FeatureLinkage } from './FeatureGrid'
import { featureFixtures, fixtureFeatureQuery, manyFeatures } from './featureFixtures'

/** Plans, entitlements and subscriptions for the first three fixture features. */
const linkage = new Map<string, FeatureLinkage>([
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
  title: 'App/Product catalog/Features/Feature table',
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
  argTypes: {
    features: { control: false },
    total: { control: false },
    query: { control: false },
    isLoading: { control: 'boolean' },
    error: { control: false },
    locale: { control: 'select', options: ['en-US', 'en-GB', 'de-DE'] },
    onQueryChange: { control: false },
    onRetry: { control: false },
    onFeatureClick: { control: false },
    onCreate: { control: false },
    onEdit: { control: false },
    onClone: { control: false },
    onDelete: { control: false },
    onClearFilters: { control: false },
    onCreateEntitlement: { control: false },
    linkage: { control: false },
    linkageLoading: { control: 'boolean' },
  },
} satisfies Meta<typeof FeatureGrid>

export default meta
type Story = StoryObj<typeof meta>

/** Plans, entitlements and subscriptions derived from the row index, so the columns vary. */
function makeLinkage(features: Feature[]): Map<string, FeatureLinkage> {
  const plans = ['Starter', 'Growth', 'Scale', 'Enterprise']
  return new Map(
    features.map((feature, index) => [
      feature.id,
      {
        plans: plans.slice(0, index % 5).map((name) => ({ id: `plan_${name}`, name })),
        entitlements: index % 5,
        subscriptions: (index % 5) * 137,
      },
    ]),
  )
}

type PlaygroundArgs = ComponentProps<typeof FeatureGrid> & {
  rows: number
  showLinkage: boolean
  hasError: boolean
  page: number
  pageSize: number
}

function FeatureGridPlayground({
  rows,
  hasError,
  page,
  pageSize,
  showLinkage,
  ...args
}: PlaygroundArgs) {
  const [query, setQuery] = useState(() => ({ ...fixtureFeatureQuery, page, pageSize }))
  const start = (query.page - 1) * query.pageSize
  const visible = manyFeatures(rows).slice(start, start + query.pageSize)
  return (
    <FeatureGrid
      {...args}
      features={visible}
      {...(showLinkage ? { linkage: makeLinkage(visible) } : {})}
      total={rows}
      query={query}
      onQueryChange={(next) => {
        setQuery(next)
        args.onQueryChange(next)
      }}
      error={hasError ? 'You do not have access to features in this environment.' : null}
    />
  )
}

/** Drag `rows` from 0 to 60 to see first-run, a short list and paging; toggle loading and error. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    rows: 30,
    hasError: false,
    page: 1,
    pageSize: 10,
    isLoading: false,
    showLinkage: true,
    linkageLoading: false,
  },
  argTypes: {
    rows: { control: { type: 'range', min: 0, max: 60, step: 1 } },
    hasError: { control: 'boolean' },
    showLinkage: { control: 'boolean' },
    page: { control: { type: 'number', min: 1, max: 6, step: 1 } },
    pageSize: { control: 'select', options: [10, 25, 50] },
  },
  render: (args) => <FeatureGridPlayground key={`${args.page}-${args.pageSize}`} {...args} />,
}

export const Default: Story = {}

export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(await canvas.findByText('API calls')).toBeInTheDocument()
    // The measurement is shown as the aggregation's formula chip, not the event
    // name repeated from the feature's own key.
    await expect(canvas.getByText('COUNT()')).toBeInTheDocument()
    // Non-metered features measure nothing; the cell says so rather than
    // rendering blank, which reads as missing data.
    await expect(canvas.getAllByText('—').length).toBeGreaterThan(0)
  },
}

/**
 * Plans as chips, with the overflow collapsing to +N.
 *
 * Entitlements and contracts are counted too, but the redesign's layout does
 * not spend a column on either, so both start hidden and live in the column
 * menu. What stays on screen by default is what the design shows.
 */
export const Linkage: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('API calls')

    // Entitlements and Contracts are in the handoff's column set, so their
    // counts are on the page without asking.
    await expect(canvas.getByRole('columnheader', { name: 'Entitlements' })).toBeInTheDocument()
    await expect(canvas.getByRole('columnheader', { name: 'Contracts' })).toBeInTheDocument()

    // "Used in" is not, so the plan chips are behind the `⋯` menu.
    await expect(canvas.queryByRole('columnheader', { name: 'Used in' })).toBeNull()
    await expect(canvas.queryByText('+1')).toBeNull()
    const row = canvas.getByRole('row', { name: /API calls/ })
    await expect(within(row).getByText('3', { exact: true })).toBeVisible()
    await expect(within(row).queryByText('3 entitlements')).toBeNull()
  },
}

/**
 * The columns the handoff asks for, in its order.
 *
 * §3: "Name, Type, Event name, Aggregation, Group, Entitlements, Contracts —
 * aggregation as a formula, group as a chip; Status, Updated and Charges
 * removed". Key, Unit, Used in and Status are real and stay in the `⋯` menu
 * rather than being dropped.
 */
export const DefaultColumns: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('API calls')
    const headers = canvas
      .getAllByRole('columnheader')
      .map((header) => header.textContent?.trim())
      .filter((text): text is string => Boolean(text))
    await expect(headers.slice(0, 7)).toEqual([
      'Name',
      'Type',
      'Event name',
      'Aggregation',
      'Tag',
      'Entitlements',
      'Contracts',
    ])
    for (const gone of ['Key', 'Unit', 'Used in', 'Status']) {
      await expect(canvas.queryByRole('columnheader', { name: gone })).toBeNull()
    }
  },
}

/**
 * Creating an entitlement without opening the row.
 *
 * It used to be a button inside the entitlements column. That column is not
 * in the redesign's layout, so the action moved to the row menu rather than
 * disappearing with it.
 */
export const AddEntitlement: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const rows = await canvas.findAllByRole('button', { name: 'Row actions' })
    await userEvent.click(rows[0] as HTMLElement)
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Add entitlement' }))
    await expect(args.onCreateEntitlement).toHaveBeenCalledOnce()
    await expect(args.onFeatureClick).not.toHaveBeenCalled()

    /*
     * Wait for the menu to actually go.
     *
     * Base UI leaves `aria-hidden` focus guards in the DOM while a popup
     * closes, and the a11y scan runs the moment `play` returns — so on a
     * loaded runner it caught them mid-teardown and failed `aria-hidden-focus`,
     * green here and red in CI. Waiting removes the race; muting the rule
     * would have hidden a real one later.
     */
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
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
