import { type ComponentProps, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import type { AddonQuery } from '@fp/domain'
import { AddonGrid } from './AddonGrid'
import { addonFixtures, fixtureAddonQuery, manyAddons } from './addonFixtures'

const meta = {
  title: 'Surfaces/AddonGrid',
  component: AddonGrid,
  parameters: { layout: 'padded' },
  args: {
    addons: addonFixtures,
    total: addonFixtures.length,
    query: fixtureAddonQuery,
    onQueryChange: fn(),
    locale: 'en-US',
  },
  argTypes: {
    addons: { control: false },
    total: { control: false },
    query: { control: false },
    isLoading: { control: 'boolean' },
    error: { control: false },
    locale: { control: 'select', options: ['en-US', 'en-GB', 'de-DE'] },
    onQueryChange: { control: false },
    onRetry: { control: false },
    onAddonClick: { control: false },
    onCreate: { control: false },
    onEdit: { control: false },
    onClearFilters: { control: false },
  },
} satisfies Meta<typeof AddonGrid>

export default meta
type Story = StoryObj<typeof meta>

type PlaygroundArgs = ComponentProps<typeof AddonGrid> & {
  rows: number
  hasError: boolean
  page: number
  pageSize: number
}

function AddonGridPlayground({ rows, hasError, page, pageSize, ...args }: PlaygroundArgs) {
  const [query, setQuery] = useState<AddonQuery>({ ...fixtureAddonQuery, page, pageSize })
  const start = (query.page - 1) * query.pageSize
  return (
    <AddonGrid
      {...args}
      addons={manyAddons(rows).slice(start, start + query.pageSize)}
      total={rows}
      query={query}
      onQueryChange={(next) => {
        setQuery(next)
        args.onQueryChange(next)
      }}
      error={hasError ? 'You do not have access to add-ons in this environment.' : null}
      onRetry={() => {}}
    />
  )
}

/** Drag `rows` from 0 to 60 to see first-run, a short list and paging. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: { rows: 30, hasError: false, page: 1, pageSize: 10, isLoading: false },
  argTypes: {
    rows: { control: { type: 'range', min: 0, max: 60, step: 1 } },
    hasError: { control: 'boolean' },
    page: { control: { type: 'number', min: 1, max: 6, step: 1 } },
    pageSize: { control: 'select', options: [10, 25, 50] },
  },
  render: (args) => <AddonGridPlayground key={`${args.page}-${args.pageSize}`} {...args} />,
}

export const Default: Story = {}

export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findAllByText('Published')).not.toHaveLength(0)
    // An add-on with no description says so rather than rendering blank.
    await expect(canvas.getAllByText('—').length).toBeGreaterThan(0)
  },
}

/**
 * Three of the redesign's seven columns have no field, so they are absent.
 *
 * `AddonWire` carries no type, no price and no subscriber count — an add-on's
 * charges are a later surface. Omitted rather than dashed on every row, and
 * asserted here so nobody adds them back with a placeholder.
 */
export const OmitsUnsourcedColumns: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole('columnheader', { name: /add-on/i })

    await expect(canvas.queryByRole('columnheader', { name: /^type$/i })).toBeNull()
    await expect(canvas.queryByRole('columnheader', { name: /^price$/i })).toBeNull()
    await expect(canvas.queryByRole('columnheader', { name: /subscribers/i })).toBeNull()

    // What the read model does carry.
    await expect(canvas.getByRole('columnheader', { name: /^key$/i })).toBeInTheDocument()
    await expect(canvas.getByRole('columnheader', { name: /description/i })).toBeInTheDocument()
  },
}

/** The shared table's geometry, as this surface renders it. */
export const Layout: Story = {
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByRole('columnheader', { name: /add-on/i })

    const header = canvasElement.querySelector('thead th') as HTMLElement
    await expect(Math.round(header.getBoundingClientRect().height)).toBe(44)

    const cell = canvasElement.querySelector('tbody td') as HTMLElement
    await expect(Math.round(cell.getBoundingClientRect().height)).toBe(60)
    await expect(getComputedStyle(cell).paddingLeft).toBe('16px')
  },
}

export const Loading: Story = { args: { addons: [], total: 0, isLoading: true } }

/** A filter emptied the list — the toolbar survives, so it can be undone. */
export const FilteredEmpty: Story = {
  args: {
    addons: [],
    total: 0,
    query: { ...fixtureAddonQuery, search: 'zzz' },
    onClearFilters: fn(),
  },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/no add-ons match these filters/i),
    ).toBeInTheDocument()
  },
}

/** Nothing created yet: the illustration, the CTA, and three guide cards. */
export const FirstRun: Story = {
  args: { addons: [], total: 0, onCreate: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('No add-ons yet')).toBeInTheDocument()
    await expect(canvas.getAllByText('Read docs')).toHaveLength(3)
  },
}

export const Error: Story = {
  args: {
    addons: [],
    total: 0,
    error: 'You do not have access to add-ons in this environment.',
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
  args: { addons: manyAddons(25), total: 120, query: { ...fixtureAddonQuery, page: 1 } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.click(await canvas.findByRole('button', { name: /next|go to next page/i }))

    const spy = args.onQueryChange as unknown as { mock: { calls: unknown[][] } }
    const reportedPage = () =>
      spy.mock.calls.map((call) => call[0] as Record<string, unknown>).find((q) => q['page'] === 2)
    await waitFor(() => expect(reportedPage()).toBeDefined())
    const reported = reportedPage() as Record<string, unknown>
    expect(reported).toMatchObject({ page: 2 })
    expect(Object.keys(reported).sort()).toEqual(Object.keys(fixtureAddonQuery).sort())
  },
}
