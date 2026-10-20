import {
  ApiError,
  ErrorKind,
  kindForStatus,
  parseRetryAfter,
  readErrorBody,
  toApiError,
} from './errors'
import { fetchWithTimeout, transportError } from './timeout'

/**
 * Session bootstrap: the calls the SDK cannot make.
 *
 * `auth.go` carries 0 swagger annotations on 2 handlers and `environment.go`
 * carries 1 on 5, so `POST /auth/login`, `POST /auth/signup`, `GET /users/me`,
 * `GET /environments` and `POST /environments` are live, RBAC-protected routes
 * that are absent from the OpenAPI document and therefore from every generated
 * SDK — see `docs/api-contract-gap.md`. They are exactly the calls a session is
 * built from: you cannot ask the SDK who you are, and you cannot ask it which
 * environment to put in the header every other call requires.
 *
 * So this module speaks `fetch` directly, and is deliberately **not** a
 * `@fp/sdk-adapter` shim: a shim must name the GitHub issue whose closure
 * deletes it, and inventing an issue number to satisfy a lint rule is how a
 * temporary layer becomes permanent. It is kept to one file so that when the
 * handlers are annotated, deleting it is a diff and not a project.
 *
 * Everything here throws `ApiError`, like the rest of this package — a caller
 * never learns whether a failure came from the SDK or from here.
 */

/** What `POST /auth/login` and `POST /auth/signup` return. */
export interface SessionCredentials {
  token: string
  userId: string
  tenantId: string
}

/** What `GET /users/me` returns, narrowed to what a console header needs. */
export interface CurrentUser {
  id: string
  email: string
  roles: string[]
  /** `user` or `service_account`: which role catalogue the roles come from. */
  type: string
  tenantId: string
  tenantName: string
}

/** What `GET /environments` returns, in the API's own vocabulary. */
export interface EnvironmentRecord {
  id: string
  name: string
  /** `production` | `development` — the API's string, not a domain enum. */
  type: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function str(source: Record<string, unknown>, key: string): string {
  const value = source[key]
  return typeof value === 'string' ? value : ''
}

/**
 * One request path for all four routes.
 *
 * Normalizing here rather than per-call is what keeps the promise above: a
 * network failure, an HTML 502 from a load balancer and a JSON 401 all leave
 * this module as the same `ApiError` shape the SDK path produces.
 */
async function request(
  serverURL: string,
  path: string,
  init: {
    method: string
    token?: string | null
    body?: unknown
    /**
     * `X-Environment-ID`. Only the discovery routes (listing, creating and
     * reading environments, `/users/me`) are served without one; anything else
     * — renaming an environment included — is refused with 403 "Invalid or
     * inaccessible environment" when it is missing.
     */
    environmentId?: string
  },
): Promise<unknown> {
  const url = `${serverURL.replace(/\/+$/, '')}${path}`
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (init.token) headers.set('Authorization', `Bearer ${init.token}`)
  if (init.environmentId) headers.set('X-Environment-ID', init.environmentId)

  let response: Response
  try {
    response = await fetchWithTimeout(url, {
      method: init.method,
      headers,
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    })
  } catch (cause) {
    // `fetch` rejects only for transport: offline, DNS, CORS, abort, deadline.
    // There is no status to classify, so the kind is read off the rejection.
    throw transportError(cause)
  }

  const text = await response.text()

  if (!response.ok) {
    const { message, details, fromServer } = readErrorBody(
      text,
      response.statusText || `The request failed (${response.status}).`,
    )
    const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'))
    throw new ApiError(kindForStatus(response.status), message, {
      status: response.status,
      ...(details ? { details } : {}),
      ...(fromServer ? { fromServer } : {}),
      ...(response.status === 429 && retryAfterMs !== undefined ? { retryAfterMs } : {}),
    })
  }

  if (text.length === 0) return null
  try {
    return JSON.parse(text)
  } catch (cause) {
    throw toApiError(cause)
  }
}

/**
 * Exchanges an email and password for a JWT.
 *
 * The JWT is minted by the tenant's identity provider (Supabase on the hosted
 * deployments) and returned by the backend, which is why this is one call and
 * not a provider SDK in the browser: the console never needs to know which
 * provider a deployment runs.
 */
export async function signIn(
  serverURL: string,
  email: string,
  password: string,
): Promise<SessionCredentials> {
  const body = await request(serverURL, '/auth/login', {
    method: 'POST',
    body: { email, password },
  })
  return toCredentials(body)
}

/**
 * Creates the account and its organisation — `POST /auth/signup`.
 *
 * What it needs depends on the deployment's identity provider:
 *
 *   - **Supabase** (the hosted regions) takes no password. The person has
 *     already registered with Supabase from the browser and confirmed their
 *     email; `token` is that confirmed session's access token, and the backend
 *     refuses without it ("A verified sign-in is required to create an
 *     account"). The email must match the token's.
 *   - **Flexprice's own provider** (self-hosted) takes the email and password
 *     directly and needs no token.
 *
 * `metadata` is free-form attribution the backend stores on the tenant.
 */
export async function signUp(
  serverURL: string,
  details: {
    email: string
    password?: string | undefined
    token?: string | undefined
    metadata?: Record<string, string> | undefined
  },
): Promise<SessionCredentials> {
  const body = await request(serverURL, '/auth/signup', {
    method: 'POST',
    body: {
      email: details.email,
      ...(details.password ? { password: details.password } : {}),
      ...(details.token ? { token: details.token } : {}),
      ...(details.metadata ? { metadata: details.metadata } : {}),
    },
  })
  return toCredentials(body)
}

function toCredentials(body: unknown): SessionCredentials {
  if (!isRecord(body) || typeof body['token'] !== 'string' || body['token'].length === 0) {
    // A 200 with no token is a backend that changed shape. Failing loudly
    // beats storing `undefined` and signing the user in to a blank console.
    throw new ApiError(ErrorKind.Unknown, 'Flexprice did not return a session token.')
  }
  return {
    token: body['token'],
    userId: str(body, 'user_id'),
    tenantId: str(body, 'tenant_id'),
  }
}

/**
 * Who the token belongs to.
 *
 * Exempt from `X-Environment-ID` — it is what decides whose environments to
 * list, so gating it on one deadlocks sign-in.
 */
export async function fetchCurrentUser(serverURL: string, token: string): Promise<CurrentUser> {
  const body = await request(serverURL, '/users/me', { method: 'GET', token })
  if (!isRecord(body)) {
    throw new ApiError(ErrorKind.Unknown, 'Flexprice returned an unrecognised user.')
  }
  const tenant = isRecord(body['tenant']) ? body['tenant'] : {}
  const roles = Array.isArray(body['roles'])
    ? body['roles'].filter((role): role is string => typeof role === 'string')
    : []

  return {
    id: str(body, 'id'),
    email: str(body, 'email'),
    roles,
    type: str(body, 'type') || 'user',
    tenantId: str(tenant, 'id'),
    tenantName: str(tenant, 'name'),
  }
}

/**
 * The environments the token can act in.
 *
 * Also exempt from `X-Environment-ID`: fetching this list is *how* an active
 * environment gets chosen, and every other route 403s without the header.
 */
export async function fetchEnvironments(
  serverURL: string,
  token: string,
): Promise<EnvironmentRecord[]> {
  const body = await request(serverURL, '/environments', { method: 'GET', token })
  const rows = isRecord(body) && Array.isArray(body['environments']) ? body['environments'] : []

  return rows.filter(isRecord).map((row) => ({
    id: str(row, 'id'),
    name: str(row, 'name'),
    type: str(row, 'type'),
  }))
}

/**
 * Creates an environment.
 *
 * `POST /environments` is undocumented for the same reason the list is — one
 * of `environment.go`'s five handlers is annotated, and it is the clone — but
 * it is live and it validates. Sending `{name, type}` against the hosted API
 * returns a `validation_error` naming the tenant's per-type quota
 * ("You have reached the maximum limit of 2 development environment(s)"),
 * which is a handler that ran, not a route that is missing.
 *
 * That quota is the reason this returns the API's error rather than swallowing
 * it: whether a tenant may create another environment is a server-side fact
 * this package cannot compute, so the only honest answer is to ask and report
 * what comes back.
 *
 * The success body is read with the same tolerance as the list. A 2xx with no
 * `id` still means created — the caller refetches the list and sees it — so it
 * is reported as an empty id rather than thrown, and the caller decides
 * whether it can switch to something it cannot name.
 */
export async function createEnvironment(
  serverURL: string,
  token: string,
  draft: { name: string; type: string },
): Promise<EnvironmentRecord> {
  const body = await request(serverURL, '/environments', {
    method: 'POST',
    token,
    body: { name: draft.name, type: draft.type },
  })
  const row = isRecord(body) ? body : {}

  return {
    id: str(row, 'id'),
    // Echoed back when the response omits them: the request is what was
    // created, and a blank name in the switcher would be a worse lie than the
    // name we just sent.
    name: str(row, 'name') || draft.name,
    type: str(row, 'type') || draft.type,
  }
}

/**
 * Renames an environment.
 *
 * `PUT /environments/{id}` is the third of `environment.go`'s unannotated
 * handlers, undocumented for the same reason as the list and the create. It
 * takes `{name, type}` but only the name is mutable — the backend refuses a
 * type change outright — so this sends the name alone and leaves the type to
 * the server.
 *
 * There is no `DELETE /environments/{id}` route at all (the router registers
 * list, create, get, update and clone), which is why there is no delete here.
 *
 * The response is read with the same tolerance as create: a 2xx that omits a
 * field echoes back what was sent rather than blanking the switcher row.
 */
export async function updateEnvironment(
  serverURL: string,
  token: string,
  id: string,
  patch: { name: string },
): Promise<EnvironmentRecord> {
  const body = await request(serverURL, `/environments/${encodeURIComponent(id)}`, {
    method: 'PUT',
    token,
    // The route is environment-scoped; the environment being renamed is the scope.
    environmentId: id,
    body: { name: patch.name },
  })
  const row = isRecord(body) ? body : {}

  return {
    id: str(row, 'id') || id,
    name: str(row, 'name') || patch.name,
    type: str(row, 'type'),
  }
}
