import { type ComponentProps, useMemo, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import {
  DEFAULT_SUBSCRIPTION_QUERY,
  type Subscription,
  type SubscriptionQuery,
  SubscriptionStatus,
} from '@fp/domain'
import { SubscriptionGrid } from './SubscriptionGrid'

const meta = {
  title: 'App/Contracts/Contract table',
  component: SubscriptionGrid,
  parameters: {
    layout: 'padded',
    // Base UI's menu portal focus guards — see FilterBar.stories.tsx.
    a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } },
  },
  args: {
    subscriptions: subscriptionFixtures(),
    total: 4,
    query: { ...DEFAULT_SUBSCRIPTION_QUERY } satisfies SubscriptionQuery,
    onQueryChange: fn(),
    locale: 'en-US',
  },
} satisfies Meta<typeof SubscriptionGrid>

export default meta
type Story = StoryObj<typeof meta>

function subscriptionFixtures(): Subscription[] {
  return [
    {
      id: 'sub_01',
      customerId: 'cus_01',
      customerName: 'Acme Robotics',
      planId: 'plan_scale',
      planName: 'Scale',
      status: SubscriptionStatus.Active,
      currency: 'USD',
      billingPeriodLabel: 'Monthly',
      currentPeriodStart: new Date('2026-09-04T00:00:00Z'),
      currentPeriodEnd: new Date('2026-10-04T00:00:00Z'),
      startDate: new Date('2025-04-19T00:00:00Z'),
      createdAt: new Date('2025-04-19T00:00:00Z'),
    },
    {
      id: 'sub_02',
      customerId: 'cus_02',
      customerName: 'Globex',
      planId: 'plan_starter',
      planName: 'Starter',
      status: SubscriptionStatus.Trialing,
      currency: 'USD',
      billingPeriodLabel: 'Monthly',
      currentPeriodStart: new Date('2026-09-20T00:00:00Z'),
      currentPeriodEnd: new Date('2026-10-20T00:00:00Z'),
      startDate: new Date('2026-09-20T00:00:00Z'),
      createdAt: new Date('2026-09-20T00:00:00Z'),
    },
    {
      // No period at all: a subscription that has not started billing. The
      // column dashes rather than inventing half a range.
      id: 'sub_03',
      customerId: 'cus_03',
      customerName: 'Initech',
      planId: 'plan_scale',
      planName: 'Scale',
      status: SubscriptionStatus.Incomplete,
      currency: 'USD',
      billingPeriodLabel: 'Yearly',
      currentPeriodStart: null,
      currentPeriodEnd: null,
      startDate: null,
      createdAt: new Date('2026-09-25T00:00:00Z'),
    },
    {
      id: 'sub_04',
      customerId: 'cus_04',
      customerName: 'Umbrella Ltd',
      planId: 'plan_enterprise',
      planName: 'Enterprise',
      status: SubscriptionStatus.Cancelled,
      currency: 'GBP',
      billingPeriodLabel: 'Yearly',
      currentPeriodStart: new Date('2025-12-01T00:00:00Z'),
      currentPeriodEnd: new Date('2026-12-01T00:00:00Z'),
      startDate: new Date('2023-12-01T00:00:00Z'),
      createdAt: new Date('2023-12-01T00:00:00Z'),
    },
  ]
}

/** A deterministic page-worth of subscriptions: the fixtures, cycled with unique ids. */
function manySubscriptions(count: number): Subscription[] {
  const base = subscriptionFixtures()
  return Array.from({ length: count }, (_, index) => {
    const item = base[index % base.length] as Subscription
    return {
      ...item,
      id: `sub_page_${index}`,
      customerId: `cus_page_${index}`,
      customerName: `${item.customerName} ${index}`,
    }
  })
}

export const Default: Story = {}

/**
 * "Current period" is a range, and both ends or nothing.
 *
 * A lone end date is a renewal date wearing a period's label, so a
 * subscription that has not started billing dashes rather than showing half
 * a range.
 */
export const CurrentPeriodIsARange: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(await canvas.findByText('Acme Robotics')).toBeInTheDocument()
    await expect(canvas.getByText(/Sep 4, 2026\s+–\s+Oct 4, 2026/)).toBeInTheDocument()
    // Initech has neither end of the period.
    await expect(canvas.getAllByText('—').length).toBeGreaterThan(0)
  },
}

/** MRR is not a column: it is not a field anywhere in the API. */
export const NoMrrColumn: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('Acme Robotics')

    const headers = Array.from(canvasElement.querySelectorAll('thead th')).map((th) =>
      (th.textContent ?? '').trim().toLowerCase(),
    )
    await expect(headers).not.toContain('mrr')
    await expect(headers).toContain('current period')
  },
}

/** The shared table's geometry, as this surface renders it. */
export const Layout: Story = {
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText('Acme Robotics')

    const header = canvasElement.querySelector('thead th') as HTMLElement
    await expect(Math.round(header.getBoundingClientRect().height)).toBe(44)

    const cell = canvasElement.querySelector('tbody td') as HTMLElement
    await expect(Math.round(cell.getBoundingClientRect().height)).toBe(60)
  },
}

/** A click on the customer name opens the contract, not the customer. */
export const RowOpensContract: Story = {
  args: { onSubscriptionClick: fn(), onOpenCustomer: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByText('Acme Robotics'))
    await expect(args.onSubscriptionClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sub_01' }),
    )
    await expect(args.onOpenCustomer).not.toHaveBeenCalled()
  },
}

/** A running contract's menu reaches its customer and plan, and can cancel it. */
export const RowActionsCancel: Story = {
  args: { onCancelSubscription: fn(), onOpenCustomer: fn(), onOpenPlan: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click((await canvas.findAllByRole('button', { name: 'Row actions' }))[0]!)
    const body = within(document.body)
    await expect(await body.findByRole('menuitem', { name: /view customer/i })).toBeVisible()
    await expect(body.getByRole('menuitem', { name: /view plan/i })).toBeVisible()
    await userEvent.click(body.getByRole('menuitem', { name: /cancel contract/i }))
    await expect(args.onCancelSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sub_01' }),
    )
  },
}

export const Loading: Story = { args: { subscriptions: [], total: 0, isLoading: true } }

export const FilteredEmpty: Story = {
  args: {
    subscriptions: [],
    total: 0,
    query: { ...DEFAULT_SUBSCRIPTION_QUERY, search: 'zzz' },
    onClearFilters: fn(),
  },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/no contracts match these filters/i),
    ).toBeInTheDocument()
  },
}

export const FirstRun: Story = {
  args: { subscriptions: [], total: 0, onCreate: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Nobody is on a plan yet')).toBeInTheDocument()
    await expect(canvas.getAllByText('Read docs')).toHaveLength(3)
  },
}

export const Error: Story = {
  args: {
    subscriptions: [],
    total: 0,
    error: 'You do not have access to contracts in this environment.',
    onRetry: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: /try again/i }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}

export const PaginationReportsDomainQuery: Story = {
  args: { total: 120 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.click(await canvas.findByRole('button', { name: /next|go to next page/i }))

    const spy = args.onQueryChange as unknown as { mock: { calls: unknown[][] } }
    const reportedPage = () =>
      spy.mock.calls.map((call) => call[0] as Record<string, unknown>).find((q) => q['page'] === 2)
    await waitFor(() => expect(reportedPage()).toBeDefined())
    const reported = reportedPage() as Record<string, unknown>
    expect(reported).toMatchObject({ page: 2 })
    expect(Object.keys(reported).sort()).toEqual(Object.keys(DEFAULT_SUBSCRIPTION_QUERY).sort())
  },
}

/** Overrides every row's status so one state can be inspected across a long list. */
function withStatus<T extends { status: unknown }>(items: T[], status: string): T[] {
  return status === 'mixed' ? items : items.map((item) => ({ ...item, status }) as T)
}

type PlaygroundArgs = Omit<
  ComponentProps<typeof SubscriptionGrid>,
  'subscriptions' | 'total' | 'query' | 'onQueryChange' | 'error'
> & {
  /** How many records the server holds, 0 to 60. */
  rows: number
  /** The page shown, 1-based. */
  page: number
  pageSize: number
  /** Forces every row to one status; mixed keeps the fixture spread. */
  status: 'mixed' | SubscriptionStatus
  /** Shows the error state instead of the list. */
  hasError: boolean
}

function SubscriptionGridPlayground({
  rows,
  page,
  pageSize,
  status,
  hasError,
  ...rest
}: PlaygroundArgs) {
  const [query, setQuery] = useState<SubscriptionQuery>({
    ...DEFAULT_SUBSCRIPTION_QUERY,
    page,
    pageSize,
  })
  const all = useMemo(() => withStatus(manySubscriptions(rows), status), [rows, status])
  const lastPage = Math.max(1, Math.ceil(all.length / query.pageSize))
  const current = Math.min(query.page, lastPage)
  const start = (current - 1) * query.pageSize
  return (
    <SubscriptionGrid
      locale="en-US"
      {...rest}
      subscriptions={all.slice(start, start + query.pageSize)}
      total={all.length}
      query={{ ...query, page: current }}
      onQueryChange={setQuery}
      error={hasError ? 'You do not have access to contracts in this environment.' : null}
    />
  )
}

/** Drag rows from 0 to 60 to walk empty, one page, and a long list; flip loading and error. */
export const Playground: StoryObj<PlaygroundArgs> = {
  parameters: { controls: { exclude: /^(subscriptions|total|query|error|on[A-Z].*)$/ } },
  args: {
    rows: 30,
    page: 1,
    pageSize: 10,
    status: 'mixed',
    isLoading: false,
    hasError: false,
    onRetry: fn(),
    onCreate: fn(),
    onSubscriptionClick: fn(),
    onOpenCustomer: fn(),
    onOpenPlan: fn(),
  },
  argTypes: {
    rows: { control: { type: 'number', min: 0, max: 60, step: 1 } },
    page: { control: { type: 'number', min: 1, max: 6, step: 1 } },
    pageSize: { control: 'select', options: [10, 25, 50] },
    status: { control: 'select', options: ['mixed', ...Object.values(SubscriptionStatus)] },
    isLoading: { control: 'boolean' },
    hasError: { control: 'boolean' },
  },
  render: (args) => <SubscriptionGridPlayground key={`${args.page}-${args.pageSize}`} {...args} />,
}
