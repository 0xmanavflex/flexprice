import { describe, expect, it } from 'vitest'
import type { ReportResult } from '@fp/api'
import { reportBreakdown, reportCurrencies, reportScalar, reportSeries } from './reports'

const metric = (name: string) => ({ name, type: 'decimal' as const, role: 'metric' as const })
const dim = (name: string) => ({ name, type: 'string' as const, role: 'dimension' as const })

describe('report readers', () => {
  it('reads a compared scalar for one currency, change as a fraction', () => {
    const result: ReportResult = {
      columns: [
        dim('currency'),
        metric('invoice_total'),
        metric('invoice_total_prev'),
        metric('invoice_total_change_pct'),
      ],
      rows: [
        ['usd', '412000', '380000', '8.4'],
        ['eur', '74000', '80000', '-7.5'],
      ],
      meta: {},
    }
    expect(reportScalar(result, 'invoice_total', 'USD')).toEqual({
      value: 412000,
      previous: 380000,
      change: 0.084,
    })
    expect(reportCurrencies(result)).toEqual(['USD', 'EUR'])
  })

  it('leaves a figure the report did not give as null, not zero', () => {
    expect(reportScalar(undefined, 'arpu')).toEqual({ value: null, previous: null, change: null })
    const result: ReportResult = {
      columns: [dim('currency'), metric('arpu')],
      rows: [['usd', '']],
      meta: {},
    }
    expect(reportScalar(result, 'arpu', 'usd').value).toBeNull()
  })

  it('reads a timeseries oldest first', () => {
    const result: ReportResult = {
      columns: [
        { name: 'bucket', type: 'datetime', role: 'dimension' },
        dim('currency'),
        metric('invoice_total'),
      ],
      rows: [
        ['2026-10-01T00:00:00Z', 'usd', '20'],
        ['2026-09-01T00:00:00Z', 'usd', '10'],
      ],
      meta: {},
    }
    expect(reportSeries(result, 'invoice_total', 'usd').map((point) => point.value)).toEqual([
      10, 20,
    ])
  })

  it('reads a breakdown by its dimensions, largest first', () => {
    const result: ReportResult = {
      columns: [
        dim('customer_id'),
        dim('aging_bucket'),
        dim('currency'),
        metric('receivables_aging'),
      ],
      rows: [
        ['cust_a', 'Current', 'usd', '5'],
        ['cust_b', '1-30', 'usd', '9'],
      ],
      meta: {},
    }
    expect(
      reportBreakdown(result, 'receivables_aging', ['customer_id', 'aging_bucket'], 'usd'),
    ).toEqual([
      { keys: { customer_id: 'cust_b', aging_bucket: '1-30' }, value: 9 },
      { keys: { customer_id: 'cust_a', aging_bucket: 'Current' }, value: 5 },
    ])
  })
})
