import { useMemo, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { UsersIcon } from '@ui/icons'
import {
  type Customer,
  CustomerStatus,
  DEFAULT_CUSTOMER_QUERY,
  type CustomerQuery,
} from '@fp/domain'
import { ListState, PageBody } from '@ui/compositions'
import { CustomerGrid } from '@ui/pages/customers/CustomerGrid'
import { Button } from '@ui/components/primitives/button'
import { PAGE_STORY_PARAMETERS, PageShell, listFailure, paginate } from '../shared/shellFixtures'

const NAMES = ['Acme Robotics', 'Globex', 'Initech', 'Umbrella Ltd', 'Hooli', 'Stark Industries']
const COUNTRIES = ['US', 'CA', 'GB', 'DE', 'IN', '']

/** Fixed rows, so the list renders identically on every run. */
function manyCustomers(count: number, status: 'mixed' | CustomerStatus): Customer[] {
  return Array.from({ length: count }, (_, index) => {
    const lap = Math.floor(index / NAMES.length)
    const name = `${NAMES[index % NAMES.length]}${lap > 0 ? ` ${lap + 1}` : ''}`
    return {
      id: `cus_${index + 1}`,
      name,
      email: index % 6 === 2 ? '' : `billing@${name.toLowerCase().replace(/\W+/g, '')}.example`,
      externalId: index % 6 === 2 ? '' : `ext-${1000 + index}`,
      addressCountry: COUNTRIES[index % COUNTRIES.length] ?? '',
      status:
        status === 'mixed'
          ? index % 7 === 6
            ? CustomerStatus.Archived
            : CustomerStatus.Published
          : status,
      createdAt: new Date(Date.UTC(2025, index % 12, 1 + (index % 27))),
      updatedAt: index % 6 === 2 ? null : new Date(Date.UTC(2026, index % 9, 1 + (index % 27))),
      integrations:
        index % 3 === 0
          ? [{ id: 'stripe', name: 'Stripe', providerType: 'stripe' }]
          : index % 3 === 1
            ? [
                { id: 'stripe', name: 'Stripe', providerType: 'stripe' },
                { id: 'quickbooks', name: 'QuickBooks', providerType: 'quickbooks' },
              ]
            : [],
    }
  })
}

interface CustomersListPageProps {
  /** How many customers exist in the account. 0 shows the empty state. */
  rows: number
  /** Status given to every customer, or a mix. */
  status: 'mixed' | CustomerStatus
  isLoading: boolean
  hasError: boolean
  /** The search the page opens with. */
  initialSearch: string
}

/** The customers route as the console composes it: shell, PageBody, ListState, CustomerGrid. */
function CustomersListPage({
  rows,
  status,
  isLoading,
  hasError,
  initialSearch,
}: CustomersListPageProps) {
  return (
    <PageShell activeItemId="customers" trail={['Customers']}>
      <CustomersListBody
        key={initialSearch}
        rows={rows}
        status={status}
        isLoading={isLoading}
        hasError={hasError}
        initialSearch={initialSearch}
      />
    </PageShell>
  )
}

function CustomersListBody({
  rows,
  status,
  isLoading,
  hasError,
  initialSearch,
}: CustomersListPageProps) {
  const [query, setQuery] = useState<CustomerQuery>({
    ...DEFAULT_CUSTOMER_QUERY,
    search: initialSearch,
  })
  const all = useMemo(() => manyCustomers(rows, status), [rows, status])

  const matches = all.filter(
    (customer) =>
      customer.name.toLowerCase().includes(query.search.toLowerCase()) &&
      (query.statuses.length === 0 || query.statuses.includes(customer.status)),
  )
  const isFiltered = query.search.length > 0 || query.statuses.length > 0
  const clearFilters = () => setQuery({ ...query, search: '', statuses: [], page: 1 })

  return (
    <PageBody>
      <ListState
        isLoading={isLoading}
        error={listFailure(hasError, 'customers')}
        isEmpty={matches.length === 0 && !isFiltered}
        isFiltered={isFiltered}
        onRetry={fn()}
        onClearFilters={clearFilters}
        createAction={<Button onClick={fn()}>New customer</Button>}
        emptyIcon={<UsersIcon aria-hidden />}
        emptyTitle="No customers yet"
        emptyDescription="Customers are who you bill. Each carries contracts, invoices and a payment history."
      >
        <CustomerGrid
          customers={paginate(matches, query.page, query.pageSize)}
          total={matches.length}
          query={query}
          onQueryChange={setQuery}
          onCustomerClick={fn()}
          onCreate={fn()}
          onEdit={fn()}
          onDelete={fn()}
          onClearFilters={clearFilters}
          locale="en-US"
        />
      </ListState>
    </PageBody>
  )
}

const meta = {
  title: 'App/Customers/Customer list',
  component: CustomersListPage,
  tags: ['!autodocs'],
  parameters: PAGE_STORY_PARAMETERS,
  args: {
    rows: 12,
    status: 'mixed',
    isLoading: false,
    hasError: false,
    initialSearch: '',
  },
  argTypes: {
    rows: { control: { type: 'number', min: 0, max: 60, step: 1 } },
    status: { control: 'select', options: ['mixed', ...Object.values(CustomerStatus)] },
    isLoading: { control: 'boolean' },
    hasError: { control: 'boolean' },
    initialSearch: { control: 'text' },
  },
} satisfies Meta<typeof CustomersListPage>

export default meta
type Story = StoryObj<typeof meta>

/** `/customers` with every control live: drag rows from 0 to 60, flip loading and error. */
export const Playground: Story = {}

/** `/customers` with a populated page of customers. */
export const Populated: Story = {
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('Acme Robotics')).toBeInTheDocument()
  },
}

/** `/customers` for an account with no customers yet. */
export const Empty: Story = {
  args: { rows: 0 },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('Nobody to bill yet')).toBeInTheDocument()
  },
}

/** `/customers` with a search that matches nothing. */
export const NoMatches: Story = {
  args: { rows: 12, initialSearch: 'zzz' },
}

/** `/customers` while the first page is loading. */
export const Loading: Story = {
  args: { isLoading: true },
}

/** `/customers` when the request failed. */
export const Failed: Story = {
  args: { hasError: true },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText('Flexprice had a problem loading customers.'),
    ).toBeInTheDocument()
  },
}
