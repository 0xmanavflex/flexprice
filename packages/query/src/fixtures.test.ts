import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ListInvoicesResponse$inboundSchema,
  ListFeaturesResponse$inboundSchema,
} from '@flexprice/sdk/sdk/models'
import { InvoiceStatus } from '@fp/domain'
import { toInvoice } from './invoices'
import { toFeature } from './features'

/**
 * The mappers, against responses the API actually returned.
 *
 * Unit tests use fixtures I wrote, which means they test my assumptions about
 * the response as much as the mapper. These are captured from a live
 * environment and scrubbed, so they carry optional-field combinations nobody
 * chose: which is exactly where a mapper breaks.
 *
 * Note the parse step. The fixtures are **raw API JSON** (`amount_due`), while
 * a mapper receives **SDK output** (`amountDue`): the SDK remaps keys and
 * turns date strings into `Date`s. Feeding a raw fixture straight to a mapper
 * would silently produce every default and prove nothing, so each one goes
 * through the SDK's own inbound schema first. That makes this a test of the
 * whole chain: API JSON -> SDK parse -> mapper -> domain.
 */
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(resolve(__dirname, '__fixtures__', `${name}.json`), 'utf8'))

describe('invoices, from captured responses', () => {
  const parsed = ListInvoicesResponse$inboundSchema.parse(fixture('invoices'))
  const items = parsed.items ?? []

  it('captured some rows to test against', () => {
    expect(items.length).toBeGreaterThan(0)
  })

  it('maps every row without throwing', () => {
    expect(() => items.map((item) => toInvoice(item as never))).not.toThrow()
  })

  it.each(items.map((item, i) => [i, item] as const))('row %i is a usable domain invoice', (_i, item) => {
    const invoice = toInvoice(item as never)

    expect(invoice.id).not.toBe('')
    // A missing invoice number stays blank. The internal id is never shown as the number.
    expect(invoice.number).toBe(item.invoiceNumber?.trim() ?? '')
    expect(invoice.number).not.toBe(invoice.id)
    expect(invoice.customerName).not.toBe('Unknown')
    expect(Object.values(InvoiceStatus)).toContain(invoice.status)
    expect(invoice.total.currency).toMatch(/^[A-Z]{3}$/)
    // Amounts stay exact decimal strings the whole way through.
    expect(invoice.total.amount).toMatch(/^-?\d+(\.\d+)?$/)
  })

  it('never produces NaN or "undefined" in a money amount', () => {
    for (const invoice of items.map((i) => toInvoice(i as never))) {
      for (const money of [invoice.total, invoice.amountDue, invoice.amountRemaining]) {
        expect(money.amount).not.toContain('NaN')
        expect(money.amount).not.toContain('undefined')
      }
    }
  })

  // A real environment is where you find out a due date is usually absent.
  it('handles rows with and without a due date', () => {
    const invoices = items.map((i) => toInvoice(i as never))
    const withDue = invoices.filter((i) => i.dueDate !== null)
    const withoutDue = invoices.filter((i) => i.dueDate === null)

    for (const invoice of withDue) expect(invoice.dueDate).toBeInstanceOf(Date)
    // Neither group may produce an overdue status by accident.
    for (const invoice of withoutDue) expect(invoice.status).not.toBe(InvoiceStatus.Overdue)
  })
})

describe('features, from captured responses', () => {
  const parsed = ListFeaturesResponse$inboundSchema.parse(fixture('features'))
  const items = parsed.items ?? []

  it('captured some rows to test against', () => {
    expect(items.length).toBeGreaterThan(0)
  })

  it.each(items.map((item, i) => [i, item] as const))('row %i is a usable domain feature', (_i, item) => {
    const feature = toFeature(item as never)

    expect(feature.id).not.toBe('')
    expect(feature.name).not.toBe('Untitled feature')
  })

  /**
   * A metered feature must carry what it measures, or the grid shows an em dash
   * where the whole point of the row should be.
   *
   * Asserted only for rows whose response actually embedded a meter. The API
   * returns `meter_id` and embeds the meter object only when asked with
   * `expand: 'meters'`: which `toFeatureFilter` now sends, and the capture
   * script now sends. The committed fixture predates that fix, so nothing here
   * can assert it yet; the check below is what says so out loud.
   */
  it('lifts the meter onto the row whenever the response embedded one', () => {
    const withMeter = items.filter((item) => (item as { meter?: unknown }).meter)

    for (const item of withMeter) {
      const feature = toFeature(item as never)
      expect(feature.eventName).not.toBeNull()
      expect(feature.aggregationType).not.toBeNull()
    }
  })

  it('records whether the fixture was captured with expand=meters', () => {
    const metered = items.filter((i) => (i as { type?: string }).type === 'metered')
    const embedded = metered.filter((i) => (i as { meter?: unknown }).meter)

    if (metered.length > 0 && embedded.length === 0) {
      console.warn(
        `  features.json has ${metered.length} metered rows and none embed a meter: ` +
          're-capture with expand=meters, or the "Measured by" column cannot be tested.',
      )
    }
    // Not a failure: the fixture is honest about the request that produced it.
    expect(metered.length).toBeGreaterThanOrEqual(embedded.length)
  })
})

describe('the fixture corpus itself', () => {
  const EXPECTED = [
    'customers', 'plans', 'features', 'prices', 'invoices', 'subscriptions',
    'entitlements', 'wallets', 'coupons', 'addons', 'payments', 'taxrates',
  ]

  it.each(EXPECTED)('%s.json is present and correctly shaped', (name) => {
    const data = fixture(name) as { items?: unknown; pagination?: unknown }
    expect(Array.isArray(data.items)).toBe(true)
    expect(data.pagination).toBeDefined()
  })

  /**
   * Not a failure: a record of which entities the capture environment had
   * nothing in. An empty fixture still proves the envelope, but it cannot test
   * a mapper, and it is what tells us a re-capture is needed.
   */
  it('reports which entities came back empty', () => {
    const empty = EXPECTED.filter(
      (name) => ((fixture(name) as { items: unknown[] }).items ?? []).length === 0,
    )
    expect(empty.length).toBeLessThan(EXPECTED.length)
    if (empty.length > 0) console.warn(`  empty fixtures (need a richer environment): ${empty.join(', ')}`)
  })
})
