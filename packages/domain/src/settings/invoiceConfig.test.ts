import { describe, expect, it } from 'vitest'
import {
  defaultInvoiceConfig,
  entityInvoicePreview,
  invoiceConfigSchema,
  previewInvoiceNumber,
  splitDelay,
} from './invoiceConfig'

const yyyymm = () => {
  const now = new Date()
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

const ON = new Date('2026-09-29T00:00:00Z')

describe('previewInvoiceNumber', () => {
  it('renders the default scheme the hosted API ships', () => {
    expect(previewInvoiceNumber(defaultInvoiceConfig(), ON)).toBe('INV-202609-00001')
  })

  /**
   * `YY` is substituted after `YYYY` for a reason worth a test: replacing the
   * shorter token first turns 2026 into "26026", and the bug only shows on
   * the formats nobody demos.
   */
  it.each([
    ['YYYYMMDD', 'INV-20260929-00001'],
    ['YYMMDD', 'INV-260929-00001'],
    ['YYYY', 'INV-2026-00001'],
    ['YY', 'INV-26-00001'],
  ])('renders %s without mangling the year', (format, expected) => {
    expect(previewInvoiceNumber({ ...defaultInvoiceConfig(), format }, ON)).toBe(expected)
  })

  it('omits the separator entirely when there is none', () => {
    expect(previewInvoiceNumber({ ...defaultInvoiceConfig(), separator: '' }, ON)).toBe(
      'INV20260900001',
    )
  })

  it('drops an empty prefix rather than leaving a leading separator', () => {
    expect(previewInvoiceNumber({ ...defaultInvoiceConfig(), prefix: '' }, ON)).toBe('202609-00001')
  })

  it('pads to the configured width', () => {
    expect(
      previewInvoiceNumber({ ...defaultInvoiceConfig(), suffixLength: 3, startSequence: 42 }, ON),
    ).toBe('INV-202609-042')
  })
})

describe('entityInvoicePreview', () => {
  it("swaps the entity's prefix into the environment's numbering scheme", () => {
    const config = {
      ...defaultInvoiceConfig(),
      prefix: 'NWS',
      separator: '-',
      format: 'YYYYMM',
      startSequence: 1,
      suffixLength: 5,
    }
    expect(entityInvoicePreview(config, 'NWIN')).toBe(`NWIN-${yyyymm()}-00001`)
  })
})

describe('splitDelay', () => {
  it.each([
    [0, { value: 0, unit: 'seconds' }],
    [7200, { value: 2, unit: 'hours' }],
    [86_400, { value: 1, unit: 'days' }],
    [900, { value: 15, unit: 'minutes' }],
    // Not divisible by a minute, so it stays in the unit it was given.
    [90, { value: 90, unit: 'seconds' }],
  ])('reads %i seconds in the largest unit that divides it', (seconds, expected) => {
    expect(splitDelay(seconds)).toEqual(expected)
  })
})

describe('invoiceConfigSchema', () => {
  it('accepts the backend’s own defaults', () => {
    expect(invoiceConfigSchema.safeParse(defaultInvoiceConfig()).success).toBe(true)
  })

  it('accepts an empty separator, which is a real style and not an omission', () => {
    expect(
      invoiceConfigSchema.safeParse({ ...defaultInvoiceConfig(), separator: '' }).success,
    ).toBe(true)
  })

  /**
   * These bounds are the backend's `validate` tags, not house style. Catching
   * them here turns a 400 whose message names a Go field into a red input.
   */
  it.each([
    ['an empty prefix', { prefix: '' }],
    ['a format the backend does not know', { format: 'MMYYYY' }],
    ['no timezone', { timezone: '' }],
    ['a sequence of zero digits', { suffixLength: 0 }],
    ['a sequence wider than ten digits', { suffixLength: 11 }],
    ['a negative start', { startSequence: -1 }],
    ['a fractional start', { startSequence: 1.5 }],
    ['negative payment terms', { dueDateDays: -1 }],
    ['a negative delay', { finalizationDelaySeconds: -1 }],
  ])('rejects %s', (_name, patch) => {
    expect(invoiceConfigSchema.safeParse({ ...defaultInvoiceConfig(), ...patch }).success).toBe(
      false,
    )
  })

  it('reports the field, so a form can put the message on the input', () => {
    const result = invoiceConfigSchema.safeParse({ ...defaultInvoiceConfig(), suffixLength: 99 })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['suffixLength'])
  })
})
