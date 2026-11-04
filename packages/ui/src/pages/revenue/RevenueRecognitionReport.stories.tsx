import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { money, type RevenueMonth, type RevenueWaterfall } from '@fp/domain'
import { RevenueRecognitionReport } from './RevenueRecognitionReport'

const usd = (amount: string) => money(amount, 'USD')
const PERIODS = ['2026-01', '2026-02', '2026-03']

const month = (
  period: string,
  total: string,
  deferred: string | null,
  unbilled: string | null,
): RevenueMonth => ({
  period,
  total: usd(total),
  actual: period === '2026-03' ? usd('0') : usd(total),
  pending: period === '2026-03' ? usd(total) : usd('0'),
  scheduled: usd('0'),
  deferred: deferred === null ? null : usd(deferred),
  unbilled: unbilled === null ? null : usd(unbilled),
})

/** Acme ($1,200/year prepaid) and Globex ($300/month in arrears), Jan–Mar; March not posted yet. */
const WATERFALL: RevenueWaterfall = {
  periods: PERIODS,
  rows: [
    {
      id: 'cust_acme',
      months: [
        month('2026-01', '100', '1100', '0'),
        month('2026-02', '100', '1000', '0'),
        month('2026-03', '100', null, null),
      ],
      total: usd('300'),
      earned: usd('300'),
      scheduled: usd('0'),
    },
    {
      id: 'cust_globex',
      months: [
        month('2026-01', '300', '0', '300'),
        month('2026-02', '300', '0', '300'),
        month('2026-03', '300', null, null),
      ],
      total: usd('900'),
      earned: usd('900'),
      scheduled: usd('0'),
    },
  ],
  totals: [
    month('2026-01', '400', '1100', '300'),
    month('2026-02', '400', '1000', '300'),
    month('2026-03', '400', null, null),
  ],
  total: usd('1200'),
  count: 2,
}

const meta = {
  title: 'App/Revenue/Revenue recognition',
  component: RevenueRecognitionReport,
  args: {
    waterfall: WATERFALL,
    recognizedThrough: new Date('2026-02-28T00:00:00Z'),
    customerNames: { cust_acme: 'Acme', cust_globex: 'Globex' },
    isLoading: false,
    from: '2026-01',
    to: '2026-03',
    monthOptions: PERIODS.map((id) => ({ id, label: id })),
    onRangeChange: fn(),
    search: '',
    onSearchChange: fn(),
    details: false,
    onDetailsChange: fn(),
    page: 1,
    pageSize: 50,
    onPageChange: fn(),
    onOpenCustomer: fn(),
  },
} satisfies Meta<typeof RevenueRecognitionReport>

export default meta
type Story = StoryObj<typeof meta>

export const Summary: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Revenue total')).toBeVisible()
    await expect(canvas.getByText('Globex')).toBeVisible()
    await expect(canvas.getByText('Recognized through Feb 28, 2026')).toBeVisible()
  },
}

/** Details on: each customer also shows month-end deferred and unbilled. */
export const WithDetails: Story = {
  args: { details: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByText('Deferred')[0]).toBeVisible()
    await expect(canvas.getAllByText('$1,100.00')[0]).toBeVisible()
  },
}

export const Loading: Story = { args: { waterfall: undefined, isLoading: true } }

/** Revenue recognition is off for the environment: an explanation and a way to ask, not an error. */
export const NotEnabled: Story = {
  args: { waterfall: undefined, notEnabled: true, onContact: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("Revenue recognition isn't enabled yet")).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Contact us to enable it' })).toBeVisible()
    await expect(canvas.queryByRole('search')).toBeNull()
  },
}
