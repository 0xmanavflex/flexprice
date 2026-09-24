/**
 * The only module that reads `import.meta.env`.
 *
 * One place to look when a variable is missing, one place to validate, and no
 * component that silently depends on a build-time global.
 *
 * There is no API-key variable here and there will not be one. A Flexprice API
 * key in a `VITE_` variable is compiled into the bundle and served to every
 * visitor.
 */
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing ${name}. Copy .env.example to .env.local.`)
  return value
}

/**
 * Serve the captured corpus instead of calling a backend.
 *
 * Opt-in rather than inferred from `DEV`: a developer debugging a real
 * integration in dev mode must not silently get mocks, and the only way to be
 * sure which one is running is to have asked for it.
 */
const useMocks = import.meta.env['VITE_USE_MOCKS'] === 'true'

export const env = {
  useMocks,
  // A mocked run never reaches the network, so the URL only has to be a valid
  // base for MSW to match against.
  apiUrl: useMocks
    ? (import.meta.env['VITE_FLEXPRICE_API_URL'] ?? 'https://mock.flexprice.test/v1')
    : required('VITE_FLEXPRICE_API_URL', import.meta.env['VITE_FLEXPRICE_API_URL']),
  /** Local development only — replaced by the real session once auth lands. */
  devToken: (import.meta.env['VITE_DEV_JWT'] as string | undefined) ?? null,
  environmentId: (import.meta.env['VITE_ENVIRONMENT_ID'] as string | undefined) ?? null,
} as const
