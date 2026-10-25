import { useMemo, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { DEFAULT_PLAN_QUERY, PlanStatus, type PlanQuery } from '@fp/domain'
import { ListState, PageBody } from '@ui/compositions'
import { PlanGrid } from '@ui/pages/product-catalog/plans/PlanGrid'
import { manyPlans } from '@ui/pages/product-catalog/plans/planFixtures'
import { Button } from '@ui/components/primitives/button'
import { PAGE_STORY_PARAMETERS, PageShell, listFailure, paginate } from '../../shared/shellFixtures'

interface PlansListPageProps {
  /** How many plans exist in the catalogue. 0 shows the empty state. */
  rows: number
  /** Status given to every plan, or the fixtures' own mix. */
  status: 'mixed' | PlanStatus
  isLoading: boolean
  hasError: boolean
  /** The search the page opens with. */
  initialSearch: string
}

/** The plans route as the console composes it: shell, PageBody, ListState, PlanGrid. */
function PlansListPage(props: PlansListPageProps) {
  return (
    <PageShell activeItemId="plans" trail={['Product catalog', 'Plans']}>
      <PlansListBody key={props.initialSearch} {...props} />
    </PageShell>
  )
}

function PlansListBody({ rows, status, isLoading, hasError, initialSearch }: PlansListPageProps) {
  const [query, setQuery] = useState<PlanQuery>({ ...DEFAULT_PLAN_QUERY, search: initialSearch })
  const all = useMemo(
    () => manyPlans(rows).map((plan) => (status === 'mixed' ? plan : { ...plan, status })),
    [rows, status],
  )

  const matches = all.filter(
    (plan) =>
      plan.name.toLowerCase().includes(query.search.toLowerCase()) &&
      (query.statuses.length === 0 || query.statuses.includes(plan.status)),
  )
  const isFiltered = query.search.length > 0 || query.statuses.length > 0
  const clearFilters = () => setQuery({ ...query, search: '', statuses: [], page: 1 })

  return (
    <PageBody>
      <ListState
        isLoading={isLoading}
        error={listFailure(hasError, 'plans')}
        isEmpty={matches.length === 0 && !isFiltered}
        isFiltered={isFiltered}
        onRetry={fn()}
        onClearFilters={clearFilters}
        createAction={<Button onClick={fn()}>New plan</Button>}
        emptyTitle="No plans yet"
        emptyDescription="Plans are what customers subscribe to. Each one carries charges, entitlements and credit grants: create the first to start selling."
      >
        <PlanGrid
          plans={paginate(matches, query.page, query.pageSize)}
          total={matches.length}
          query={query}
          onQueryChange={setQuery}
          onPlanClick={fn()}
          onCreate={fn()}
          onEdit={fn()}
          onDuplicate={fn()}
          onAddCharges={fn()}
          onArchive={fn()}
          onClearFilters={clearFilters}
          locale="en-US"
        />
      </ListState>
    </PageBody>
  )
}

const meta = {
  title: 'App/Product catalog/Plans/Plan list',
  component: PlansListPage,
  tags: ['!autodocs'],
  parameters: PAGE_STORY_PARAMETERS,
  args: { rows: 8, status: 'mixed', isLoading: false, hasError: false, initialSearch: '' },
  argTypes: {
    rows: { control: { type: 'number', min: 0, max: 60, step: 1 } },
    status: { control: 'select', options: ['mixed', ...Object.values(PlanStatus)] },
    isLoading: { control: 'boolean' },
    hasError: { control: 'boolean' },
    initialSearch: { control: 'text' },
  },
} satisfies Meta<typeof PlansListPage>

export default meta
type Story = StoryObj<typeof meta>

/** `/plans` with every control live: drag rows from 0 to 60, flip loading and error. */
export const Playground: Story = {}

/** `/plans` for a catalogue with no plans yet. */
export const Empty: Story = {
  args: { rows: 0 },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('No plans yet')).toBeInTheDocument()
  },
}

/** `/plans` with a search that matches nothing. */
export const NoMatches: Story = {
  args: { initialSearch: 'zzz' },
}

/** `/plans` while the first page is loading. */
export const Loading: Story = {
  args: { isLoading: true },
}

/** `/plans` when the request failed. */
export const Failed: Story = {
  args: { hasError: true },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText('Flexprice had a problem loading plans.'),
    ).toBeInTheDocument()
  },
}
