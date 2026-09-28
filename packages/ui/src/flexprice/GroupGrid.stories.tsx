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
 * The group list — the same controlled table shape as the other grids.
 * The page owns the query; the grid renders rows and reports a domain query
 * back. Groups as plain domain values, no client, no provider, no network.
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
    // A single member — the row that proves the noun is singularised.
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
  title: 'Surfaces/GroupGrid',
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
    await expect(canvas.getByText('enterprise_prices')).toBeInTheDocument()
    // The count carries the kind it holds, singularised at one.
    await expect(canvas.getByText('12 prices')).toBeInTheDocument()
    await expect(canvas.getByText('1 feature')).toBeInTheDocument()
    // Published and Archived both render.
    await expect(canvas.getAllByText('Published').length).toBeGreaterThan(0)
    await expect(canvas.getByText('Archived')).toBeInTheDocument()
  },
}

export const Loading: Story = { args: { groups: [], total: 0, isLoading: true } }

export const Empty: Story = {
  args: { groups: [], total: 0 },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/no groups match these filters/i),
    ).toBeInTheDocument()
  },
}

export const Error: Story = {
  args: {
    groups: [],
    total: 0,
    error: 'You do not have access to groups in this environment.',
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
  args: { groups: manyGroups(25), total: 120, query: { ...fixtureGroupQuery, page: 1 } },
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
    expect(Object.keys(reported).sort()).toEqual(Object.keys(fixtureGroupQuery).sort())
  },
}
