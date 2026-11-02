import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { money, type Rollforward, type RollforwardRow } from '@fp/domain'
import { AccountRollforward } from './AccountRollforward'

const usd = (amount: string) => money(amount, 'USD')
const row = (
  customerId: string | null,
  contractId: string | null,
  [opening, invoiced, earned, adjustments, closing]: string[],
): RollforwardRow => ({
  customerId,
  contractId,
  opening: usd(opening ?? '0'),
  invoiced: usd(invoiced ?? '0'),
  earned: usd(earned ?? '0'),
  adjustments: usd(adjustments ?? '0'),
  closing: usd(closing ?? '0'),
})

/** Acme prepaid a year in January; Globex was invoiced this month and earned it all. */
const ROLLFORWARD: Rollforward = {
  period: '2026-03',
  totals: row(null, null, ['1000', '300', '-400', '0', '900']),
  rows: [
    row('cust_acme', 'contract_acme', ['1000', '0', '-100', '0', '900']),
    row('cust_globex', 'contract_globex', ['0', '300', '-300', '0', '0']),
  ],
  count: 2,
}

const meta = {
  title: 'App/Revenue/Deferred rollforward',
  component: AccountRollforward,
  args: {
    account: 'deferred_revenue',
    rollforward: ROLLFORWARD,
    customerNames: { cust_acme: 'Acme', cust_globex: 'Globex' },
    contracts: {},
    isLoading: false,
    search: '',
    onSearchChange: fn(),
    period: '2026-03',
    periodOptions: [{ id: '2026-03', label: 'Mar 2026' }],
    onPeriodChange: fn(),
    page: 1,
    pageSize: 50,
    onPageChange: fn(),
    selected: null,
    onSelect: fn(),
    entries: undefined,
    entriesLoading: false,
  },
} satisfies Meta<typeof AccountRollforward>

export default meta
type Story = StoryObj<typeof meta>

/** Beginning 1,000 + invoiced 300 − earned 400 = ending 900. */
export const March: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Deferred rollforward')).toBeVisible()
    await expect(canvas.getByText('Globex')).toBeVisible()
    await expect(canvas.getAllByText('$900.00')[0]).toBeVisible()
  },
}

export const Unbilled: Story = { args: { account: 'unbilled_receivable' } }

export const Loading: Story = { args: { rollforward: undefined, isLoading: true } }
