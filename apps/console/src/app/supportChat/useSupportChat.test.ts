// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { SupportChatAdapter, SupportChatVisibilityHandlers } from './SupportChatAdapter'
import { SUPPORT_CHAT_FLOW } from './config'
import { OPEN_SUPPORT_CHAT_EVENT, SupportChatProvider } from './models'

/*
 * V1's `useSupportChat.test.tsx`, ported. Two V1 cases do not apply: V2's user
 * has no name of its own (the tenant name is always the display name), and
 * V2's `useTenant` is keyed by tenant id already.
 */

const mocks = vi.hoisted(() => ({
  user: { id: 'user_1', email: 'ada@example.com', tenantId: 'tenant_1', tenantName: 'Acme' },
  tenant: {
    id: 'tenant_1',
    name: 'Acme',
    metadata: {} as Record<string, string>,
    createdAt: new Date(1_700_000_000_000),
  },
  mutate: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@fp/query', () => ({
  useCurrentUser: () => ({ data: mocks.user }),
  useTenant: () => ({ data: mocks.tenant, isLoading: false }),
  useUpdateTenantMetadata: () => ({ mutate: mocks.mutate }),
}))
vi.mock('@fp/ui/pages', () => ({ toast: mocks.toast }))
vi.mock('@/app/session', () => ({ useSession: () => ({ session: { token: 'jwt' } }) }))

const { useSupportChat } = await import('./useSupportChat')

const FLOW = SUPPORT_CHAT_FLOW[SupportChatProvider.Pylon]

interface FakeAdapter extends SupportChatAdapter {
  handlers: SupportChatVisibilityHandlers | null
  init: Mock<SupportChatAdapter['init']>
  show: Mock<SupportChatAdapter['show']>
  dispose: Mock<SupportChatAdapter['dispose']>
}

function fakeAdapter(initResult: Promise<void> = Promise.resolve()): FakeAdapter {
  const adapter: FakeAdapter = {
    handlers: null,
    init: vi.fn<SupportChatAdapter['init']>(() => initResult),
    show: vi.fn<SupportChatAdapter['show']>(),
    dispose: vi.fn<SupportChatAdapter['dispose']>(),
    subscribe(next) {
      adapter.handlers = next
      return () => {
        adapter.handlers = null
      }
    },
  }
  return adapter
}

let root: Root
let container: HTMLDivElement
let opened: () => void = () => undefined

function Harness({ adapter }: { adapter: SupportChatAdapter }) {
  opened = useSupportChat(adapter, FLOW).open
  return null
}

async function mount(adapter: SupportChatAdapter) {
  await act(async () => {
    root.render(createElement(Harness, { adapter }))
  })
}

const gtag = vi.fn()

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  root = createRoot(container)
  mocks.tenant.metadata = {}
  mocks.mutate.mockReset()
  mocks.toast.success.mockReset()
  mocks.toast.error.mockReset()
  gtag.mockReset()
  ;(window as unknown as { gtag?: unknown }).gtag = gtag
  localStorage.clear()
})

afterEach(() => {
  act(() => root.unmount())
  vi.useRealTimers()
})

describe('useSupportChat (as V1)', () => {
  it('initialises the adapter with the identified user, named by the tenant', async () => {
    const adapter = fakeAdapter()
    await mount(adapter)
    expect(adapter.init).toHaveBeenCalledWith({
      id: 'user_1',
      email: 'ada@example.com',
      name: 'Acme',
      createdAt: 1_700_000_000_000,
      tenantId: 'tenant_1',
    })
  })

  it('opens the messenger through the adapter once ready', async () => {
    const adapter = fakeAdapter()
    await mount(adapter)
    opened()
    expect(adapter.show).toHaveBeenCalledOnce()
  })

  it('does not open while the adapter has failed to initialise', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const adapter = fakeAdapter(Promise.reject(new Error('blocked')))
    await mount(adapter)
    opened()
    expect(adapter.show).not.toHaveBeenCalled()
  })

  it('emits the gtag opened event when the messenger becomes visible', async () => {
    const adapter = fakeAdapter()
    await mount(adapter)
    act(() => adapter.handlers?.onShow())
    expect(gtag).toHaveBeenCalledWith('event', 'pylon_messenger_opened', {
      user_id: 'user_1',
      tenant_id: 'tenant_1',
    })
  })

  it('marks the tenant onboarded when the messenger is dismissed, once', async () => {
    const adapter = fakeAdapter()
    await mount(adapter)
    act(() => adapter.handlers?.onShow())
    act(() => adapter.handlers?.onHide())
    act(() => adapter.handlers?.onHide())
    expect(mocks.mutate).toHaveBeenCalledOnce()
    expect(mocks.mutate.mock.calls[0]?.[0]).toEqual({
      name: 'Acme',
      metadata: { onboarding_completed: 'true' },
    })
  })

  it('does not mark the tenant onboarded when onboarding is already complete', async () => {
    mocks.tenant.metadata = { onboarding_completed: 'true' }
    const adapter = fakeAdapter()
    await mount(adapter)
    act(() => adapter.handlers?.onShow())
    act(() => adapter.handlers?.onHide())
    expect(mocks.mutate).not.toHaveBeenCalled()
  })

  it('ignores a hide that arrives without a preceding show', async () => {
    const adapter = fakeAdapter()
    await mount(adapter)
    act(() => adapter.handlers?.onHide())
    expect(mocks.mutate).not.toHaveBeenCalled()
    expect(gtag).not.toHaveBeenCalled()
  })

  it('never puts email or name into the gtag payload', async () => {
    const adapter = fakeAdapter()
    await mount(adapter)
    act(() => adapter.handlers?.onShow())
    act(() => adapter.handlers?.onHide())
    const payloads = JSON.stringify(gtag.mock.calls)
    expect(payloads).not.toContain('ada@example.com')
    expect(payloads).not.toContain('Acme')
    expect(gtag).toHaveBeenCalledWith('event', 'pylon_messenger_closed', {
      user_id: 'user_1',
      tenant_id: 'tenant_1',
      onboarding_completed: false,
    })
  })

  it('records the messenger as seen in localStorage on close', async () => {
    const adapter = fakeAdapter()
    await mount(adapter)
    act(() => adapter.handlers?.onShow())
    act(() => adapter.handlers?.onHide())
    expect(localStorage.getItem('pylon_messenger_seen')).toBe('true')
  })

  it('toasts on success and on failure of marking the tenant onboarded', async () => {
    const adapter = fakeAdapter()
    await mount(adapter)
    act(() => adapter.handlers?.onShow())
    act(() => adapter.handlers?.onHide())
    const options = mocks.mutate.mock.calls[0]?.[1] as {
      onSuccess: () => void
      onError: (error: Error) => void
    }
    options.onSuccess()
    expect(mocks.toast.success).toHaveBeenCalledWith("Welcome! You've been marked as onboarded.")
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    options.onError(new Error('nope'))
    expect(mocks.toast.error).toHaveBeenCalledWith(
      'Failed to update onboarding status. Please try again.',
    )
  })

  it('opens the messenger when the command palette action fires', async () => {
    const adapter = fakeAdapter()
    await mount(adapter)
    act(() => {
      window.dispatchEvent(new Event(OPEN_SUPPORT_CHAT_EVENT))
    })
    expect(adapter.show).toHaveBeenCalledOnce()
  })

  it('auto-opens after the inactivity delay while onboarding is incomplete', async () => {
    vi.useFakeTimers()
    const adapter = fakeAdapter()
    await mount(adapter)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FLOW.inactivityOpenDelayMs)
    })
    expect(adapter.show).toHaveBeenCalled()
  })

  it('does not auto-open once onboarding is complete', async () => {
    vi.useFakeTimers()
    mocks.tenant.metadata = { onboarding_completed: 'true' }
    const adapter = fakeAdapter()
    await mount(adapter)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FLOW.inactivityOpenDelayMs * 2)
    })
    expect(adapter.show).not.toHaveBeenCalled()
  })

  it('disposes the adapter exactly once, on unmount', async () => {
    const adapter = fakeAdapter()
    await mount(adapter)
    expect(adapter.dispose).not.toHaveBeenCalled()
    act(() => root.unmount())
    expect(adapter.dispose).toHaveBeenCalledOnce()
    root = createRoot(container)
  })
})
