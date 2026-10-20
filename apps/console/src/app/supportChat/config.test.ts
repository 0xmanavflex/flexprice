import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SUPPORT_CHAT_FLOW,
  getActiveSupportChatProvider,
  getSupportChatCommandLabel,
  isPylonProviderConfigured,
  isSupportChatAvailable,
  type SupportChatEnv,
} from './config'
import { SupportChatProvider } from './models'

const OFF: SupportChatEnv = {
  intercom: { enabled: false, appId: '' },
  pylon: { enabled: false, appId: '', identityVerificationEnabled: false },
  isProd: false,
}

const withIntercom = (env: SupportChatEnv): SupportChatEnv => ({
  ...env,
  intercom: { enabled: true, appId: 'ic_app' },
})
const withPylon = (env: SupportChatEnv, appId = 'pylon-app_1'): SupportChatEnv => ({
  ...env,
  pylon: { ...env.pylon, enabled: true, appId },
})

describe('support chat provider resolution (as V1)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('has no provider, and no command, when neither is enabled', () => {
    expect(getActiveSupportChatProvider(OFF)).toBeNull()
    expect(isSupportChatAvailable(OFF)).toBe(false)
  })

  it('picks Pylon when only Pylon is configured', () => {
    expect(getActiveSupportChatProvider(withPylon(OFF))).toBe(SupportChatProvider.Pylon)
    expect(getSupportChatCommandLabel(withPylon(OFF))).toBe('Open Pylon')
  })

  it('lets Intercom win when both are configured, warning outside production', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(getActiveSupportChatProvider(withPylon(withIntercom(OFF)))).toBe(
      SupportChatProvider.Intercom,
    )
    expect(warn).toHaveBeenCalledOnce()
    expect(getSupportChatCommandLabel(withIntercom(OFF))).toBe('Open Intercom')
  })

  it('stays quiet about both being enabled in a production build', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    getActiveSupportChatProvider({ ...withPylon(withIntercom(OFF)), isProd: true })
    expect(warn).not.toHaveBeenCalled()
  })

  it('needs an app id, and a Pylon id it can safely put in a script URL', () => {
    expect(
      getActiveSupportChatProvider({ ...OFF, pylon: { ...OFF.pylon, enabled: true, appId: '  ' } }),
    ).toBeNull()
    expect(isPylonProviderConfigured(withPylon(OFF, 'app/../evil'))).toBe(false)
  })

  it("keeps V1's behaviour knobs, event names and storage keys", () => {
    const pylon = SUPPORT_CHAT_FLOW[SupportChatProvider.Pylon]
    expect(pylon).toMatchObject({
      hideDefaultLauncher: true,
      inactivityOpenDelayMs: 15 * 60 * 1000,
      autoOpenOnInactivity: true,
      markCompletedOnClose: true,
      trackGtagEvents: true,
      persistMessengerSeenToStorage: true,
      gtagOpenedEvent: 'pylon_messenger_opened',
      gtagClosedEvent: 'pylon_messenger_closed',
      messengerSeenStorageKey: 'pylon_messenger_seen',
    })
    expect(SUPPORT_CHAT_FLOW[SupportChatProvider.Intercom].messengerSeenStorageKey).toBe(
      'intercom_messenger_seen',
    )
  })
})
