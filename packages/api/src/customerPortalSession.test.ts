import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCustomerPortalSession } from './customerPortalSession'

function answer(body: unknown) {
  vi.stubGlobal(
    'fetch',
    async () =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createCustomerPortalSession', () => {
  it('keeps the portal link the API built, token and all', async () => {
    answer({ url: 'https://portal.flexprice.io/in?token=abc', token: 'abc', expires_at: null })
    await expect(
      createCustomerPortalSession('https://api.test', 'tok', 'env_1', 'cust-1'),
    ).resolves.toMatchObject({ token: 'abc', url: 'https://portal.flexprice.io/in?token=abc' })
  })

  it('drops a link that is not a web address', async () => {
    answer({ url: 'javascript:alert(1)', token: 'abc' })
    await expect(
      createCustomerPortalSession('https://api.test', 'tok', 'env_1', 'cust-1'),
    ).resolves.toMatchObject({ url: null })
  })
})
