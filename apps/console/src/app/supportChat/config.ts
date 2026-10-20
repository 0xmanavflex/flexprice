/*
 * Support chat configuration, ported from V1 (`src/config/support-chat.ts`).
 * Every behaviour knob and every decision is V1's.
 */
import { env } from '@/env'
import { isValidPylonAppId } from './adapters/pylon'
import {
  SupportChatAnalyticsEvent,
  SupportChatProvider,
  SupportChatStorageKey,
  UserActivityEvent,
} from './models'

/** Behaviour knobs for the messenger. */
export interface SupportChatFlowConfig {
  /**
   * Hide the provider's floating launcher. Off: the launcher is the way in —
   * it stays in the bottom-left corner, and there is no header Help button.
   */
  hideDefaultLauncher: boolean
  /** Idle time before auto-opening the messenger for tenants not yet onboarded (ms). */
  inactivityOpenDelayMs: number
  /** Intercom visibility poll interval (ms). Unused by Pylon. */
  statePollIntervalMs: number
  activityEvents: readonly UserActivityEvent[]
  /** After idle, open the messenger if onboarding is incomplete. */
  autoOpenOnInactivity: boolean
  /** Mark the tenant onboarded (metadata) on close when onboarding was incomplete. */
  markCompletedOnClose: boolean
  trackGtagEvents: boolean
  persistMessengerSeenToStorage: boolean
  gtagOpenedEvent: SupportChatAnalyticsEvent
  gtagClosedEvent: SupportChatAnalyticsEvent
  messengerSeenStorageKey: SupportChatStorageKey
  toastSuccessMarkOnboarded: string
  toastErrorMarkOnboarded: string
}

/** ms × sec × min; idle before auto-open for tenants not yet onboarded. */
const SUPPORT_CHAT_INACTIVITY_TIMEOUT_MS = 1000 * 60 * 15 // 15 minutes

/** Knobs that are identical for every provider. */
const SHARED_FLOW = {
  hideDefaultLauncher: false,
  inactivityOpenDelayMs: SUPPORT_CHAT_INACTIVITY_TIMEOUT_MS,
  statePollIntervalMs: 1000,
  activityEvents: [
    UserActivityEvent.MouseMove,
    UserActivityEvent.KeyDown,
    UserActivityEvent.Scroll,
    UserActivityEvent.TouchStart,
  ],
  autoOpenOnInactivity: true,
  markCompletedOnClose: true,
  trackGtagEvents: true,
  persistMessengerSeenToStorage: true,
  toastSuccessMarkOnboarded: "Welcome! You've been marked as onboarded.",
  toastErrorMarkOnboarded: 'Failed to update onboarding status. Please try again.',
} satisfies Partial<SupportChatFlowConfig>

/** Total by construction: a new provider will not compile until its config is added here. */
export const SUPPORT_CHAT_FLOW: Record<SupportChatProvider, SupportChatFlowConfig> = {
  [SupportChatProvider.Intercom]: {
    ...SHARED_FLOW,
    gtagOpenedEvent: SupportChatAnalyticsEvent.IntercomOpened,
    gtagClosedEvent: SupportChatAnalyticsEvent.IntercomClosed,
    messengerSeenStorageKey: SupportChatStorageKey.IntercomSeen,
  },
  [SupportChatProvider.Pylon]: {
    ...SHARED_FLOW,
    gtagOpenedEvent: SupportChatAnalyticsEvent.PylonOpened,
    gtagClosedEvent: SupportChatAnalyticsEvent.PylonClosed,
    messengerSeenStorageKey: SupportChatStorageKey.PylonSeen,
  },
}

interface ProviderEnv {
  enabled: boolean
  appId: string
}

export interface SupportChatEnv {
  intercom: ProviderEnv
  pylon: ProviderEnv & { identityVerificationEnabled: boolean }
  isProd: boolean
}

function isProviderConfigured(provider: ProviderEnv): boolean {
  return provider.enabled && provider.appId.trim().length > 0
}

/** True when Intercom specifically is configured. */
export function isIntercomProviderConfigured(config: SupportChatEnv = env): boolean {
  return isProviderConfigured(config.intercom)
}

/** True when Pylon specifically is configured, with an app id `init()` will accept. */
export function isPylonProviderConfigured(config: SupportChatEnv = env): boolean {
  return isProviderConfigured(config.pylon) && isValidPylonAppId(config.pylon.appId)
}

/** The active provider. Intercom wins when both are configured, as in V1. */
export function getActiveSupportChatProvider(
  config: SupportChatEnv = env,
): SupportChatProvider | null {
  const intercomReady = isIntercomProviderConfigured(config)
  const pylonReady = isPylonProviderConfigured(config)

  if (intercomReady && pylonReady && !config.isProd) {
    // A config mistake, not a runtime error.
    console.warn(
      '[support-chat] Intercom and Pylon are both enabled. Using Intercom and ignoring Pylon. Set VITE_INTERCOM_ENABLED=false to use Pylon.',
    )
  }

  if (intercomReady) return SupportChatProvider.Intercom
  if (pylonReady) return SupportChatProvider.Pylon
  return null
}

/** True when any provider is active. Gates the command palette's open command. */
export function isSupportChatAvailable(config: SupportChatEnv = env): boolean {
  return getActiveSupportChatProvider(config) !== null
}

const SUPPORT_CHAT_COMMAND_LABEL: Record<SupportChatProvider, string> = {
  [SupportChatProvider.Intercom]: 'Open Intercom',
  [SupportChatProvider.Pylon]: 'Open Pylon',
}

/** Command-palette label for the active provider. */
export function getSupportChatCommandLabel(config: SupportChatEnv = env): string {
  const provider = getActiveSupportChatProvider(config)
  return SUPPORT_CHAT_COMMAND_LABEL[provider ?? SupportChatProvider.Intercom]
}
