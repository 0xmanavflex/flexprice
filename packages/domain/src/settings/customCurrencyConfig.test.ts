import { describe, expect, it } from 'vitest'
import {
  type CustomCurrencyConfig,
  customCurrencyConfigSchema,
  defaultCustomCurrencyConfig,
  emptyCustomCurrency,
  quotedFiatCurrencies,
} from './customCurrencyConfig'

function config(): CustomCurrencyConfig {
  return {
    defaultFiatCurrency: 'usd',
    customCurrencies: {
      crd: { name: 'Credits', symbol: 'C', fiatConversionFactors: { usd: '0.01', eur: '0.009' } },
      tok: { name: 'Tokens', symbol: 'T', fiatConversionFactors: { usd: '0.02', eur: '0.018' } },
    },
  }
}

describe('customCurrencyConfigSchema', () => {
  it('accepts a complete config', () => {
    expect(customCurrencyConfigSchema.safeParse(config()).success).toBe(true)
  })

  /**
   * The empty config is the live default, and the backend validates nothing
   * when there is nothing to convert. Requiring a fiat currency of a tenant
   * that has declared no currencies would make the untouched screen invalid.
   */
  it('accepts the empty default, fiat currency and all', () => {
    expect(customCurrencyConfigSchema.safeParse(defaultCustomCurrencyConfig()).success).toBe(true)
  })

  it('requires a fiat currency as soon as there is something to convert', () => {
    const result = customCurrencyConfigSchema.safeParse({ ...config(), defaultFiatCurrency: '' })

    expect(result.success).toBe(false)
    expect(result.error?.issues.some((issue) => issue.path[0] === 'defaultFiatCurrency')).toBe(true)
  })

  it('rejects a custom code that collides with the fiat currency', () => {
    const result = customCurrencyConfigSchema.safeParse({
      defaultFiatCurrency: 'usd',
      customCurrencies: {
        usd: { name: 'Dollars', symbol: '$', fiatConversionFactors: { usd: '1' } },
      },
    })

    expect(result.success).toBe(false)
  })

  it('rejects a rate of zero or less, which can never convert anything', () => {
    const broken = config()
    broken.customCurrencies['crd'] = {
      ...broken.customCurrencies['crd']!,
      fiatConversionFactors: { usd: '0', eur: '0.009' },
    }

    expect(customCurrencyConfigSchema.safeParse(broken).success).toBe(false)
  })

  /**
   * The rule that shapes the editor: the backend requires every custom
   * currency to quote the *same* set of fiat currencies, so a per-row fiat
   * picker would produce configs the API rejects on save.
   */
  it('rejects a currency that quotes fewer fiats than its neighbour', () => {
    const uneven = config()
    uneven.customCurrencies['tok'] = {
      ...uneven.customCurrencies['tok']!,
      fiatConversionFactors: { usd: '0.02' },
    }

    const result = customCurrencyConfigSchema.safeParse(uneven)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual([
      'customCurrencies',
      'tok',
      'fiatConversionFactors',
    ])
  })

  it('rejects a currency with no rate for the default fiat', () => {
    const missing: CustomCurrencyConfig = {
      defaultFiatCurrency: 'gbp',
      customCurrencies: {
        crd: { name: 'Credits', symbol: 'C', fiatConversionFactors: { usd: '0.01' } },
      },
    }

    expect(customCurrencyConfigSchema.safeParse(missing).success).toBe(false)
  })

  it('rejects a code that is not three letters', () => {
    const result = customCurrencyConfigSchema.safeParse({
      defaultFiatCurrency: 'usd',
      customCurrencies: {
        credits: { name: 'Credits', symbol: 'C', fiatConversionFactors: { usd: '0.01' } },
      },
    })

    expect(result.success).toBe(false)
  })

  it('requires a name and a symbol, which is what an invoice prints', () => {
    const nameless = config()
    nameless.customCurrencies['crd'] = { ...nameless.customCurrencies['crd']!, name: '' }

    expect(customCurrencyConfigSchema.safeParse(nameless).success).toBe(false)
  })
})

describe('quotedFiatCurrencies', () => {
  it('reads the set every currency has to agree on', () => {
    expect(quotedFiatCurrencies(config())).toEqual(['eur', 'usd'])
  })

  it('falls back to the default fiat while the first row is still blank', () => {
    expect(quotedFiatCurrencies({ defaultFiatCurrency: 'usd', customCurrencies: {} })).toEqual([
      'usd',
    ])
  })
})

describe('emptyCustomCurrency', () => {
  it('starts a new row with a blank rate for every fiat already in use', () => {
    expect(emptyCustomCurrency(['usd', 'EUR'])).toEqual({
      name: '',
      symbol: '',
      fiatConversionFactors: { usd: '', eur: '' },
    })
  })
})
