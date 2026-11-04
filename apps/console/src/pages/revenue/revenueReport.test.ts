import { describe, expect, it } from 'vitest'
import { InvoiceStatus, PaymentStatus, money, type Invoice, type Payment } from '@fp/domain'
import { parseRevenueSearch } from '@/app/revenueSearch'
import {
  agingTotals,
  change,
  eventsWindow,
  customerRows,
  daysToPay,
  creditRows,
  largestCurrency,
  creditTypeRows,
  previousWindow,
  rangeWindow,
  resolveGrain,
  receivables,
  alignToWindow,
  revenueSeries,
} from './revenueReport'

const NOW = new Date('2026-10-15T12:00:00Z')
const day = (iso: string) => new Date(`${iso}T00:00:00Z`)

function invoice(patch: Partial<Invoice>): Invoice {
  return {
    id: 'inv',
    number: 'INV-1',
    customerId: 'cust_1',
    customerName: 'Acme',
    status: InvoiceStatus.Open,
    amountDue: money('100', 'USD'),
    amountRemaining: money('100', 'USD'),
    dueDate: null,
    issuedAt: day('2026-09-01'),
    ...patch,
  } as Invoice
}

describe('windows', () => {
  it('ends a range now and buckets it by its grain', () => {
    const window = rangeWindow('90d', NOW)
    expect(window.end).toEqual(NOW)
    expect(window.grain).toBe('week')
    expect(rangeWindow('12m', NOW).grain).toBe('month')
    expect(rangeWindow('month', NOW).start).toEqual(day('2026-10-01'))
  })

  it('counts last 30 and 90 days as exactly that many days, today included', () => {
    const now = new Date('2026-11-04T12:00:00Z')
    expect(rangeWindow('30d', now).start).toEqual(day('2026-10-06'))
    expect(rangeWindow('90d', now).start).toEqual(day('2026-08-07'))
    expect(alignToWindow([], rangeWindow('30d', now), 'day')).toHaveLength(30)
  })

  it('puts the comparison window immediately before, the same length', () => {
    const window = { start: day('2026-10-01'), end: day('2026-10-11') }
    expect(previousWindow(window)).toEqual({ start: day('2026-09-21'), end: day('2026-10-01') })
  })
})

describe('largestCurrency', () => {
  it('picks the currency with the most revenue, not the first listed', () => {
    const revenue: Record<string, number> = { EUR: 12, INR: 0, USD: 48_000 }
    expect(largestCurrency(['EUR', 'INR', 'USD'], (code) => revenue[code] ?? 0)).toBe('USD')
  })

  it('falls back to the first listed when nothing was billed', () => {
    expect(largestCurrency(['EUR', 'USD'], () => 0)).toBe('EUR')
    expect(largestCurrency([], () => 0)).toBeUndefined()
  })
})

describe('alignToWindow', () => {
  it('keeps every month in the window, with quiet months as zero', () => {
    const window = rangeWindow('12m', NOW)
    const points = alignToWindow(
      [
        { at: day('2026-09-01'), value: 800 },
        { at: day('2026-10-01'), value: 6900 },
      ],
      window,
      'month',
    )
    expect(points).toHaveLength(12)
    expect(points.map((point) => point.label).slice(-2)).toEqual(['Sep', 'Oct'])
    expect(points.map((point) => point.value).slice(0, 10)).toEqual(Array(10).fill(0))
    expect(points.map((point) => point.value).slice(-2)).toEqual([800, 6900])
  })
})

describe('revenueSeries', () => {
  it('sums days into buckets for one currency, keeping empty buckets as zero', () => {
    const window = { start: day('2026-10-01'), end: day('2026-10-04') }
    const points = revenueSeries(
      [
        { day: '2026-10-01', currency: 'USD', amount: 10 },
        { day: '2026-10-01', currency: 'EUR', amount: 99 },
        { day: '2026-10-03', currency: 'USD', amount: 5 },
      ],
      'USD',
      window,
      'day',
    )
    expect(points.map((point) => point.revenue)).toEqual([10, 0, 5])
  })

  it('lays the previous window over by position', () => {
    const window = { start: day('2026-10-03'), end: day('2026-10-05') }
    const previous = { start: day('2026-10-01'), end: day('2026-10-03') }
    const points = revenueSeries([], 'USD', window, 'day', {
      days: [{ day: '2026-10-02', currency: 'USD', amount: 7 }],
      window: previous,
    })
    expect(points.map((point) => point.previous)).toEqual([0, 7])
  })
})

describe('customerRows', () => {
  it('keeps one currency, highest first, with shares of the total', () => {
    const rows = customerRows(
      [
        {
          customerId: 'a',
          name: 'A',
          total: money('100', 'USD'),
          usage: money('40', 'USD'),
          fixed: money('60', 'USD'),
        },
        {
          customerId: 'b',
          name: 'B',
          total: money('300', 'USD'),
          usage: money('0', 'USD'),
          fixed: money('300', 'USD'),
        },
        {
          customerId: 'c',
          name: 'C',
          total: money('999', 'EUR'),
          usage: money('0', 'EUR'),
          fixed: money('999', 'EUR'),
        },
      ],
      'USD',
    )
    expect(rows.map((row) => row.id)).toEqual(['b', 'a'])
    expect(rows[0]?.share).toBe(0.75)
  })
})

describe('receivables', () => {
  it('ages unpaid finalized invoices by days past due, as of today', () => {
    const owed = receivables(
      [
        invoice({ id: '1', dueDate: day('2026-10-20') }),
        invoice({ id: '2', dueDate: day('2026-10-05'), amountRemaining: money('50', 'USD') }),
        invoice({ id: '3', dueDate: day('2026-06-01'), amountRemaining: money('25', 'USD') }),
        invoice({ id: '4', dueDate: null, amountRemaining: money('10', 'USD') }),
        invoice({ id: '5', status: InvoiceStatus.Draft }),
        invoice({ id: '6', status: InvoiceStatus.Paid, amountRemaining: money('0', 'USD') }),
      ],
      'USD',
      NOW,
    )
    expect(owed.notYetDue).toBe(100)
    expect(owed.overdue).toBe(75)
    expect(owed.noDueDate).toBe(10)
    expect(owed.outstanding).toBe(185)
    expect(owed.buckets.find((bucket) => bucket.id === 'd30')?.amount).toBe(50)
    expect(owed.buckets.find((bucket) => bucket.id === 'd90p')?.amount).toBe(25)
    expect(owed.customers[0]).toMatchObject({ id: 'cust_1', invoices: 2, overdue: 75 })
  })
})

describe('daysToPay', () => {
  it('measures issue to settlement for succeeded payments in the window', () => {
    const invoices = [
      invoice({ number: 'INV-1', issuedAt: day('2026-10-01') }),
      invoice({
        number: 'INV-2',
        issuedAt: day('2026-10-01'),
        customerId: 'cust_2',
        customerName: 'Beta',
      }),
    ]
    const payment = (patch: Partial<Payment>): Payment =>
      ({
        id: 'pay',
        amount: money('100', 'USD'),
        status: PaymentStatus.Succeeded,
        invoiceNumber: 'INV-1',
        succeededAt: day('2026-10-04'),
        createdAt: null,
        methodType: '',
        gateway: '',
        ...patch,
      }) as Payment
    const result = daysToPay(
      [
        payment({}),
        payment({ invoiceNumber: 'INV-2', succeededAt: day('2026-10-11') }),
        payment({ invoiceNumber: 'INV-2', status: PaymentStatus.Failed }),
        payment({ invoiceNumber: 'UNKNOWN' }),
      ],
      invoices,
      { start: day('2026-10-01'), end: NOW },
      'day',
      'USD',
    )
    expect(result.paidCount).toBe(2)
    expect(result.average).toBe(7)
    expect(result.withinWeek).toBe(0.5)
    expect(result.payers[0]).toMatchObject({ id: 'cust_2', averageDays: 10 })
  })
})

describe('change', () => {
  it('is null with nothing to compare against', () => {
    expect(change(10, 0)).toBeNull()
    expect(change(12, 10)).toBeCloseTo(0.2)
  })
})

describe('parseRevenueSearch', () => {
  it('falls back to the defaults for anything it does not know', () => {
    expect(parseRevenueSearch({ view: 'nope', range: 'forever', compare: 'x' })).toEqual({
      view: 'overview',
      range: '12m',
      grain: 'auto',
      compare: 'none',
      currency: '',
    })
    expect(
      parseRevenueSearch({ view: 'customers', range: '12m', compare: 'previous', currency: 'eur' }),
    ).toEqual({
      view: 'customers',
      range: '12m',
      grain: 'auto',
      compare: 'previous',
      currency: 'EUR',
    })
    expect(parseRevenueSearch({ grain: 'week' }).grain).toBe('week')
    expect(parseRevenueSearch({ grain: 'hourly' }).grain).toBe('auto')
  })
})

describe('resolveGrain', () => {
  it('keeps the range default on auto and honours a chosen grain', () => {
    expect(resolveGrain('auto', 'week')).toBe('week')
    expect(resolveGrain('day', 'month')).toBe('day')
    expect(resolveGrain('month', 'day')).toBe('month')
  })
})

describe('alignToWindow at a partial first bucket', () => {
  const window = {
    start: new Date('2026-09-25T00:00:00Z'),
    end: new Date('2026-10-25T12:00:00Z'),
  }

  it('keeps a monthly row dated before the window start', () => {
    const out = alignToWindow(
      [
        { at: new Date('2026-09-01T00:00:00Z'), value: 10 },
        { at: new Date('2026-10-01T00:00:00Z'), value: 5 },
      ],
      window,
      'month',
    )
    expect(out.map((point) => point.value)).toEqual([10, 5])
  })

  it('keeps the weekly row that contains the window start', () => {
    const out = alignToWindow(
      [
        { at: new Date('2026-09-21T00:00:00Z'), value: 7 },
        { at: new Date('2026-09-14T00:00:00Z'), value: 99 },
      ],
      window,
      'week',
    )
    expect(out[0]?.value).toBe(7)
    expect(out.reduce((sum, point) => sum + (point.value ?? 0), 0)).toBe(7)
  })

  it('still drops a daily row before the window', () => {
    const out = alignToWindow([{ at: new Date('2026-09-24T00:00:00Z'), value: 3 }], window, 'day')
    expect(out.reduce((sum, point) => sum + (point.value ?? 0), 0)).toBe(0)
  })

  it('keeps two weekly averages in their own Monday weeks when not additive', () => {
    const out = alignToWindow(
      [
        { at: new Date('2026-09-21T00:00:00Z'), value: 7 },
        { at: new Date('2026-09-28T00:00:00Z'), value: 5 },
      ],
      window,
      'week',
      false,
      null,
      false,
    )
    expect(out.slice(0, 2).map((point) => point.value)).toEqual([7, 5])
  })

  it('labels each week with the Monday the report buckets it under', () => {
    const quarter = rangeWindow('quarter', new Date('2026-11-04T12:00:00Z'))
    const out = alignToWindow(
      [{ at: new Date('2026-11-02T00:00:00Z'), value: 216.23 }],
      quarter,
      'week',
    )
    expect(out[0]?.label).toBe('Sep 28')
    expect(out.at(-1)).toEqual({ label: 'Nov 2', value: 216.23 })
  })

  it('keeps a partial first average when the series is not additive', () => {
    const out = alignToWindow(
      [{ at: new Date('2026-09-01T00:00:00Z'), value: 12 }],
      window,
      'month',
      false,
      null,
      false,
    )
    expect(out[0]?.value).toBe(12)
  })
})

describe('creditRows', () => {
  it('pivots paid and free per customer, largest first', () => {
    const rows = creditRows(
      [
        { keys: { customer_id: 'a', credit_type: 'paid' }, value: 30 },
        { keys: { customer_id: 'a', credit_type: 'free' }, value: 10 },
        { keys: { customer_id: 'b', credit_type: 'free' }, value: 90 },
      ],
      (id) => id.toUpperCase(),
      String,
    )
    expect(rows.map((row) => row.id)).toEqual(['b', 'a'])
    expect(rows[1]).toMatchObject({ name: 'A', paid: 30, free: 10, total: 40 })
    expect(rows[0]).toMatchObject({ paid: 0, free: 90, total: 90 })
    expect(rows.map((row) => row.display.share)).toEqual(['69%', '31%'])
    expect(rows.map((row) => row.share)).toEqual([90 / 130, 40 / 130])
  })
})

describe('creditTypeRows', () => {
  it('counts customers with a positive amount per type', () => {
    const rows = creditTypeRows(
      [
        { keys: { customer_id: 'a', credit_type: 'paid' }, value: 30 },
        { keys: { customer_id: 'b', credit_type: 'paid' }, value: 20 },
        { keys: { customer_id: 'b', credit_type: 'free' }, value: 5 },
        { keys: { customer_id: 'c', credit_type: 'free' }, value: 0 },
      ],
      'credit_type',
      { paid: 'Paid credits', free: 'Free credits' },
      String,
    )
    expect(rows[0]).toMatchObject({ id: 'paid', label: 'Paid credits', customers: 2, amount: 50 })
    expect(rows[1]).toMatchObject({ id: 'free', customers: 1, amount: 5 })
  })
})

describe('agingTotals', () => {
  it('keeps invoices with no due date out of overdue', () => {
    const row = (bucket: string, value: number) => ({ keys: { aging_bucket: bucket }, value })
    expect(
      agingTotals([
        row('Current', 100),
        row('No due date', 386.01),
        row('1-30', 5000),
        row('90+', 31.87),
      ]),
    ).toEqual({ notYetDue: 100, noDueDate: 386.01, overdue: 5031.87 })
  })
})

describe('eventsWindow', () => {
  const now = new Date('2026-11-04T12:00:00Z')

  it('counts the last 7 days, today included, of a wider range and says so', () => {
    const span = eventsWindow(rangeWindow('30d', now))
    expect(span.range).toBe('2026-10-29..2026-11-05')
    expect(span.limited).toBe(true)
    expect(alignToWindow([], span, 'day')).toHaveLength(7)
  })

  it('keeps a range that fits in a week whole', () => {
    const span = eventsWindow(rangeWindow('month', now))
    expect(span.range).toBe('2026-11-01..2026-11-05')
    expect(span.limited).toBe(false)
  })
})
