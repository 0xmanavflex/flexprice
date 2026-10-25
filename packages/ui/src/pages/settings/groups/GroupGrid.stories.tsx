import { type ComponentProps, useMemo, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import {
  DEFAULT_GROUP_QUERY,
  type Group,
  GroupEntityType,
  type GroupQuery,
  GroupStatus,
} from '@fp/domain'
import { GroupGrid } from './GroupGrid'

/**
 * The group list, over the shared `EntityList`.
 *
 * Groups as plain domain values — no client, no provider, no network.
 */
const groupFixtures: Group[] = [
  {
    id: 'grp_01',
    name: 'Enterprise prices',
    lookupKey: 'enterprise_prices',
    entityType: GroupEntityType.Price,
    entityCount: 12,
    status: GroupStatus.Published,
    createdAt: new Date('2026-01-10T00:00:00Z'),
    updatedAt: new Date('2026-02-02T00:00:00Z'),
  },
  {
    id: 'grp_02',
    name: 'Core feature',
    lookupKey: 'core_feature',
    entityType: GroupEntityType.Feature,
    entityCount: 1,
    status: GroupStatus.Published,
    createdAt: new Date('2026-01-18T00:00:00Z'),
    updatedAt: new Date('2026-02-28T00:00:00Z'),
  },
  {
    // No lookup key — the row a hand-written demo omits.
    id: 'grp_03',
    name: 'EU prices',
    lookupKey: '',
    entityType: GroupEntityType.Price,
    entityCount: 5,
    status: GroupStatus.Published,
    createdAt: new Date('2026-02-05T00:00:00Z'),
    updatedAt: new Date('2026-03-15T00:00:00Z'),
  },
  {
    // Archived, and holding nothing — the row that shows both edge states.
    id: 'grp_04',
    name: 'Legacy bundle',
    lookupKey: 'legacy_bundle',
    entityType: GroupEntityType.Price,
    entityCount: 0,
    status: GroupStatus.Archived,
    createdAt: new Date('2025-11-01T00:00:00Z'),
    updatedAt: new Date('2026-01-05T00:00:00Z'),
  },
  {
    // No timestamps — the row a hand-written demo omits.
    id: 'grp_05',
    name: 'Beta features',
    lookupKey: 'beta_features',
    entityType: GroupEntityType.Feature,
    entityCount: 3,
    status: GroupStatus.Published,
    createdAt: null,
    updatedAt: null,
  },
]

const fixtureGroupQuery: GroupQuery = { ...DEFAULT_GROUP_QUERY }

function manyGroups(count: number): Group[] {
  return Array.from({ length: count }, (_, index) => {
    const base = groupFixtures[index % groupFixtures.length] as Group
    return { ...base, id: `grp_page_${index}`, name: `${base.name} ${index}` }
  })
}

const meta = {
  title: 'App/Settings/Groups/Group table',
  component: GroupGrid,
  parameters: { layout: 'padded' },
  args: {
    groups: groupFixtures,
    total: groupFixtures.length,
    query: fixtureGroupQuery,
    onQueryChange: fn(),
    locale: 'en-US',
  },
} satisfies Meta<typeof GroupGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(await canvas.findByText('Enterprise prices')).toBeInTheDocument()

    // A group holds prices or features — and only those two. There is no
    // plan group and no add-on group in `GroupEntityType`.
    await expect(canvas.getAllByText('Prices').length).toBeGreaterThan(0)
    await expect(canvas.getAllByText('Features').length).toBeGreaterThan(0)

    // The ID column is the one the truncation rule was written for.
    await expect(canvas.getByText('grp_01')).toBeInTheDocument()
  },
}

/**
 * Filters run on the server through the search endpoint's filter conditions,
 * so the button is there and the type stays a column too.
 */
export const EntityFilter: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('Enterprise prices')

    await expect(canvas.getByRole('button', { name: /filter/i })).toBeInTheDocument()
    await expect(canvas.getByRole('columnheader', { name: /entity type/i })).toBeInTheDocument()
  },
}

/** The shared table's geometry, as this surface renders it. */
export const Layout: Story = {
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText('Enterprise prices')

    const header = canvasElement.querySelector('thead th') as HTMLElement
    await expect(Math.round(header.getBoundingClientRect().height)).toBe(44)

    const cell = canvasElement.querySelector('tbody td') as HTMLElement
    await expect(Math.round(cell.getBoundingClientRect().height)).toBe(60)
    await expect(getComputedStyle(cell).paddingLeft).toBe('16px')
  },
}

export const Loading: Story = { args: { groups: [], total: 0, isLoading: true } }

/** A filter emptied the list — the toolbar survives, so it can be undone. */
export const FilteredEmpty: Story = {
  args: {
    groups: [],
    total: 0,
    query: { ...fixtureGroupQuery, search: 'zzz' },
    onClearFilters: fn(),
  },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/no tags match these filters/i),
    ).toBeInTheDocument()
  },
}

/**
 * Nothing created yet. The create action is offered in both the toolbar and
 * the empty state, and both call `onCreate`.
 */
export const FirstRun: Story = {
  args: {
    groups: [],
    total: 0,
    onCreate: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('No tags yet')).toBeInTheDocument()
    await expect(canvas.getAllByText('Read docs')).toHaveLength(3)
    const create = canvas.getAllByRole('button', { name: /new tag/i })
    await expect(create.length).toBe(1)
    await userEvent.click(create[0]!)
    await expect(args.onCreate).toHaveBeenCalledOnce()
  },
}

export const Error: Story = {
  args: {
    groups: [],
    total: 0,
    error: 'You do not have access to tags in this environment.',
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
  args: { groups: manyGroups(25), total: 120, query: { ...fixtureGroupQuery, page: 1 } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.click(await canvas.findByRole('button', { name: /next|go to next page/i }))

    const spy = args.onQueryChange as unknown as { mock: { calls: unknown[][] } }
    const reportedPage = () =>
      spy.mock.calls.map((call) => call[0] as Record<string, unknown>).find((q) => q['page'] === 2)
    await waitFor(() => expect(reportedPage()).toBeDefined())
    const reported = reportedPage() as Record<string, unknown>
    expect(reported).toMatchObject({ page: 2 })
    expect(Object.keys(reported).sort()).toEqual(Object.keys(fixtureGroupQuery).sort())
  },
}

/** Overrides every row's status so one state can be inspected across a long list. */
function withStatus<T extends { status: unknown }>(items: T[], status: string): T[] {
  return status === 'mixed' ? items : items.map((item) => ({ ...item, status }) as T)
}

type PlaygroundArgs = Omit<
  ComponentProps<typeof GroupGrid>,
  'groups' | 'total' | 'query' | 'onQueryChange' | 'error'
> & {
  /** How many records the server holds, 0 to 60. */
  rows: number
  /** The page shown, 1-based. */
  page: number
  pageSize: number
  /** Forces every row to one status; mixed keeps the fixture spread. */
  status: 'mixed' | GroupStatus
  /** Shows the error state instead of the list. */
  hasError: boolean
}

function GroupGridPlayground({ rows, page, pageSize, status, hasError, ...rest }: PlaygroundArgs) {
  const [query, setQuery] = useState<GroupQuery>({ ...DEFAULT_GROUP_QUERY, page, pageSize })
  const all = useMemo(() => withStatus(manyGroups(rows), status), [rows, status])
  const lastPage = Math.max(1, Math.ceil(all.length / query.pageSize))
  const current = Math.min(query.page, lastPage)
  const start = (current - 1) * query.pageSize
  return (
    <GroupGrid
      locale="en-US"
      {...rest}
      groups={all.slice(start, start + query.pageSize)}
      total={all.length}
      query={{ ...query, page: current }}
      onQueryChange={setQuery}
      error={hasError ? 'You do not have access to tags in this environment.' : null}
    />
  )
}

/** Drag rows from 0 to 60 to walk empty, one page, and a long list; flip loading and error. */
export const Playground: StoryObj<PlaygroundArgs> = {
  parameters: { controls: { exclude: /^(groups|total|query|error|on[A-Z].*)$/ } },
  args: {
    rows: 30,
    page: 1,
    pageSize: 10,
    status: 'mixed',
    isLoading: false,
    hasError: false,
    onRetry: fn(),
    onCreate: fn(),
    onGroupClick: fn(),
    onDelete: fn(),
  },
  argTypes: {
    rows: { control: { type: 'number', min: 0, max: 60, step: 1 } },
    page: { control: { type: 'number', min: 1, max: 6, step: 1 } },
    pageSize: { control: 'select', options: [10, 25, 50] },
    status: { control: 'select', options: ['mixed', ...Object.values(GroupStatus)] },
    isLoading: { control: 'boolean' },
    hasError: { control: 'boolean' },
  },
  render: (args) => <GroupGridPlayground key={`${args.page}-${args.pageSize}`} {...args} />,
}
