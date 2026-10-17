import { request } from './settings'

/**
 * `POST /wallets/{id}/debit`.
 *
 * Live on the API and absent from `@flexprice/sdk` 2.1.39 (the published
 * swagger stops at top-up). The only accepted reason is a manual debit.
 * `idempotency_key` is required, so a repeated submit of the same dialog
 * does not debit twice.
 */
export async function debitWallet(
  serverURL: string,
  token: string,
  environmentId: string,
  walletId: string,
  body: { credits: string; idempotencyKey: string; description?: string },
): Promise<unknown> {
  return request(serverURL, `/wallets/${encodeURIComponent(walletId)}/debit`, {
    method: 'POST',
    token,
    environmentId,
    body: {
      credits: body.credits,
      transaction_reason: 'MANUAL_BALANCE_DEBIT',
      idempotency_key: body.idempotencyKey,
      ...(body.description ? { description: body.description } : {}),
    },
  })
}
