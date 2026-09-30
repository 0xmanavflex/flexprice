import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import {
  DEFAULT_GROUP_QUERY,
  type Group,
  GroupEntityType,
  type GroupQuery,
  GroupStatus,
} from '@fp/domain'
import { Button } from '@ui/primitives/button'
import { GroupGrid } from './GroupGrid'

/**
 * Wait for an open popup to finish unmounting.
 *
 * While a Base UI popup is open it mounts `data-base-ui-focus-guard` spans
 * that are `aria-hidden` *and* `tabindex="0"` — which is exactly what axe's
 * `aria-hidden-focus` rule forbids. The a11y scan runs when the play function
 * returns, so a story that returns while the popup is still closing is scanned
 * mid-animation and fails intermittently. This is not a suppression: it makes
 * the scan look at the settled DOM, which is the state being asserted about.
 */
async function popupClosed(role: 'menu' | 'listbox') {
  await waitFor(() => expect(within(document.body).queryByRole(role)).toBeNull())
}


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

    // A group holds prices or features — and only those two. There is no
    // plan group and no add-on group in `GroupEntityType`.
    await expect(canvas.getAllByText('Prices').length).toBeGreaterThan(0)
    await expect(canvas.getAllByText('Features').length).toBeGreaterThan(0)

    // The ID column is the one the truncation rule was written for.
    await expect(canvas.getByText('grp_01')).toBeInTheDocument()
  },
}

/**
 * The entity filter is not offered.
 *
 * `GroupQuery` has no `entityTypes` field and `toGroupFilter` sends none, so a
 * filter could only narrow the twenty-five rows already fetched while the
 * footer kept reporting the server's total.
 */
export const NoEntityFilter: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('Enterprise prices')

    await expect(canvas.queryByRole('button', { name: /filter/i })).toBeNull()
    // The type is still a column, which is where it can be read honestly.
    await expect(canvas.getByRole('columnheader', { name: /entity type/i })).toBeInTheDocument()
  },
}

/** No counts: `useCatalogStats` does not cover groups. */
export const StatusDropdownHasNoCounts: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('Enterprise prices')

    await userEvent.click(canvas.getByRole('combobox', { name: /status/i }))
    const listbox = within(await within(document.body).findByRole('listbox'))
    const published = listbox.getByRole('option', { name: /published/i })
    await expect(published.textContent).not.toMatch(/\d/)

    await userEvent.click(listbox.getByRole('option', { name: /archived/i }))
    const spy = args.onQueryChange as unknown as { mock: { calls: unknown[][] } }
    await waitFor(() =>
      expect(
        spy.mock.calls
          .map((call) => call[0] as { statuses?: string[] })
          .some((query) => query.statuses?.[0] === 'archived'),
      ).toBe(true),
    )
    await popupClosed('listbox')
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
      await within(canvasElement).findByText(/no groups match these filters/i),
    ).toBeInTheDocument()
  },
}

/**
 * Nothing created yet.
 *
 * Creating a group still happens in the legacy console, so the page hands the
 * grid a link rather than a handler — and the grid renders it in both the
 * toolbar and the empty state, which is the only route to a first group.
 */
export const FirstRun: Story = {
  args: {
    groups: [],
    total: 0,
    primaryAction: <Button>New group</Button>,
    emptyActions: <Button>New group</Button>,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('No groups yet')).toBeInTheDocument()
    await expect(canvas.getAllByText('Read docs')).toHaveLength(3)
    await expect(canvas.getAllByRole('button', { name: /new group/i }).length).toBe(2)
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
