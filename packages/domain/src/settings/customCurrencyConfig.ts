/**
 * A tenant's own currencies, and what they are worth.
 *
 * `GET/PUT /settings/custom_currency_config`.
 *
 * A custom currency is a unit a tenant invoices in that no central bank
 * issues: credits, tokens, minutes, seats. It needs a name and a symbol to be
 * printed, and a conversion factor per fiat currency so an invoice in
 * `credits` can be settled in dollars. The factor reads "how much fiat one
 * unit of this currency is worth": the backend multiplies by it to convert.
 *
 * Rates are decimal **strings**, never floats. A conversion factor that
 * round-trips through a float is a rounding error applied to every line of
 * every invoice, and the backend stores them as arbitrary-precision decimals
 * precisely so that does not happen.
 */
import { z } from 'zod'

export interface CustomCurrencyDefinition {
  name: string
  symbol: string
  /** Fiat code (lowercase) to decimal string. One entry per supported fiat. */
  fiatConversionFactors: Record<string, string>
}

export interface CustomCurrencyConfig {
  /**
   * The fiat every custom currency must quote a rate against, lowercase.
   *
   * Empty is valid **only** while there are no custom currencies at all: the
   * live default is `{custom_currencies: {}, default_fiat_currency: ""}`.
   */
  defaultFiatCurrency: string
  /** Keyed by the custom currency's own lowercase 3-letter code. */
  customCurrencies: Record<string, CustomCurrencyDefinition>
}

const CODE = /^[a-z]{3}$/i
const DECIMAL = /^\d+(\.\d+)?$/

const definitionSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name'),
  symbol: z.string().trim().min(1, 'Enter a symbol'),
  fiatConversionFactors: z.record(
    z.string().trim().regex(CODE, 'A currency code is three letters'),
    z.string().trim().regex(DECIMAL, 'Enter a rate, for example 0.01'),
  ),
})

/**
 * The write contract, as `internal/types/custom_currency.go` states it.
 *
 * The rules are the backend's, checked here so they land on a field instead of
 * arriving as a 400 nobody can map back to a row. The last one is the one
 * worth knowing about: **every custom currency must quote the same set of fiat
 * currencies**. A tenant cannot price credits in USD and tokens in EUR; the
 * set is a property of the config, not of a row, which is why an editor should
 * hold one fiat list and apply it to every currency rather than offering a
 * per-row picker.
 */
export const customCurrencyConfigSchema = z
  .object({
    defaultFiatCurrency: z.string().trim(),
    customCurrencies: z.record(
      z.string().trim().regex(CODE, 'A currency code is three letters'),
      definitionSchema,
    ),
  })
  .superRefine((config, ctx) => {
    const codes = Object.keys(config.customCurrencies)
    // An empty config is valid and unvalidated: the backend skips every rule
    // below when there is nothing to convert.
    if (codes.length === 0) return

    const fiat = config.defaultFiatCurrency.trim().toLowerCase()
    if (fiat.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['defaultFiatCurrency'],
        message: 'Choose the fiat currency these convert to',
      })
    }

    // Codes are lowercased server-side, so `USD` and `usd` are one currency
    // that arrives as two rows and loses one on save.
    const seen = new Set<string>()
    for (const code of codes) {
      const lower = code.toLowerCase()
      if (seen.has(lower)) {
        ctx.addIssue({
          code: 'custom',
          path: ['customCurrencies', code],
          message: `${code} is already defined: codes are not case-sensitive`,
        })
      }
      seen.add(lower)

      if (lower === fiat) {
        ctx.addIssue({
          code: 'custom',
          path: ['customCurrencies', code],
          message: 'A custom currency cannot have the same code as the fiat currency',
        })
      }
    }

    // The set the first currency quotes is the set they all must quote.
    const required = new Set(
      Object.keys(config.customCurrencies[codes[0] as string]?.fiatConversionFactors ?? {}).map(
        (code) => code.toLowerCase(),
      ),
    )
    if (fiat.length > 0) required.add(fiat)

    for (const code of codes) {
      const factors = config.customCurrencies[code]?.fiatConversionFactors ?? {}
      const quoted = new Set(Object.keys(factors).map((key) => key.toLowerCase()))

      for (const [key, rate] of Object.entries(factors)) {
        if (Number.parseFloat(rate) <= 0) {
          ctx.addIssue({
            code: 'custom',
            path: ['customCurrencies', code, 'fiatConversionFactors', key],
            message: 'A conversion rate must be greater than zero',
          })
        }
      }

      const missing = [...required].filter((key) => !quoted.has(key))
      if (missing.length > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['customCurrencies', code, 'fiatConversionFactors'],
          message: `Add a rate for ${missing.join(', ').toUpperCase()}`,
        })
      }
    }
  })

/** The backend's default: nothing configured. */
export function defaultCustomCurrencyConfig(): CustomCurrencyConfig {
  return { defaultFiatCurrency: '', customCurrencies: {} }
}

/** A blank row for the editor's "add a currency" button. */
export function emptyCustomCurrency(fiatCodes: readonly string[] = []): CustomCurrencyDefinition {
  return {
    name: '',
    symbol: '',
    fiatConversionFactors: Object.fromEntries(fiatCodes.map((code) => [code.toLowerCase(), ''])),
  }
}

/**
 * The fiat currencies this config quotes, lowercase and sorted.
 *
 * Read off the first currency because they are all required to agree: see
 * the schema. Falls back to the default fiat alone, which is what a config
 * with one half-filled row looks like mid-edit.
 */
export function quotedFiatCurrencies(config: CustomCurrencyConfig): string[] {
  const first = Object.values(config.customCurrencies)[0]
  const codes = new Set(
    Object.keys(first?.fiatConversionFactors ?? {}).map((code) => code.toLowerCase()),
  )
  const fiat = config.defaultFiatCurrency.trim().toLowerCase()
  if (fiat.length > 0) codes.add(fiat)
  return [...codes].sort()
}
