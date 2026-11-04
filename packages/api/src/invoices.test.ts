import { afterEach, describe, expect, it, vi } from 'vitest'
import { getInvoicePdfUrl } from './invoices'

const ORIGIN = 'https://us.api.test'

function harness(body: unknown) {
  const seen: Request[] = []
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push(new Request(input as RequestInfo, init))
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  return { seen }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getInvoicePdfUrl', () => {
  it('asks the PDF route for a presigned link, as V1 does', async () => {
    const { seen } = harness({ presigned_url: 'https://files.test/inv_1.pdf' })

    await expect(getInvoicePdfUrl(ORIGIN, 'tok', 'env_1', 'inv_1')).resolves.toBe(
      'https://files.test/inv_1.pdf',
    )
    expect(seen[0]?.method).toBe('GET')
    expect(seen[0]?.url).toBe('https://us.api.test/invoices/inv_1/pdf?url=true')
    expect(seen[0]?.headers.get('X-Environment-ID')).toBe('env_1')
  })

  it('answers null when the route gives no link', async () => {
    harness({})
    await expect(getInvoicePdfUrl(ORIGIN, 'tok', 'env_1', 'inv_1')).resolves.toBeNull()
  })
})
