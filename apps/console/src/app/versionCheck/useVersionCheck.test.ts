// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const toastInfo = vi.hoisted(() => vi.fn())
vi.mock('@fp/ui/pages', () => ({ toast: { info: toastInfo } }))

const { LAST_DISMISSED_VERSION, VERSION_TOASTER_ID, useVersionCheck } =
  await import('./useVersionCheck')

let root: Root
const reload = vi.fn()

function Harness(props: { current: string | null; enabled: boolean }) {
  useVersionCheck({
    currentVersion: props.current,
    enabled: props.enabled,
    reload,
    intervalMs: 1000,
  })
  return null
}

function serve(versionId: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ versionId }) })),
  )
}

async function mount(current: string | null, enabled = true) {
  await act(async () => {
    root.render(createElement(Harness, { current, enabled }))
  })
  await act(async () => {
    await Promise.resolve()
  })
}

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  root = createRoot(document.createElement('div'))
  toastInfo.mockReset()
  reload.mockReset()
  localStorage.clear()
})

afterEach(() => {
  act(() => root.unmount())
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useVersionCheck (as V1)', () => {
  it('offers the update when a newer build is live, on its own toaster', async () => {
    serve('v2')
    await mount('v1')
    expect(toastInfo).toHaveBeenCalledOnce()
    const [title, options] = toastInfo.mock.calls[0]!
    expect(title).toBe('New version available')
    expect(options).toMatchObject({
      toasterId: VERSION_TOASTER_ID,
      description: 'A new software version is available for download.',
      duration: Infinity,
    })
    options.action.onClick()
    expect(reload).toHaveBeenCalledOnce()
  })

  it('stays quiet when this build is the live one', async () => {
    serve('v1')
    await mount('v1')
    expect(toastInfo).not.toHaveBeenCalled()
  })

  it('remembers "Not now" for that version only', async () => {
    serve('v2')
    await mount('v1')
    toastInfo.mock.calls[0]![1].cancel.onClick()
    expect(localStorage.getItem(LAST_DISMISSED_VERSION)).toBe('v2')

    toastInfo.mockReset()
    act(() => root.unmount())
    root = createRoot(document.createElement('div'))
    await mount('v1')
    expect(toastInfo).not.toHaveBeenCalled()

    serve('v3')
    act(() => root.unmount())
    root = createRoot(document.createElement('div'))
    await mount('v1')
    expect(toastInfo).toHaveBeenCalledOnce()
  })

  it('checks again on the interval', async () => {
    vi.useFakeTimers()
    serve('v1')
    await mount('v1')
    serve('v2')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(toastInfo).toHaveBeenCalledOnce()
  })

  it('does nothing outside production or without a version', async () => {
    serve('v2')
    await mount('v1', false)
    await mount(null, true)
    expect(fetch).not.toHaveBeenCalled()
    expect(toastInfo).not.toHaveBeenCalled()
  })
})
