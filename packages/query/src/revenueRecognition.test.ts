import { describe, expect, it } from 'vitest'
import { revenuePeriods } from '@fp/domain'
import {
  toContractJournal,
  toPerformanceObligation,
  toRevenueWaterfall,
  toRollforward,
} from './revenueRecognition'

describe('toRevenueWaterfall', () => {
  it('keeps posted, pending and scheduled apart and totals each row exactly', () => {
    const waterfall = toRevenueWaterfall(
      {
        totals: [
          { period: '2026-09', revenue: { total: '100', actual: '100' }, deferred: '1100' },
          { period: '2026-10', revenue: { total: '100', pending: '45.16', scheduled: '54.84' } },
        ],
        items: [
          {
            pob_id: 'pob_1',
            cells: [
              {
                period: '2026-09',
                revenue: { total: '100', actual: '100', pending: '0', scheduled: '0' },
                deferred: '1100',
                unbilled: '0',
              },
              {
                period: '2026-10',
                revenue: { total: '100', actual: '0', pending: '45.16', scheduled: '54.84' },
              },
            ],
          },
        ],
      },
      'USD',
    )
    expect(waterfall.periods).toEqual(['2026-09', '2026-10'])
    const row = waterfall.rows[0]
    expect(row?.total).toEqual({ amount: '200', currency: 'USD' })
    expect(row?.earned.amount).toBe('145.16')
    expect(row?.scheduled.amount).toBe('54.84')
    expect(row?.months[0]?.deferred?.amount).toBe('1100')
    // An open month has no balance yet: null, not zero.
    expect(row?.months[1]?.deferred).toBeNull()
    expect(waterfall.total.amount).toBe('200')
  })

  it('reads a malformed amount as zero rather than failing the whole report', () => {
    const waterfall = toRevenueWaterfall(
      {
        totals: [],
        items: [{ pob_id: 'p', cells: [{ period: '2026-01', revenue: { total: 'NaN' } }] }],
      },
      'USD',
    )
    expect(waterfall.rows[0]?.months[0]?.total.amount).toBe('0')
  })
})

describe('toPerformanceObligation', () => {
  it('drops unknown methods and reads a missing end as open', () => {
    const pob = toPerformanceObligation({
      id: 'pob_1',
      name: 'Usage Bank',
      recognition_method: 'straight_line',
      amortization_method: 'weekly',
      service_start: '2026-04-22T00:00:00Z',
    })
    expect(pob.recognitionMethod).toBe('straight_line')
    expect(pob.amortizationMethod).toBeNull()
    expect(pob.serviceEnd).toBeNull()
  })
})

describe('revenuePeriods', () => {
  it('ends on the month of the term’s last day', () => {
    expect(
      revenuePeriods(new Date('2026-04-22T00:00:00Z'), new Date('2027-05-01T00:00:00Z')),
    ).toEqual({ start: '2026-04', end: '2027-04' })
  })

  it('runs a year past today when open-ended, keeping the latest 36 months', () => {
    const today = new Date('2026-10-27T00:00:00Z')
    expect(revenuePeriods(new Date('2026-01-01T00:00:00Z'), null, today)).toEqual({
      start: '2026-01',
      end: '2027-10',
    })
    expect(revenuePeriods(new Date('2020-01-01T00:00:00Z'), null, today)).toEqual({
      start: '2024-11',
      end: '2027-10',
    })
  })
})

describe('toContractJournal', () => {
  it('keeps each entry’s lines together, with the amount on its side', () => {
    const journal = toContractJournal(
      [
        {
          id: 'je_1',
          event_type: 'invoice_finalized',
          source_entity_type: 'invoice',
          source_entity_id: 'inv_1',
          business_date: '2026-04-22T00:00:00Z',
          lines: [
            { id: 'jl_1', account: 'accounts_receivable', direction: 'debit', amount: '6000' },
            {
              id: 'jl_2',
              account: 'deferred_revenue',
              direction: 'credit',
              amount: '5000',
              pob_id: 'pob_1',
            },
            {
              id: 'jl_3',
              account: 'deferred_revenue',
              direction: 'credit',
              amount: '1000',
              pob_id: 'pob_2',
            },
          ],
        },
      ],
      'USD',
    )
    const entry = journal.entries[0]
    expect(entry?.lines).toHaveLength(3)
    expect(entry?.lines[0]?.debit).toEqual({ amount: '6000', currency: 'USD' })
    expect(entry?.lines[0]?.credit).toBeNull()
    expect(entry?.lines[0]?.pobId).toBeNull()
    expect(entry?.reversalOf).toBeNull()
    expect(journal.lineCount).toBe(3)
    expect(journal.debits.amount).toBe('6000')
    expect(journal.credits.amount).toBe('6000')
  })
})

describe('toRollforward', () => {
  it('keeps invoiced and earned apart and folds every other movement into adjustments', () => {
    const rollforward = toRollforward(
      {
        totals: [
          {
            period: '2026-09',
            account: 'deferred_revenue',
            opening: '573534.51',
            movements: { invoiced: '248769.99', earned: '-271470.11' },
            closing: '550834.39',
          },
        ],
        items: [
          {
            customer_id: 'cust_1',
            contract_id: 'contract_1',
            opening: '100',
            movements: { earned: '-50', adjustments: '-20', refunds: '5' },
            closing: '35',
          },
        ],
        pagination: { total: 16 },
      },
      '2026-09',
      'USD',
    )
    expect(rollforward.totals?.closing.amount).toBe('550834.39')
    expect(rollforward.totals?.adjustments.amount).toBe('0')
    const row = rollforward.rows[0]
    expect(row?.invoiced.amount).toBe('0')
    expect(row?.earned.amount).toBe('-50')
    expect(row?.adjustments.amount).toBe('-15')
    expect(rollforward.count).toBe(16)
  })
})
