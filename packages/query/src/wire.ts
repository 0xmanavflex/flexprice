import { ApiError, type AuthSource, ErrorKind } from '@fp/api'

/**
 * The boundary between the backend's snake_case JSON and the camelCase shapes
 * the mappers read (what the SDK used to hand them). Used by the raw-fetch
 * calls in `@fp/api`.
 */

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/

const camel = (key: string) => key.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase())
const snake = (key: string) => key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`)

function convert(value: unknown, rename: (key: string) => string, revive: boolean): unknown {
  if (Array.isArray(value)) return value.map((item) => convert(item, rename, revive))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        rename(key),
        // Customer-chosen keys and values pass through untouched.
        key === 'metadata' ? item : convert(item, rename, revive),
      ]),
    )
  }
  if (revive && typeof value === 'string' && ISO_TIMESTAMP.test(value)) {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date
  }
  return value
}

/** A response body: keys camelCased, timestamps revived as `Date`. */
export function fromWire<T = unknown>(body: unknown): T {
  return convert(body, camel, true) as T
}

/** A request body: keys snake_cased. */
export function toWireBody(body: Record<string, unknown>): Record<string, unknown> {
  return convert(body, snake, false) as Record<string, unknown>
}

/** The token and environment a raw call needs, or the error a signed-out reader gets. */
export async function credentials(
  auth: AuthSource,
  signedOutMessage: string,
): Promise<{ token: string; environmentId: string }> {
  const [token, environmentId] = await Promise.all([auth.getToken(), auth.getEnvironmentId()])
  if (!token) throw new ApiError(ErrorKind.Unauthorized, signedOutMessage)
  return { token, environmentId: environmentId ?? '' }
}
