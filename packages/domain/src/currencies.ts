/** The currencies most accounts bill in, offered first. */
const COMMON = ['USD', 'EUR', 'GBP', 'INR']

/**
 * Every ISO 4217 currency the runtime knows, the common four first and the
 * rest alphabetical: the same breadth V1's currency picker offers. Falls back
 * to the common four where `Intl.supportedValuesOf` is missing.
 */
export function currencyCodes(): string[] {
  const supported =
    typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl
      ? (Intl as unknown as { supportedValuesOf: (key: 'currency') => string[] }).supportedValuesOf(
          'currency',
        )
      : []
  const rest = supported
    .map((code) => code.toUpperCase())
    .filter((code) => !COMMON.includes(code))
    .sort()
  return [...COMMON, ...rest]
}
