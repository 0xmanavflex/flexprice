import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import {
  RevenueReport,
  type CustomerRevenueRow,
  type RevenueReportProps,
  type RevenueView,
} from './RevenueReport'

const usd = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)

const MONTHS = ['Jul', 'Aug', 'Sep', 'Oct']
const SERIES = MONTHS.map((label, i) => ({
  label,
  revenue: 38000 + i * 6200,
  previous: 33000 + i * 4000,
}))

const NAMES = [
  'Acme Robotics',
  'Northwind',
  'Globex',
  'Initech',
  'Umbrella',
  'Hooli',
  'Stark Labs',
  'Wayne Ent.',
  'Soylent',
  'Tyrell',
]
const ROWS: CustomerRevenueRow[] = NAMES.map((name, i) => {
  const revenue = 24000 - i * 2100
  const usage = Math.round(revenue * (0.35 + (i % 3) * 0.1))
  return {
    id: `cust_${i}`,
    name,
    revenue,
    usage,
    contract: revenue - usage,
    display: { revenue: usd(revenue), usage: usd(usage), contract: usd(revenue - usage) },
    share: revenue / 180000,
  }
})

const BASE: RevenueReportProps = {
  filters: {
    range: '90d',
    rangeOptions: [
      { id: '30d', label: 'Last 30 days' },
      { id: '90d', label: 'Last 90 days' },
      { id: '12m', label: 'Last 12 months' },
    ],
    onRangeChange: fn(),
    grain: 'auto',
    grainOptions: [
      { id: 'auto', label: 'Auto' },
      { id: 'day', label: 'Daily' },
      { id: 'week', label: 'Weekly' },
      { id: 'month', label: 'Monthly' },
    ],
    onGrainChange: fn(),
    compare: 'none',
    compareOptions: [
      { id: 'none', label: 'No comparison' },
      { id: 'previous', label: 'vs previous period' },
    ],
    onCompareChange: fn(),
    currency: 'USD',
    currencyOptions: [
      { id: 'USD', label: 'USD' },
      { id: 'EUR', label: 'EUR' },
    ],
    onCurrencyChange: fn(),
  },
  rangeLabel: 'last 90 days',
  comparing: false,
  view: 'overview',
  onViewChange: fn(),
  headline: {
    status: 'ready',
    revenue: { value: '$180,400', detail: 'Last 90 days', change: 0.12 },
    arpu: { value: '$4,295', detail: '42 billed customers', change: 0.04 },
    outstanding: { value: '$38,210', detail: 'As of today' },
    overdue: { value: '$9,870', detail: '26% of outstanding' },
  },
  revenue: {
    status: 'ready',
    total: { value: '$180,400', change: 0.12 },
    usage: { value: '$71,300', change: 0.21 },
    contract: { value: '$109,100', change: 0.06 },
    usageShare: '40%',
    grain: 'month',
    series: SERIES,
  },
  customers: {
    status: 'ready',
    rows: ROWS,
    billed: 42,
    arpu: { value: '$4,295', change: 0.04 },
    topTenShare: '78%',
    onOpenCustomer: fn(),
  },
  receivables: {
    status: 'ready',
    outstanding: '$38,210',
    overdue: '$9,870',
    overdueShare: '26%',
    notYetDue: '$26,140',
    noDueDate: '$2,200',
    buckets: [
      { id: 'current', label: 'Not yet due', amount: 26140, display: '$26.1K', tone: 'neutral' },
      { id: 'd30', label: '1–30 days', amount: 5200, display: '$5.2K', tone: 'warning' },
      { id: 'd60', label: '31–60 days', amount: 2400, display: '$2.4K', tone: 'warning' },
      { id: 'd90', label: '61–90 days', amount: 1300, display: '$1.3K', tone: 'critical' },
      { id: 'd90p', label: '90+ days', amount: 970, display: '$970', tone: 'critical' },
    ],
    customers: [
      {
        id: 'cust_3',
        name: 'Initech',
        invoices: 3,
        overdue: 4200,
        display: { overdue: '$4,200', outstanding: '$6,100' },
        oldestDays: 64,
      },
      {
        id: 'cust_5',
        name: 'Hooli',
        invoices: 1,
        overdue: 1900,
        display: { overdue: '$1,900', outstanding: '$1,900' },
        oldestDays: 12,
      },
    ],
    basedOn: 'From the latest 200 invoices.',
    onOpenCustomer: fn(),
  },
  payments: {
    status: 'ready',
    average: { value: '11 days', change: -0.08, lowerIsBetter: true },
    median: '7 days',
    paidCount: 128,
    withinWeek: '52%',
    series: MONTHS.map((label, i) => ({ label, days: 14 - i })),
    payers: [
      { id: 'cust_3', name: 'Initech', paid: 6, collected: '$12,400', averageDays: 24 },
      { id: 'cust_1', name: 'Northwind', paid: 9, collected: '$19,800', averageDays: 9 },
    ],
  },
  usage: {
    status: 'ready',
    series: Array.from({ length: 30 }, (_, i) => ({
      label: `Oct ${i + 1}`,
      events: 18000 + Math.round(6000 * Math.sin(i / 3)) + i * 300,
    })),
    total: '612K',
    weeklyAverage: '20.4K',
    peak: '29.1K',
    creditsReason:
      'Flexprice has no tenant-wide wallet report yet, so credits are shown per customer on their Wallet tab.',
  },
}

function Harness(props: RevenueReportProps) {
  const [view, setView] = useState<RevenueView>(props.view)
  const [compare, setCompare] = useState(props.filters.compare)
  return (
    <RevenueReport
      {...props}
      view={view}
      onViewChange={(next) => {
        setView(next)
        props.onViewChange(next)
      }}
      comparing={compare !== 'none'}
      filters={{ ...props.filters, compare, onCompareChange: setCompare }}
    />
  )
}

const meta = {
  title: 'App/Revenue/Revenue report',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } },
  },
  args: BASE,
} satisfies Meta<typeof Harness>

export default meta
type Story = StoryObj<typeof meta>

/** Filters, four headline tiles, report tabs, then Overview's panels. */
export const Overview: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Revenue', level: 1 })).toBeVisible()
    await expect(canvas.getByText('ARPU')).toBeVisible()
    await expect(canvas.getByText('Receivables aging')).toBeVisible()
    await expect(canvas.getByText('Top 5 customers')).toBeVisible()
  },
}

/** Each tab is one report. */
export const SwitchingTabs: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: 'Customers' }))
    await expect(args.onViewChange).toHaveBeenCalledWith('customers')
    await expect(await canvas.findByText('Top 10 customers')).toBeVisible()
    await userEvent.click(canvas.getByRole('tab', { name: 'Receivables' }))
    await expect(await canvas.findByText('Overdue customers')).toBeVisible()
  },
}

export const RevenueTab: Story = { args: { view: 'revenue' } }
export const Customers: Story = { args: { view: 'customers' } }
export const Receivables: Story = { args: { view: 'receivables' } }
export const Payments: Story = { args: { view: 'payments' } }

/** Wallet credits have no tenant-wide report: the panel says so instead of drawing zeros. */
export const Usage: Story = {
  args: { view: 'usage' },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/no tenant-wide wallet report/),
    ).toBeVisible()
  },
}

export const Comparing: Story = {
  args: { comparing: true, filters: { ...BASE.filters, compare: 'previous' } },
}

export const Loading: Story = {
  args: {
    headline: { ...BASE.headline, status: 'loading' },
    revenue: { ...BASE.revenue, status: 'loading' },
    receivables: { ...BASE.receivables, status: 'loading' },
    payments: { ...BASE.payments, status: 'loading' },
    customers: { ...BASE.customers, status: 'loading' },
    usage: { ...BASE.usage, status: 'loading' },
  },
}

/** A failed report says so, with a retry, and the others still render. */
export const ReportFailed: Story = {
  args: {
    revenue: {
      ...BASE.revenue,
      status: 'error',
      reason: 'The revenue report did not respond.',
      onRetry: fn(),
    },
  },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText('The revenue report did not respond.'),
    ).toBeVisible()
  },
}
