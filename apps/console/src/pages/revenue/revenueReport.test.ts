import { describe, expect, it } from 'vitest'
import { InvoiceStatus, PaymentStatus, money, type Invoice, type Payment } from '@fp/domain'
import { parseRevenueSearch } from '@/app/revenueSearch'
import {
  change,
  customerRows,
  daysToPay,
  previousWindow,
  rangeWindow,
  receivables,
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

  it('puts the comparison window immediately before, the same length', () => {
    const window = { start: day('2026-10-01'), end: day('2026-10-11') }
    expect(previousWindow(window)).toEqual({ start: day('2026-09-21'), end: day('2026-10-01') })
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
      range: '90d',
      compare: 'none',
      currency: '',
    })
    expect(
      parseRevenueSearch({ view: 'customers', range: '12m', compare: 'previous', currency: 'eur' }),
    ).toEqual({
      view: 'customers',
      range: '12m',
      compare: 'previous',
      currency: 'EUR',
    })
  })
})
