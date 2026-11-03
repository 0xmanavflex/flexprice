import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { money } from '@fp/domain'
import { DashboardHome } from '@ui/pages/home/DashboardHome'
import type { DashboardHomeProps, PanelStatus } from '@ui/pages/home/DashboardHome'
import { PAGE_STORY_PARAMETERS, PageShell } from '../shared/shellFixtures'

const RANGE_OPTIONS = [
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
]
const GRANULARITY_OPTIONS = [
  { id: 'daily', label: 'Daily' },
  { id: 'hourly', label: 'Hourly' },
]
const PANEL_STATUSES: PanelStatus[] = ['ready', 'loading', 'empty', 'unavailable']
const PLAN_POOL = ['Studio', 'Growth', 'Starter', 'Platform']

interface HomePageProps {
  /** Every panel's state at once: ready, loading, empty or unavailable. */
  status: PanelStatus
  range: string
  granularity: string
  /** Buckets on the events chart and the contracts stack. */
  dayCount: number
  eventsPerDay: number
  plansShown: number
  paid: number
  open: number
  overdue: number
}

/** Builds the four panels. Panels that are not ready carry no data, as on the real page. */
function makePanels(
  args: HomePageProps,
): Pick<DashboardHomeProps, 'events' | 'subscriptions' | 'invoices'> {
  const ready = args.status === 'ready'
  const labels = Array.from({ length: args.dayCount }, (_, index) => `Day ${index + 1}`)
  const plans = PLAN_POOL.slice(0, args.plansShown)

  const points = ready
    ? labels.map((label, index) => ({
        label,
        events: Math.round(args.eventsPerDay * (0.8 + ((index * 7) % 5) * 0.1)),
      }))
    : []
  const days =
    ready && plans.length > 0
      ? labels.map((label, index) => ({
          label,
          byPlan: Object.fromEntries(
            plans.map((plan, planIndex) => [plan, (index + planIndex) % 3]),
          ),
        }))
      : []
  const planCounts = plans.map((name) => ({
    name,
    count: days.reduce((sum, day) => sum + (day.byPlan[name] ?? 0), 0),
  }))
  const subscriptionTotal = planCounts.reduce((sum, plan) => sum + plan.count, 0)

  return {
    events: {
      status: args.status,
      points,
      total: ready ? points.reduce((sum, point) => sum + point.events, 0) : null,
      revenue: ready ? money('184210.00', 'USD') : null,
    },
    subscriptions: {
      status: args.status,
      total: subscriptionTotal,
      changePercent: subscriptionTotal > 0 ? 12 : null,
      days,
      plans: planCounts,
    },
    invoices: {
      status: args.status,
      total: ready ? args.paid + args.open + args.overdue : 0,
      paid: ready ? args.paid : 0,
      open: ready ? args.open : 0,
      overdue: ready ? args.overdue : 0,
    },
  }
}

/** The home route as the console composes it: shell, then the overview. */
function HomePage(args: HomePageProps) {
  const [range, setRange] = useState(args.range)
  const [granularity, setGranularity] = useState(args.granularity)
  useEffect(() => setRange(args.range), [args.range])
  useEffect(() => setGranularity(args.granularity), [args.granularity])

  const rangeLabel = (
    RANGE_OPTIONS.find((option) => option.id === range)?.label ?? range
  ).toLowerCase()

  return (
    <PageShell activeItemId="home" trail={['Home']}>
      <DashboardHome
        rangeOptions={RANGE_OPTIONS}
        range={range}
        onRangeChange={setRange}
        granularityOptions={GRANULARITY_OPTIONS}
        granularity={granularity}
        onGranularityChange={setGranularity}
        rangeLabel={rangeLabel}
        {...makePanels(args)}
        onNavigate={fn()}
      />
    </PageShell>
  )
}

const meta = {
  title: 'App/Home/Home',
  component: HomePage,
  tags: ['!autodocs'],
  parameters: PAGE_STORY_PARAMETERS,
  args: {
    status: 'ready',
    range: '7d',
    granularity: 'daily',
    dayCount: 7,
    eventsPerDay: 750_000,
    plansShown: 4,
    paid: 34,
    open: 15,
    overdue: 7,
  },
  argTypes: {
    status: { control: 'select', options: PANEL_STATUSES },
    range: { control: 'inline-radio', options: RANGE_OPTIONS.map((option) => option.id) },
    granularity: {
      control: 'inline-radio',
      options: GRANULARITY_OPTIONS.map((option) => option.id),
    },
    dayCount: { control: { type: 'range', min: 0, max: 30, step: 1 } },
    eventsPerDay: { control: { type: 'number', min: 0, max: 5_000_000, step: 50_000 } },
    plansShown: { control: { type: 'range', min: 0, max: PLAN_POOL.length, step: 1 } },
    paid: { control: { type: 'number', min: 0, max: 500, step: 1 } },
    open: { control: { type: 'number', min: 0, max: 500, step: 1 } },
    overdue: { control: { type: 'number', min: 0, max: 500, step: 1 } },
  },
} satisfies Meta<typeof HomePage>

export default meta
type Story = StoryObj<typeof meta>

/** `/` with every control live: flip all panels between states and size the data behind them. */
export const Playground: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole('heading', { level: 1, name: 'Overview' }),
    ).toBeInTheDocument()
  },
}

/** `/` for a workspace that has produced no data yet. */
export const FirstRun: Story = {
  args: { status: 'empty' },
}

/** `/` while every panel is still loading. */
export const Loading: Story = {
  args: { status: 'loading' },
}

/** `/` when Flexprice cannot answer: each panel names the missing metric and why. */
export const Unavailable: Story = {
  args: { status: 'unavailable' },
}
