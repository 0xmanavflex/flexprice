import { describe, expect, it } from 'vitest'
import { csvFilename, toCsv } from './reportCsv'

describe('toCsv', () => {
  const columns = [
    { header: 'name', value: (row: { name: string; amount: number | null }) => row.name },
    { header: 'amount', value: (row: { name: string; amount: number | null }) => row.amount },
  ]

  it('writes a header and raw values', () => {
    expect(toCsv(columns, [{ name: 'Acme', amount: 12.5 }])).toBe('name,amount\r\nAcme,12.5')
  })

  it('quotes commas, quotes and newlines', () => {
    const csv = toCsv(columns, [{ name: 'A, "B"\nC', amount: 1 }])
    expect(csv).toBe('name,amount\r\n"A, ""B""\nC",1')
  })

  it('leaves missing values empty', () => {
    expect(toCsv(columns, [{ name: 'Acme', amount: null }])).toBe('name,amount\r\nAcme,')
  })

  it('blocks formula injection but keeps negative numbers', () => {
    const csv = toCsv(columns, [
      { name: '=SUM(A1)', amount: -5 },
      { name: '+cmd', amount: 1 },
    ])
    expect(csv).toBe("name,amount\r\n'=SUM(A1),-5\r\n'+cmd,1")
  })

  it('writes only the header for no rows', () => {
    expect(toCsv(columns, [])).toBe('name,amount')
  })
})

describe('csvFilename', () => {
  it('slugs the panel and range', () => {
    expect(csvFilename('All customers', 'Last 90 days')).toBe('all-customers_last-90-days.csv')
  })
})
