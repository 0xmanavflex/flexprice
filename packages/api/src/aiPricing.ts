import { request } from './settings'

/**
 * `POST /ai/pricing/parse-gemini` — a description of a pricing page, as a
 * pricing schema.
 *
 * A server-side proxy, not a model call from the browser: the prompt and the
 * response schema go up with the session's own token and the key stays on the
 * backend. V1 reaches it the same way (`src/api/AiPricingParseApi.ts`).
 *
 * Absent from the SDK, so like `creditNotes.ts` and `creditGrants.ts` this
 * speaks `fetch` directly and returns raw JSON for `@fp/domain` to parse.
 */
export interface ParsePricingParams {
  systemPrompt: string
  userPrompt: string
  responseSchema: Record<string, unknown>
}

export async function parsePricing(
  serverURL: string,
  token: string,
  environmentId: string,
  params: ParsePricingParams,
): Promise<unknown> {
  return request(serverURL, '/ai/pricing/parse-gemini', {
    method: 'POST',
    token,
    environmentId,
    body: params,
  })
}
