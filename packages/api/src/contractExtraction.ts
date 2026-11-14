import { request } from './settings'

/**
 * Contract upload and AI extraction: `POST /contracts/upload` and
 * `GET /contracts/{id}`.
 *
 * Not SDK calls: the routes are newer than the published SDK, which has
 * neither the upload nor the `extraction*` fields on a contract. Replaced when
 * the SDK gains them. The result is the raw JSON; `@fp/query` maps it.
 */

/**
 * How long an upload may wait for the API to answer.
 *
 * The default deadline is 20 seconds and covers the wait for response
 * headers, which for an upload includes sending the body. A 20 MB contract on
 * a slow uplink needs longer than that; the route answers 202 as soon as the
 * file is stored, so this is the transfer, not the extraction.
 */
export const CONTRACT_UPLOAD_TIMEOUT_MS = 120_000

/** Stores the file and starts extraction; answers 202 with the draft contract. */
export async function uploadContract(
  serverURL: string,
  token: string,
  environmentId: string,
  file: Blob,
  fileName: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const form = new FormData()
  form.append('file', file, fileName)
  return request(serverURL, '/contracts/upload', {
    method: 'POST',
    token,
    environmentId,
    body: form,
    timeoutMs: CONTRACT_UPLOAD_TIMEOUT_MS,
    ...(signal ? { signal } : {}),
  })
}

/** One contract, with its extraction status, result or error. */
export async function getContract(
  serverURL: string,
  token: string,
  environmentId: string,
  id: string,
  signal?: AbortSignal,
): Promise<unknown> {
  return request(serverURL, `/contracts/${encodeURIComponent(id)}`, {
    method: 'GET',
    token,
    environmentId,
    ...(signal ? { signal } : {}),
  })
}
