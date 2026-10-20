import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateSampleEvents } from './sampleEvents'

const SERVER = 'https://api.test.flexprice.io/v1'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('generateSampleEvents', () => {
  it('asks the backend to stream sample events for one subscription, as V1 does', async () => {
    const seen: Request[] = []
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(new Request(input as RequestInfo, init))
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    })

    await generateSampleEvents(SERVER, 'jwt-abc', 'env_01TEST', {
      subscriptionId: 'subs_01',
      durationSeconds: 60,
    })

    expect(seen).toHaveLength(1)
    const [request] = seen
    expect(request!.method).toBe('POST')
    expect(request!.url).toBe(`${SERVER}/portal/onboarding/events`)
    expect(request!.headers.get('X-Environment-ID')).toBe('env_01TEST')
    expect(await request!.json()).toEqual({ subscription_id: 'subs_01', duration: 60 })
  })
})
