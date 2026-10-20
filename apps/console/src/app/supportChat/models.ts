/*
 * Support chat, ported from V1 (`flexprice-front` src/models/SupportChat.ts).
 * The values are V1's: the analytics event names and storage keys are shared
 * with existing dashboards and history, and MUST NOT change.
 */

/** Support-chat providers the console can render. Exactly one is active per deployment. */
export const SupportChatProvider = {
  Intercom: 'intercom',
  Pylon: 'pylon',
} as const
export type SupportChatProvider = (typeof SupportChatProvider)[keyof typeof SupportChatProvider]

/** Messenger open/close state as observed by the hook. `Unknown` until the first event. */
export const SupportChatVisibility = {
  Unknown: 'unknown',
  Open: 'open',
  Closed: 'closed',
} as const
export type SupportChatVisibility =
  (typeof SupportChatVisibility)[keyof typeof SupportChatVisibility]

/** Adapter initialisation lifecycle. `show()` is a no-op unless `Ready`. */
export const SupportChatStatus = {
  Idle: 'idle',
  Initializing: 'initializing',
  Ready: 'ready',
  Failed: 'failed',
} as const
export type SupportChatStatus = (typeof SupportChatStatus)[keyof typeof SupportChatStatus]

/** gtag event names. Identical to V1's. */
export const SupportChatAnalyticsEvent = {
  IntercomOpened: 'intercom_messenger_opened',
  IntercomClosed: 'intercom_messenger_closed',
  PylonOpened: 'pylon_messenger_opened',
  PylonClosed: 'pylon_messenger_closed',
} as const
export type SupportChatAnalyticsEvent =
  (typeof SupportChatAnalyticsEvent)[keyof typeof SupportChatAnalyticsEvent]

/** localStorage keys. Identical to V1's. */
export const SupportChatStorageKey = {
  IntercomSeen: 'intercom_messenger_seen',
  PylonSeen: 'pylon_messenger_seen',
} as const
export type SupportChatStorageKey =
  (typeof SupportChatStorageKey)[keyof typeof SupportChatStorageKey]

/** The only value ever written under a `SupportChatStorageKey`. */
export const SupportChatStorageValue = { Seen: 'true' } as const

/** The DOM events that count as activity for the idle auto-open. */
export const UserActivityEvent = {
  MouseMove: 'mousemove',
  KeyDown: 'keydown',
  Scroll: 'scroll',
  TouchStart: 'touchstart',
} as const
export type UserActivityEvent = (typeof UserActivityEvent)[keyof typeof UserActivityEvent]

/** The window event the command palette fires to open the messenger. */
export const OPEN_SUPPORT_CHAT_EVENT = 'flexprice:open-support-chat'
