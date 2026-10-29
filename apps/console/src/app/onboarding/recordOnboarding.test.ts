import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  captureError: vi.fn(),
  env: { googleSheetsWebAppUrl: null as string | null, useMocks: false },
}))
vi.mock('@/app/analytics', () => ({ captureError: mocks.captureError }))
vi.mock('@/env', () => ({ env: mocks.env }))

import { findAppsScriptError, recordOnboarding } from './recordOnboarding'

const ROW = {
  orgName: 'Acme',
  orgUrl: 'https://acme.com',
  referralSource: 'Reddit',
  userEmail: 'dana@acme.com',
  tenantId: 'tenant_1',
  timestamp: '2026-10-29T10:00:00.000Z',
}
const URL = 'https://script.google.com/macros/s/abc/exec'

function respond(body: string, init: ResponseInit = {}) {
  return vi.fn(async () => new Response(body, init))
}

describe('recordOnboarding', () => {
  beforeEach(() => {
    mocks.captureError.mockReset()
    mocks.env.googleSheetsWebAppUrl = null
    mocks.env.useMocks = false
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => vi.restoreAllMocks())

  it('posts the row as a text/plain JSON body, so no CORS preflight is sent', async () => {
    const fetch = respond('{"result":"success"}', {
      headers: { 'content-type': 'application/json' },
    })
    await recordOnboarding(ROW, { url: URL, fetch })
    expect(fetch).toHaveBeenCalledWith(
      URL,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(ROW),
      }),
    )
    expect(mocks.captureError).not.toHaveBeenCalled()
  })

  it('reads the URL from the environment by default', async () => {
    mocks.env.googleSheetsWebAppUrl = URL
    const fetch = respond('ok')
    await recordOnboarding(ROW, { fetch })
    expect(fetch).toHaveBeenCalledWith(URL, expect.anything())
  })

  it('reports a missing URL and sends nothing', async () => {
    const fetch = respond('ok')
    await recordOnboarding(ROW, { url: null, fetch })
    expect(fetch).not.toHaveBeenCalled()
    expect(mocks.captureError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('not configured') }),
      expect.objectContaining({ tenantId: 'tenant_1' }),
    )
  })

  it('stays quiet about a missing URL under mocks', async () => {
    mocks.env.useMocks = true
    await recordOnboarding(ROW, { url: null, fetch: respond('ok') })
    expect(mocks.captureError).not.toHaveBeenCalled()
  })

  it('reports an HTTP error', async () => {
    await recordOnboarding(ROW, { url: URL, fetch: respond('boom', { status: 500 }) })
    expect(mocks.captureError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('HTTP 500') }),
      expect.anything(),
    )
  })

  it('reports an Apps Script failure served as HTTP 200', async () => {
    const fetch = respond('<html>No such user</html>', { headers: { 'content-type': 'text/html' } })
    await recordOnboarding(ROW, { url: URL, fetch })
    expect(mocks.captureError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('No such user') }),
      expect.anything(),
    )
  })

  it('never throws, and reports a network failure', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(recordOnboarding(ROW, { url: URL, fetch })).resolves.toBeUndefined()
    expect(mocks.captureError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Failed to fetch') }),
      expect.anything(),
    )
  })

  it('gives up after the timeout', async () => {
    const fetch = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
        }),
    ) as unknown as typeof globalThis.fetch
    await recordOnboarding(ROW, { url: URL, fetch, timeoutMs: 10 })
    expect(mocks.captureError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('timed out') }),
      expect.anything(),
    )
  })

  it('leaves the email out of what it reports', async () => {
    await recordOnboarding(ROW, { url: URL, fetch: respond('x', { status: 502 }) })
    expect(JSON.stringify(mocks.captureError.mock.calls)).not.toContain('dana@acme.com')
  })
})

describe('findAppsScriptError', () => {
  it('passes a real result', () => {
    expect(findAppsScriptError('{"result":"success"}', 'application/json')).toBeNull()
  })

  it('spots an error page by its title', () => {
    expect(findAppsScriptError('<title> Error </title>', 'text/html; charset=utf-8')).toBe(
      'Apps Script returned an error page',
    )
  })
})
