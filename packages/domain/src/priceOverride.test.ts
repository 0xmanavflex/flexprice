import { describe, expect, it } from 'vitest'
import { BillingModel, TierMode, emptyOverride, priceOverrideSchema } from './priceOverride'

const parse = (value: unknown) => priceOverrideSchema.safeParse(value)

/** All error messages, flattened, so a test can assert on what a user would see. */
function errors(value: unknown): string[] {
  const result = parse(value)
  return result.success ? [] : result.error.issues.map((i) => i.message)
}

function pathsWithErrors(value: unknown): string[] {
  const result = parse(value)
  return result.success ? [] : result.error.issues.map((i) => i.path.join('.'))
}

describe('flat fee', () => {
  it('needs an amount', () => {
    expect(
      parse({ priceId: 'p1', billingModel: BillingModel.FlatFee, amount: '9.99' }).success,
    ).toBe(true)
    expect(errors({ priceId: 'p1', billingModel: BillingModel.FlatFee, amount: '' })).toContain(
      'Enter an amount',
    )
  })

  it.each(['abc', '1,000', '1e3', '$5', '9.9.9'])('rejects %s as an amount', (amount) => {
    expect(errors({ priceId: 'p1', billingModel: BillingModel.FlatFee, amount })).toContain(
      'Enter a number, for example 9.99',
    )
  })

  it('rejects a negative price', () => {
    expect(errors({ priceId: 'p1', billingModel: BillingModel.FlatFee, amount: '-1' })).toContain(
      'Amount cannot be negative',
    )
  })

  it('keeps the amount as an exact decimal string, never a number', () => {
    const result = parse({ priceId: 'p1', billingModel: BillingModel.FlatFee, amount: '0.1' })

    // Narrowed through the discriminant rather than asserted: if the union ever
    // stops guaranteeing `amount` on this branch, this stops compiling.
    expect(result.success).toBe(true)
    if (result.success && result.data.billingModel === BillingModel.FlatFee) {
      expect(result.data.amount).toBe('0.1')
    }
  })

  // The discriminated union is what stops the form carrying dead state between
  // models: the thing V1 does with twelve parallel useStates.
  it('does not accept tier fields', () => {
    const result = parse({
      priceId: 'p1',
      billingModel: BillingModel.FlatFee,
      amount: '1',
      tiers: [{ upTo: null, unitAmount: '1' }],
    })
    expect(result.success && 'tiers' in result.data).toBe(false)
  })
})

describe('package', () => {
  const pkg = (divideBy: unknown) => ({
    priceId: 'p1',
    billingModel: BillingModel.Package,
    amount: '10',
    divideBy,
  })

  it('accepts a whole positive package size', () => {
    expect(parse(pkg(1000)).success).toBe(true)
  })

  it.each([
    [0, 'Must be greater than zero'],
    [-5, 'Must be greater than zero'],
    [1.5, 'Must be a whole number'],
  ])('rejects a package size of %s', (divideBy, message) => {
    expect(errors(pkg(divideBy))).toContain(message)
  })

  it('asks for a package size when it is missing', () => {
    expect(errors({ priceId: 'p1', billingModel: BillingModel.Package, amount: '10' })).toContain(
      'Enter a package size',
    )
  })
})

describe('tiers', () => {
  const tiered = (tiers: unknown) => ({
    priceId: 'p1',
    billingModel: BillingModel.Tiered,
    tierMode: TierMode.Volume,
    tiers,
  })

  it('accepts ascending bands ending unbounded', () => {
    expect(
      parse(
        tiered([
          { upTo: 100, unitAmount: '0.10' },
          { upTo: 1000, unitAmount: '0.08' },
          { upTo: null, unitAmount: '0.05' },
        ]),
      ).success,
    ).toBe(true)
  })

  it('requires at least one tier', () => {
    expect(errors(tiered([]))).toContain('Add at least one tier')
  })

  // Overlapping bands silently bill the wrong amount in V1. Nothing catches it
  // until an invoice is wrong.
  it('rejects bands that do not climb', () => {
    expect(
      errors(
        tiered([
          { upTo: 100, unitAmount: '0.10' },
          { upTo: 50, unitAmount: '0.08' },
          { upTo: null, unitAmount: '0.05' },
        ]),
      ),
    ).toContain('Must be greater than 100')
  })

  it('rejects two bands with the same ceiling', () => {
    expect(
      errors(
        tiered([
          { upTo: 100, unitAmount: '0.10' },
          { upTo: 100, unitAmount: '0.08' },
          { upTo: null, unitAmount: '0.05' },
        ]),
      ).join(' '),
    ).toMatch(/greater than 100/)
  })

  // A closed final band drops usage above it on the floor: revenue quietly lost.
  it('requires the last band to be unbounded', () => {
    expect(errors(tiered([{ upTo: 100, unitAmount: '0.10' }])).join(' ')).toMatch(
      /last tier must be unbounded/,
    )
  })

  it('allows only the last band to be unbounded', () => {
    expect(
      errors(
        tiered([
          { upTo: null, unitAmount: '0.10' },
          { upTo: null, unitAmount: '0.05' },
        ]),
      ),
    ).toContain('Only the last tier can be unbounded')
  })

  it('reports errors against the offending row, so a form can show them in place', () => {
    expect(
      pathsWithErrors(
        tiered([
          { upTo: 100, unitAmount: '0.10' },
          { upTo: 50, unitAmount: '0.08' },
          { upTo: null, unitAmount: '0.05' },
        ]),
      ),
    ).toContain('tiers.1.upTo')
  })

  it('validates each band’s own amount', () => {
    expect(pathsWithErrors(tiered([{ upTo: null, unitAmount: 'abc' }]))).toContain(
      'tiers.0.unitAmount',
    )
  })

  it('rejects a non-positive ceiling', () => {
    expect(
      errors(
        tiered([
          { upTo: 0, unitAmount: '0.10' },
          { upTo: null, unitAmount: '0.05' },
        ]),
      ),
    ).toContain('Must be greater than zero')
  })
})

describe('emptyOverride', () => {
  // A form that opens already showing errors teaches people to ignore them.
  it.each([BillingModel.FlatFee, BillingModel.Package, BillingModel.Tiered])(
    'produces structurally complete state for %s',
    (model) => {
      const value = emptyOverride('p1', model)
      expect(value.billingModel).toBe(model)
      const issues = parse(value)
      // Amounts are blank and so do fail: but only on the amount fields, never
      // on structure, so switching models cannot land somewhere incoherent.
      if (!issues.success) {
        for (const issue of issues.error.issues) {
          expect(issue.path.join('.')).toMatch(/amount|unitAmount/)
        }
      }
    },
  )

  it('opens a tiered override with the unbounded band already present', () => {
    const value = emptyOverride('p1', BillingModel.Tiered)
    expect(value).toMatchObject({ tierMode: TierMode.Volume, tiers: [{ upTo: null }] })
  })
})
