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
  title: 'Surfaces/SubscriptionGrid',
  component: SubscriptionGrid,
  parameters: { layout: 'padded' },
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

/**
 * "Past due" is not offered, because it is not a subscription status.
 *
 * It is a property of an invoice — finalized, with a balance, past its due
 * date. Offering it here would send a request the API cannot filter and show
 * every subscription under a control insisting the list was narrowed.
 * `Incomplete`, which is real and was previously unreachable, takes a place
 * instead.
 */
export const PastDueIsNotAStatus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('combobox', { name: /status/i }))
    const listbox = within(await within(document.body).findByRole('listbox'))

    await expect(listbox.queryByRole('option', { name: /past due/i })).not.toBeInTheDocument()
    await expect(listbox.getByRole('option', { name: /incomplete/i })).toBeInTheDocument()
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

export const StatusDropdown: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('combobox', { name: /status/i }))
    const listbox = within(await within(document.body).findByRole('listbox'))
    await userEvent.click(listbox.getByRole('option', { name: /^paused$/i }))

    const spy = args.onQueryChange as unknown as { mock: { calls: unknown[][] } }
    await waitFor(() =>
      expect(
        spy.mock.calls
          .map((call) => call[0] as { statuses?: string[] })
          .some((query) => query.statuses?.[0] === SubscriptionStatus.Paused),
      ).toBe(true),
    )

    // Let the select finish closing: while a Base UI popup is mounted its focus
    // guards are aria-hidden *and* focusable, which axe rejects if the scan
    // lands mid-animation. This waits for the settled state; it asserts nothing less.
    await waitFor(() => expect(within(document.body).queryByRole('listbox')).toBeNull())
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
      await within(canvasElement).findByText(/no subscriptions match these filters/i),
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
    error: 'You do not have access to subscriptions in this environment.',
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
