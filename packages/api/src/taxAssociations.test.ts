import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, ErrorKind } from './errors'
import { deleteTaxAssociation } from './taxAssociations'

const SERVER = 'https://api.test.flexprice.io/v1'

function harness(respond: () => Response) {
  const seen: Request[] = []
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push(new Request(input as RequestInfo, init))
    return respond()
  })
  return { seen }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('deleteTaxAssociation', () => {
  it('treats the 200 with an empty body as success', async () => {
    const { seen } = harness(() => new Response('', { status: 200 }))

    await expect(deleteTaxAssociation(SERVER, 'jwt', 'env_1', 'ta_1')).resolves.toBeUndefined()
    expect(seen[0]?.method).toBe('DELETE')
    expect(seen[0]?.url).toBe(`${SERVER}/taxes/associations/ta_1`)
    expect(seen[0]?.headers.get('X-Environment-ID')).toBe('env_1')
  })

  it('still reports a real failure', async () => {
    harness(
      () => new Response(JSON.stringify({ error: { message: 'not found' } }), { status: 404 }),
    )

    const error: unknown = await deleteTaxAssociation(SERVER, 'jwt', 'env_1', 'ta_1').catch(
      (cause: unknown) => cause,
    )
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).kind).toBe(ErrorKind.NotFound)
  })
})
