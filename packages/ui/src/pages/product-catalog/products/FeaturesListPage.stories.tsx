import { useMemo, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { DEFAULT_FEATURE_QUERY, FeatureStatus, FeatureType, type FeatureQuery } from '@fp/domain'
import { ListState, PageBody } from '@ui/compositions'
import { FeatureGrid } from '@ui/pages/product-catalog/products/FeatureGrid'
import { manyFeatures } from '@ui/pages/product-catalog/products/featureFixtures'
import { Button } from '@ui/components/primitives/button'
import { PAGE_STORY_PARAMETERS, PageShell, listFailure, paginate } from '../../shared/shellFixtures'

interface FeaturesListPageProps {
  /** How many features exist in the catalogue. 0 shows the empty state. */
  rows: number
  /** Type given to every feature, or the fixtures' own mix. */
  type: 'mixed' | FeatureType
  /** Status given to every feature, or the fixtures' own mix. */
  status: 'mixed' | FeatureStatus
  isLoading: boolean
  hasError: boolean
  /** The search the page opens with. */
  initialSearch: string
}

/** The features route as the console composes it: shell, PageBody, ListState, FeatureGrid. */
function FeaturesListPage(props: FeaturesListPageProps) {
  return (
    <PageShell activeItemId="features" trail={['Product catalog', 'Features']}>
      <FeaturesListBody key={props.initialSearch} {...props} />
    </PageShell>
  )
}

function FeaturesListBody({
  rows,
  type,
  status,
  isLoading,
  hasError,
  initialSearch,
}: FeaturesListPageProps) {
  const [query, setQuery] = useState<FeatureQuery>({
    ...DEFAULT_FEATURE_QUERY,
    search: initialSearch,
  })
  const all = useMemo(
    () =>
      manyFeatures(rows).map((feature) => ({
        ...feature,
        ...(type === 'mixed' ? {} : { type }),
        ...(status === 'mixed' ? {} : { status }),
      })),
    [rows, type, status],
  )

  const matches = all.filter(
    (feature) =>
      feature.name.toLowerCase().includes(query.search.toLowerCase()) &&
      (query.statuses.length === 0 || query.statuses.includes(feature.status)) &&
      (query.types.length === 0 || query.types.includes(feature.type)),
  )
  const isFiltered = query.search.length > 0 || query.statuses.length > 0 || query.types.length > 0
  const clearFilters = () => setQuery({ ...query, search: '', statuses: [], types: [], page: 1 })

  return (
    <PageBody>
      <ListState
        isLoading={isLoading}
        error={listFailure(hasError, 'features')}
        isEmpty={matches.length === 0 && !isFiltered}
        isFiltered={isFiltered}
        onRetry={fn()}
        onClearFilters={clearFilters}
        createAction={<Button onClick={fn()}>New feature</Button>}
        emptyTitle="Nothing is being measured yet"
        emptyDescription="A feature is what you meter or gate: API calls, seats, SSO. Plans price them and entitlements limit them, so this is the first thing to create."
      >
        <FeatureGrid
          features={paginate(matches, query.page, query.pageSize)}
          total={matches.length}
          query={query}
          onQueryChange={setQuery}
          onFeatureClick={fn()}
          onCreate={fn()}
          onEdit={fn()}
          onClone={fn()}
          onDelete={fn()}
          onClearFilters={clearFilters}
        />
      </ListState>
    </PageBody>
  )
}

const meta = {
  title: 'App/Product catalog/Features/Feature list',
  component: FeaturesListPage,
  tags: ['!autodocs'],
  parameters: PAGE_STORY_PARAMETERS,
  args: {
    rows: 8,
    type: 'mixed',
    status: 'mixed',
    isLoading: false,
    hasError: false,
    initialSearch: '',
  },
  argTypes: {
    rows: { control: { type: 'number', min: 0, max: 60, step: 1 } },
    type: { control: 'select', options: ['mixed', ...Object.values(FeatureType)] },
    status: { control: 'select', options: ['mixed', ...Object.values(FeatureStatus)] },
    isLoading: { control: 'boolean' },
    hasError: { control: 'boolean' },
    initialSearch: { control: 'text' },
  },
} satisfies Meta<typeof FeaturesListPage>

export default meta
type Story = StoryObj<typeof meta>

/** `/features` with every control live: drag rows from 0 to 60, pick a type, flip loading and error. */
export const Playground: Story = {}

/** `/features` for a catalogue with no features yet. */
export const Empty: Story = {
  args: { rows: 0 },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText('Nothing is being measured yet'),
    ).toBeInTheDocument()
  },
}

/** `/features` with a search that matches nothing. */
export const NoMatches: Story = {
  args: { initialSearch: 'zzz' },
}

/** `/features` while the first page is loading. */
export const Loading: Story = {
  args: { isLoading: true },
}

/** `/features` when the request failed. */
export const Failed: Story = {
  args: { hasError: true },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText('Flexprice had a problem loading features.'),
    ).toBeInTheDocument()
  },
}
