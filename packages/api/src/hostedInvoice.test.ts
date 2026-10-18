import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorKind } from './errors'
import { getHostedInvoice, getHostedInvoiceDownload, payHostedInvoice } from './hostedInvoice'

const ORIGIN = 'https://us.api.test'
const TOKEN = 'hit_01TEST.sig'

/** Drives the real module with a stub `fetch`, as `settings.test.ts` does. */
function harness(respond: (request: Request) => Response = () => ok({})) {
  const seen: Request[] = []
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input as RequestInfo, init)
    seen.push(request)
    return respond(request)
  })
  return { seen }
}

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('hosted invoice public API', () => {
  it('reads the invoice with only the session token', async () => {
    const { seen } = harness(() => ok({ invoice: { id: 'inv_1' } }))

    await expect(getHostedInvoice(ORIGIN, TOKEN)).resolves.toEqual({ invoice: { id: 'inv_1' } })

    const [request] = seen
    expect(request?.method).toBe('GET')
    expect(request?.url).toBe('https://us.api.test/public/v1/invoices')
    expect(request?.headers.get('X-Session-Token')).toBe(TOKEN)
    expect(request?.headers.has('Authorization')).toBe(false)
    expect(request?.headers.has('X-Environment-ID')).toBe(false)
    expect(request?.referrerPolicy).toBe('no-referrer')
  })

  it('reads the download URL', async () => {
    const { seen } = harness(() => ok({ presigned_url: 'https://s3.test/x.pdf' }))

    await getHostedInvoiceDownload(ORIGIN, TOKEN)

    expect(seen[0]?.url).toBe('https://us.api.test/public/v1/invoices/download')
  })

  it('pays with the idempotency key in the body', async () => {
    const { seen } = harness(() => ok({ payment_id: 'pay_1' }))

    await payHostedInvoice(ORIGIN, TOKEN, 'key-1')

    const [request] = seen
    expect(request?.method).toBe('POST')
    expect(request?.url).toBe('https://us.api.test/public/v1/invoices/pay')
    expect(await request?.json()).toEqual({ idempotency_key: 'key-1' })
  })

  it('reports the backend message on 404', async () => {
    harness(
      () => new Response(JSON.stringify({ error: { message: 'This link is not valid.' } }), { status: 404 }),
    )

    await expect(getHostedInvoice(ORIGIN, TOKEN)).rejects.toMatchObject({
      kind: ErrorKind.NotFound,
      status: 404,
      message: 'This link is not valid.',
      fromServer: true,
    })
  })

  it('does not double the slash after the origin', async () => {
    const { seen } = harness()

    await getHostedInvoice(`${ORIGIN}/`, TOKEN)

    expect(seen[0]?.url).toBe('https://us.api.test/public/v1/invoices')
  })
})
