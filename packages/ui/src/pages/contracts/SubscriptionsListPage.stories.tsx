import { useMemo, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { RefreshCwIcon } from '@ui/icons'
import {
  DEFAULT_SUBSCRIPTION_QUERY,
  SubscriptionStatus,
  type Subscription,
  type SubscriptionQuery,
} from '@fp/domain'
import { ListState, PageBody } from '@ui/compositions'
import { SubscriptionGrid } from '@ui/pages/contracts/SubscriptionGrid'
import { Button } from '@ui/components/primitives/button'
import { PAGE_STORY_PARAMETERS, PageShell, listFailure, paginate } from '../shared/shellFixtures'

const CUSTOMERS = ['Acme Robotics', 'Globex', 'Initech', 'Umbrella Ltd', 'Hooli']
const PLANS = ['Starter', 'Scale', 'Enterprise']
const STATUSES = Object.values(SubscriptionStatus)

/** Fixed rows, so the list renders identically on every run. */
function manySubscriptions(count: number, status: 'mixed' | SubscriptionStatus): Subscription[] {
  return Array.from({ length: count }, (_, index) => {
    const rowStatus = status === 'mixed' ? (STATUSES[index % STATUSES.length] ?? 'active') : status
    const started = rowStatus !== SubscriptionStatus.Incomplete
    const month = index % 12
    return {
      id: `sub_${index + 1}`,
      customerId: `cus_${(index % CUSTOMERS.length) + 1}`,
      customerName: `${CUSTOMERS[index % CUSTOMERS.length]}${index >= CUSTOMERS.length ? ` ${Math.floor(index / CUSTOMERS.length) + 1}` : ''}`,
      planId: `plan_${index % PLANS.length}`,
      planName: PLANS[index % PLANS.length] ?? 'Starter',
      status: rowStatus,
      currency: index % 4 === 3 ? 'GBP' : 'USD',
      billingPeriodLabel: index % 3 === 2 ? 'Yearly' : 'Monthly',
      currentPeriodStart: started ? new Date(Date.UTC(2026, month, 4)) : null,
      currentPeriodEnd: started ? new Date(Date.UTC(2026, month + 1, 4)) : null,
      startDate: started ? new Date(Date.UTC(2025, month, 4)) : null,
      createdAt: new Date(Date.UTC(2025, month, 4)),
    }
  })
}

interface SubscriptionsListPageProps {
  /** How many contracts exist. 0 shows the empty state. */
  rows: number
  /** Status given to every contract, or a rotation through all of them. */
  status: 'mixed' | SubscriptionStatus
  isLoading: boolean
  hasError: boolean
  /** The search the page opens with. */
  initialSearch: string
}

/** The contracts route as the console composes it: shell, PageBody, ListState, SubscriptionGrid. */
function SubscriptionsListPage(props: SubscriptionsListPageProps) {
  return (
    <PageShell activeItemId="subscriptions" trail={['Contracts']}>
      <SubscriptionsListBody key={props.initialSearch} {...props} />
    </PageShell>
  )
}

function SubscriptionsListBody({
  rows,
  status,
  isLoading,
  hasError,
  initialSearch,
}: SubscriptionsListPageProps) {
  const [query, setQuery] = useState<SubscriptionQuery>({
    ...DEFAULT_SUBSCRIPTION_QUERY,
    search: initialSearch,
  })
  const all = useMemo(() => manySubscriptions(rows, status), [rows, status])

  const needle = query.search.toLowerCase()
  const matches = all.filter(
    (subscription) =>
      (subscription.customerName.toLowerCase().includes(needle) ||
        subscription.planName.toLowerCase().includes(needle)) &&
      (query.statuses.length === 0 || query.statuses.includes(subscription.status)),
  )
  const isFiltered = query.search.length > 0 || query.statuses.length > 0
  const clearFilters = () => setQuery({ ...query, search: '', statuses: [], page: 1 })

  return (
    <PageBody>
      <ListState
        isLoading={isLoading}
        error={listFailure(hasError, 'contracts')}
        isEmpty={matches.length === 0 && !isFiltered}
        isFiltered={isFiltered}
        onRetry={fn()}
        onClearFilters={clearFilters}
        createAction={<Button onClick={fn()}>New contract</Button>}
        emptyIcon={<RefreshCwIcon aria-hidden />}
        emptyTitle="No contracts yet"
        emptyDescription="A contract puts a customer on a plan and starts their billing cycle."
      >
        <SubscriptionGrid
          subscriptions={paginate(matches, query.page, query.pageSize)}
          total={matches.length}
          query={query}
          onQueryChange={setQuery}
          onSubscriptionClick={fn()}
          onOpenCustomer={fn()}
          onOpenPlan={fn()}
          onCreate={fn()}
          onClearFilters={clearFilters}
          locale="en-US"
        />
      </ListState>
    </PageBody>
  )
}

const meta = {
  title: 'App/Contracts/Contract list',
  component: SubscriptionsListPage,
  tags: ['!autodocs'],
  parameters: PAGE_STORY_PARAMETERS,
  args: { rows: 10, status: 'mixed', isLoading: false, hasError: false, initialSearch: '' },
  argTypes: {
    rows: { control: { type: 'number', min: 0, max: 60, step: 1 } },
    status: { control: 'select', options: ['mixed', ...STATUSES] },
    isLoading: { control: 'boolean' },
    hasError: { control: 'boolean' },
    initialSearch: { control: 'text' },
  },
} satisfies Meta<typeof SubscriptionsListPage>

export default meta
type Story = StoryObj<typeof meta>

/** `/subscriptions` with every control live: drag rows from 0 to 60, pick a status, flip loading and error. */
export const Playground: Story = {}

/** `/subscriptions` for an account with no contracts yet. */
export const Empty: Story = {
  args: { rows: 0 },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText('Nobody is on a plan yet'),
    ).toBeInTheDocument()
  },
}

/** `/subscriptions` with a search that matches nothing. */
export const NoMatches: Story = {
  args: { initialSearch: 'zzz' },
}

/** `/subscriptions` while the first page is loading. */
export const Loading: Story = {
  args: { isLoading: true },
}

/** `/subscriptions` when the request failed. */
export const Failed: Story = {
  args: { hasError: true },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText('Flexprice had a problem loading contracts.'),
    ).toBeInTheDocument()
  },
}
