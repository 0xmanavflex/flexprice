/**
 * Which engine calculates tax: `GET/PUT/DELETE /settings/tax_config`.
 *
 * Off (the default, `{}`), Flexprice applies the tax rates configured in the
 * console. On with an external engine (Stripe Tax is the only one the API
 * supports), that engine calculates tax on invoices and credit notes instead,
 * and Flexprice's own rates no longer apply. On with the native engine named
 * changes nothing, so the screen never offers it: as V1.
 */
import { z } from 'zod'

export const TaxProvider = { Native: '', Flexprice: 'flexprice', Stripe: 'stripe' } as const
export type TaxProvider = (typeof TaxProvider)[keyof typeof TaxProvider]

export interface TaxConfig {
  enabled: boolean
  provider: TaxProvider
}

/** The engines offered: Stripe Tax is the only external one there is. */
export const EXTERNAL_TAX_PROVIDERS = [TaxProvider.Stripe] as const

export const TAX_PROVIDER_LABEL: Record<TaxProvider, string> = {
  '': 'Flexprice (native)',
  flexprice: 'Flexprice (native)',
  stripe: 'Stripe Tax',
}

export const taxConfigSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum([TaxProvider.Native, TaxProvider.Flexprice, TaxProvider.Stripe]),
})

/** What an environment that never saved the key resolves to. */
export function defaultTaxConfig(): TaxConfig {
  return { enabled: false, provider: TaxProvider.Native }
}

/** Whether an engine outside Flexprice calculates tax, as the API's `UsesExternalTaxEngine`. */
export function usesExternalTaxEngine(config: TaxConfig): boolean {
  return (
    config.enabled &&
    config.provider !== TaxProvider.Native &&
    config.provider !== TaxProvider.Flexprice
  )
}
