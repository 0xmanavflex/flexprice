import { useMemo, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { CouponStatus, DEFAULT_COUPON_QUERY, type CouponQuery } from '@fp/domain'
import { ListState, PageBody } from '@ui/compositions'
import { CouponGrid } from '@ui/pages/settings/discounts/CouponGrid'
import { manyCoupons } from '@ui/pages/settings/discounts/couponFixtures'
import { Button } from '@ui/components/primitives/button'
import { PAGE_STORY_PARAMETERS, PageShell, listFailure, paginate } from '../../shared/shellFixtures'

interface CouponsListPageProps {
  /** How many coupons exist in the catalogue. 0 shows the empty state. */
  rows: number
  /** Status given to every coupon, or the fixtures' own mix. */
  status: 'mixed' | CouponStatus
  isLoading: boolean
  hasError: boolean
  /** The search the page opens with. */
  initialSearch: string
}

/** The coupons route as the console composes it: shell, PageBody, ListState, CouponGrid. */
function CouponsListPage(props: CouponsListPageProps) {
  return (
    <PageShell activeItemId="coupons" trail={['Product catalog', 'Coupons']}>
      <CouponsListBody key={props.initialSearch} {...props} />
    </PageShell>
  )
}

function CouponsListBody({
  rows,
  status,
  isLoading,
  hasError,
  initialSearch,
}: CouponsListPageProps) {
  const [query, setQuery] = useState<CouponQuery>({
    ...DEFAULT_COUPON_QUERY,
    search: initialSearch,
  })
  const all = useMemo(
    () => manyCoupons(rows).map((coupon) => (status === 'mixed' ? coupon : { ...coupon, status })),
    [rows, status],
  )

  const matches = all.filter(
    (coupon) =>
      coupon.name.toLowerCase().includes(query.search.toLowerCase()) &&
      (query.statuses.length === 0 || query.statuses.includes(coupon.status)),
  )
  const isFiltered = query.search.length > 0 || query.statuses.length > 0
  const clearFilters = () => setQuery({ ...query, search: '', statuses: [], page: 1 })

  return (
    <PageBody>
      <ListState
        isLoading={isLoading}
        error={listFailure(hasError, 'coupons')}
        isEmpty={matches.length === 0 && !isFiltered}
        isFiltered={isFiltered}
        onRetry={fn()}
        onClearFilters={clearFilters}
        createAction={<Button onClick={fn()}>New coupon</Button>}
        emptyTitle="No coupons yet"
        emptyDescription="Coupons apply a discount to a contract or an invoice: once, for a set number of periods, or forever. Create the first to offer one."
      >
        <CouponGrid
          coupons={paginate(matches, query.page, query.pageSize)}
          total={matches.length}
          query={query}
          onQueryChange={setQuery}
          onCouponClick={fn()}
          onCreate={fn()}
          onEdit={fn()}
          onArchive={fn()}
          onClearFilters={clearFilters}
          locale="en-US"
        />
      </ListState>
    </PageBody>
  )
}

const meta = {
  title: 'App/Settings/Discounts/Discount list',
  component: CouponsListPage,
  tags: ['!autodocs'],
  parameters: PAGE_STORY_PARAMETERS,
  args: { rows: 8, status: 'mixed', isLoading: false, hasError: false, initialSearch: '' },
  argTypes: {
    rows: { control: { type: 'number', min: 0, max: 60, step: 1 } },
    status: { control: 'select', options: ['mixed', ...Object.values(CouponStatus)] },
    isLoading: { control: 'boolean' },
    hasError: { control: 'boolean' },
    initialSearch: { control: 'text' },
  },
} satisfies Meta<typeof CouponsListPage>

export default meta
type Story = StoryObj<typeof meta>

/** `/coupons` with every control live: drag rows from 0 to 60, flip loading and error. */
export const Playground: Story = {}

/** `/coupons` for a catalogue with no coupons yet. */
export const Empty: Story = {
  args: { rows: 0 },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('No coupons yet')).toBeInTheDocument()
  },
}

/** `/coupons` with a search that matches nothing. */
export const NoMatches: Story = {
  args: { initialSearch: 'zzz' },
}

/** `/coupons` while the first page is loading. */
export const Loading: Story = {
  args: { isLoading: true },
}

/** `/coupons` when the request failed. */
export const Failed: Story = {
  args: { hasError: true },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText('Flexprice had a problem loading coupons.'),
    ).toBeInTheDocument()
  },
}
