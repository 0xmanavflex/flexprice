/**
 * Intercom messenger adapter, ported from V1. Intercom fires no reliable close
 * event, so visibility is synthesised by polling `isVisible` plus the embed's
 * postMessage events.
 */
import Intercom from '@intercom/messenger-js-sdk'
import type {
  SupportChatAdapter,
  SupportChatUser,
  SupportChatVisibilityHandlers,
} from '../SupportChatAdapter'

const IntercomCommand = {
  Show: 'show',
  Hide: 'hide',
  IsVisible: 'isVisible',
} as const
type IntercomCommand = (typeof IntercomCommand)[keyof typeof IntercomCommand]

const IntercomPostMessageType = {
  Hide: 'intercom:hide',
  Show: 'intercom:show',
  BareHide: 'hide',
  BareShow: 'show',
} as const

type IntercomFn = (command: IntercomCommand) => unknown

interface IntercomWindow {
  Intercom?: IntercomFn
}

function intercomWindow(): IntercomWindow {
  return window as unknown as IntercomWindow
}

/** Intercom's widget iframe is always served from an *.intercom.io host, across all regions. */
export function isTrustedIntercomOrigin(origin: string): boolean {
  try {
    const { protocol, hostname } = new URL(origin)
    return (
      protocol === 'https:' && (hostname === 'intercom.io' || hostname.endsWith('.intercom.io'))
    )
  } catch {
    return false
  }
}

function isMessengerVisible(): boolean {
  try {
    return intercomWindow().Intercom?.(IntercomCommand.IsVisible) === true
  } catch {
    // The SDK may not be ready yet; treat as not visible.
    return false
  }
}

export function createIntercomAdapter(
  appId: string,
  pollIntervalMs: number,
  hideDefaultLauncher: boolean,
): SupportChatAdapter {
  let disposed = false
  let handlers: SupportChatVisibilityHandlers | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let messageListener: ((event: MessageEvent) => void) | null = null
  let lastVisible: boolean | null = null

  const stopPolling = () => {
    if (pollTimer !== null) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    if (messageListener) {
      window.removeEventListener('message', messageListener)
      messageListener = null
    }
  }

  return {
    async init(user: SupportChatUser): Promise<void> {
      if (typeof window === 'undefined') return
      Intercom({
        app_id: appId,
        user_id: user.id,
        ...(user.name ? { name: user.name } : {}),
        ...(user.email ? { email: user.email } : {}),
        // Intercom expects Unix seconds; SupportChatUser.createdAt is epoch ms.
        ...(user.createdAt ? { created_at: Math.floor(user.createdAt / 1000) } : {}),
        hide_default_launcher: hideDefaultLauncher,
        // The launcher sits in the bottom-left corner, where Pylon's bubble does.
        alignment: 'left',
      })
    },

    show(): void {
      if (disposed || typeof window === 'undefined') return
      try {
        intercomWindow().Intercom?.(IntercomCommand.Show)
      } catch {
        // The SDK may not be ready yet; opening is best-effort.
      }
    },

    subscribe(next: SupportChatVisibilityHandlers): () => void {
      handlers = next
      if (typeof window === 'undefined') return () => undefined

      stopPolling()
      lastVisible = null

      pollTimer = setInterval(() => {
        if (disposed) return
        // Capture before reassigning, or the null guard below emits a spurious first close.
        const previous = lastVisible
        const visible = isMessengerVisible()
        if (visible === previous) return
        lastVisible = visible
        if (visible) handlers?.onShow()
        else if (previous !== null) handlers?.onHide()
      }, pollIntervalMs)

      messageListener = (event: MessageEvent) => {
        if (
          disposed ||
          !isTrustedIntercomOrigin(event.origin) ||
          !event.data ||
          typeof event.data !== 'object'
        )
          return
        const type = (event.data as { type?: string }).type
        if (type === IntercomPostMessageType.Hide || type === IntercomPostMessageType.BareHide) {
          lastVisible = false
          handlers?.onHide()
        } else if (
          type === IntercomPostMessageType.Show ||
          type === IntercomPostMessageType.BareShow
        ) {
          lastVisible = true
          handlers?.onShow()
        }
      }
      window.addEventListener('message', messageListener)

      return () => {
        handlers = null
        stopPolling()
      }
    },

    dispose(): void {
      disposed = true
      handlers = null
      stopPolling()
    },
  }
}
