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
 * Tenant settings: the routes the SDK cannot make, part two.
 *
 * `settings.go` carries no swagger annotations, so `GET/PUT/DELETE
 * /settings/{key}` are absent from the OpenAPI document and therefore from
 * every generated SDK — the same gap `session.ts` describes, and the same
 * `docs/api-contract-gap.md`. They are not, however, absent from the API.
 * Every key in `SettingKey` except SAML answers 200 against
 * `api.cloud.flexprice.io` today, verified by hand. An earlier reading of this
 * package concluded the Settings screens had "no backend contract"; that was a
 * conclusion about the SDK, not about the API, and this module is the
 * correction.
 *
 * Two neighbours ride along because they have the same problem and the same
 * shape of fix:
 *
 *   - `GET /webhooks/dashboard`, which is undocumented outright, and
 *   - `GET /tenants/billing`, which is documented at the wrong path. The SDK's
 *     `getTenantBillingUsage` calls `/tenant/billing`, singular, and gets a
 *     plain-text 404. One character. See `fetchTenantBilling` below.
 *
 * Like `session.ts` this speaks `fetch` directly and is deliberately **not** a
 * `@fp/sdk-adapter` shim: a shim must name the GitHub issue whose closure
 * deletes it, and inventing an issue number to satisfy a lint rule is how a
 * temporary layer becomes permanent. It is one file so that annotating the
 * handlers makes deleting it a diff and not a project.
 *
 * Everything here throws `ApiError`. A caller never learns whether a failure
 * came from the SDK or from here.
 *
 * ## Two facts about these routes that shape the code below
 *
 * **They are environment-scoped.** Without `X-Environment-ID` the API answers
 * `403 {"error":"Access denied","message":"Invalid or inaccessible
 * environment"}` — not a 401, and not an empty result. Every function here
 * therefore takes an environment id and refuses to send the request without
 * one.
 *
 * **A read is not proof that anything is stored.** A key that has never been
 * written still answers 200, with the backend's defaults in `value` and an
 * envelope of zero values (`id: ""`, `status: ""`, `created_at:
 * "0001-01-01T00:00:00Z"`). Only `value` carries information, which is why
 * these functions return it and drop the rest: a caller that branched on
 * `id` would be reading a field that is also empty, intermittently, on a
 * stored setting — see the note on `getSetting`.
 */

/** The keys behind `/settings/{key}`. The route's own spelling. */
export const SettingKey = {
  InvoiceConfig: 'invoice_config',
  SubscriptionConfig: 'subscription_config',
  CustomCurrencyConfig: 'custom_currency_config',
  CustomerPortalConfig: 'customer_portal_config',
  CustomerOnboarding: 'customer_onboarding',
  WalletBalanceAlertConfig: 'wallet_balance_alert_config',
  TaxConfig: 'tax_config',
  /** Bonus credits on a purchased wallet top-up, by slab. */
  BonusCreditsTopupConfig: 'bonus_credits_topup_config',
  RevenueRecognitionConfig: 'revenue_recognition_config',
  /** 404s on deployments without SSO. See `useSamlConfig` in `@fp/query`. */
  SamlConfig: 'saml_config',
} as const
export type SettingKey = (typeof SettingKey)[keyof typeof SettingKey]

/**
 * What `GET /webhooks/dashboard` returns.
 *
 * **`token` and `url` are live credentials.** The token is a Svix app token and
 * the url is a one-time `https://app.svix.com/login#key=…` link that signs the
 * holder in to this tenant's webhook portal. Neither may be logged, written to
 * a file, put in an error message, or sent to any analytics sink. They exist to
 * be handed to an iframe or an anchor and nothing else — treat them the way you
 * would treat the session JWT, which is to say: pass them through, never
 * observe them.
 */
export interface WebhookDashboard {
  appId: string
  svixEnabled: boolean
  token: string
  url: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function str(source: Record<string, unknown>, key: string): string {
  const value = source[key]
  return typeof value === 'string' ? value : ''
}

/**
 * One request path for every route in this file.
 *
 * Normalizing here rather than per-call is what lets the promise above hold: a
 * DNS failure, an HTML 502 and a JSON 403 all leave this module as the same
 * `ApiError` a caller would have got from the SDK path.
 */
export async function request(
  serverURL: string,
  path: string,
  init: { method: string; token: string; environmentId: string; body?: unknown },
): Promise<unknown> {
  if (init.environmentId.length === 0) {
    /*
     * Refused rather than sent.
     *
     * The API's answer to a missing `X-Environment-ID` is a 403 reading
     * "Access denied", which a user reads as "you are not allowed to see your
     * own settings" when the truth is that the console has not finished
     * choosing an environment yet. The hooks in `@fp/query` keep this
     * unreachable by staying disabled until an environment exists; this is the
     * backstop for a caller that does not.
     */
    throw new ApiError(ErrorKind.Forbidden, 'Choose an environment first.')
  }

  const url = `${serverURL.replace(/\/+$/, '')}${path}`
  const headers = new Headers({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${init.token}`,
    'X-Environment-ID': init.environmentId,
  })

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
 * Unwraps the settings envelope.
 *
 * Every settings route answers `{id, key, value, environment_id, tenant_id,
 * status, created_at, updated_at, created_by, updated_by}` and only `value`
 * is worth keeping. The envelope is dropped here rather than returned and
 * ignored, because it invites exactly one bug: reading `id` to decide whether
 * a setting is "customised". It is empty on a defaulted key, and — verified
 * live, and the most surprising thing this API does — it is *also* empty on
 * some reads of a key that certainly is stored. Consecutive GETs a second
 * apart returned the same `value` with `id` alternating between
 * `"setting_01M3…"` and `""`, which reads as replicas whose caches disagree.
 * The value was consistent throughout. So: trust `value`, and nothing else.
 */
function unwrap(body: unknown): unknown {
  return isRecord(body) && 'value' in body ? body['value'] : body
}

/**
 * Reads one setting's value.
 *
 * Returns the raw JSON — this package does not model it, `@fp/domain` does.
 * A key that has never been written is not an error and not empty: the backend
 * answers 200 with its own defaults, so a caller always has something to render
 * and never has to distinguish "unset" from "set to the default". (It cannot:
 * see `unwrap`.)
 */
export async function getSetting(
  serverURL: string,
  token: string,
  environmentId: string,
  key: SettingKey,
): Promise<unknown> {
  return unwrap(
    await request(serverURL, `/settings/${key}`, { method: 'GET', token, environmentId }),
  )
}

/**
 * Writes one setting's value, and returns what was saved.
 *
 * The body is `{value: …}` — the envelope's other fields are server-owned and
 * sending them changes nothing. Verified live: `PUT
 * /settings/subscription_config {"value":{"auto_cancellation_enabled":false,
 * "grace_period_days":4}}` answers 200 with the full envelope, its `value`
 * echoing the write and its `id`/`status`/`created_by` now populated.
 *
 * The response is preferred to the request as the new cache contents for the
 * usual reason — the server may normalise, default or reject fields — and for
 * one specific to this API: an immediate re-GET can be served by a replica that
 * has not seen the write yet, so the write's own response is the freshest
 * answer available. See `useUpdateSetting` in `@fp/query`, which seeds the
 * cache from it before invalidating.
 *
 * `value` is sent whole. These endpoints replace rather than merge, so a caller
 * that assembles a partial object silently deletes the fields it left out —
 * which is why the domain models here are total, and why the portal config is
 * modelled as its real nested shape rather than the five booleans V1 projected
 * it down to.
 */
export async function putSetting(
  serverURL: string,
  token: string,
  environmentId: string,
  key: SettingKey,
  value: unknown,
): Promise<unknown> {
  const body = await request(serverURL, `/settings/${key}`, {
    method: 'PUT',
    token,
    environmentId,
    body: { value },
  })
  return unwrap(body)
}

/**
 * Deletes one setting, returning it to the backend's defaults.
 *
 * It deletes the *stored row*, not the setting: the next read still answers 200
 * with defaults. That is what makes "reset" a delete, and it is why a 404 here
 * is a success in disguise — there was nothing stored to remove, so the caller
 * is already in the state it asked for.
 *
 * That tolerance is not applied here. This function reports what the API said
 * and `useResetSetting` in `@fp/query` decides that a `NotFound` is fine,
 * because "a missing row means reset succeeded" is a statement about the reset
 * flow, not about `DELETE`.
 */
export async function deleteSetting(
  serverURL: string,
  token: string,
  environmentId: string,
  key: SettingKey,
): Promise<void> {
  await request(serverURL, `/settings/${key}`, { method: 'DELETE', token, environmentId })
}

/**
 * The tenant's Svix webhook portal: an app id, and a way in.
 *
 * **Read the credentials note on `WebhookDashboard` before touching the
 * result.** `token` and `url` sign the holder in to this tenant's webhook
 * portal. This function deliberately does not log, and nothing that handles
 * its result should either — including an error path, where the reflex to
 * attach "the response we got" is strongest and worst.
 *
 * `svix_enabled: false` is a real answer on a deployment without webhooks. It
 * comes back as `svixEnabled: false` with the other fields empty, and is the
 * caller's cue to render an unavailable state rather than an empty iframe.
 */
export async function fetchWebhookDashboard(
  serverURL: string,
  token: string,
  environmentId: string,
): Promise<WebhookDashboard> {
  const body = await request(serverURL, '/webhooks/dashboard', {
    method: 'GET',
    token,
    environmentId,
  })
  const row = isRecord(body) ? body : {}

  return {
    appId: str(row, 'app_id'),
    svixEnabled: row['svix_enabled'] === true,
    token: str(row, 'token'),
    url: str(row, 'url'),
  }
}

/**
 * What Flexprice is billing this tenant — plan and entitlement usage.
 *
 * Here for one character. The deployed route is `GET /v1/tenants/billing`;
 * the OpenAPI document says `/v1/tenant/billing`, so the SDK's generated
 * `tenants.getTenantBillingUsage()` calls the singular path and gets
 * `404 text/plain "404 page not found"` — a route that does not exist, not a
 * tenant without billing. Verified live: the plural path returns 200 with the
 * `{usage, subscriptions}` body the SDK's own response model describes.
 *
 * SDK 2.1.43 adds `selfBilling.getTenantBillingSummary()` on the plural path,
 * so this function and its caller can move to it (camelCased, so `@fp/query`'s
 * normalising step goes too). Nothing here should grow: it exists to stop a
 * correct screen from rendering an error until that switch is made.
 *
 * Returns the raw JSON body, which — unlike everything reached through the SDK
 * — is **snake_case**, because there is no generated client to camelCase it.
 * `@fp/query`'s `tenant.ts` normalises it into the same wire shape the SDK
 * would have produced, so the mapper and its tests stay the ones that will
 * survive the fix.
 */
export async function fetchTenantBilling(
  serverURL: string,
  token: string,
  environmentId: string,
): Promise<unknown> {
  return request(serverURL, '/tenants/billing', { method: 'GET', token, environmentId })
}
