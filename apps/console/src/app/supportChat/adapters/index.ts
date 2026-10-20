import { env } from '@/env'
import type { SupportChatFlowConfig } from '../config'
import { SupportChatProvider } from '../models'
import type { SupportChatAdapter } from '../SupportChatAdapter'
import { createIntercomAdapter } from './intercom'
import { createPylonAdapter, type FetchPylonEmailHash } from './pylon'

/**
 * The adapter for the resolved provider. Exhaustive over `SupportChatProvider`.
 * `fetchEmailHash` is used only when Pylon identity verification is on.
 */
export function createSupportChatAdapter(
  provider: SupportChatProvider,
  flow: SupportChatFlowConfig,
  fetchEmailHash: FetchPylonEmailHash,
): SupportChatAdapter {
  switch (provider) {
    case SupportChatProvider.Intercom:
      return createIntercomAdapter(
        env.intercom.appId,
        flow.statePollIntervalMs,
        flow.hideDefaultLauncher,
      )
    case SupportChatProvider.Pylon:
      return createPylonAdapter(
        env.pylon.appId,
        env.pylon.identityVerificationEnabled ? fetchEmailHash : undefined,
        flow.hideDefaultLauncher,
      )
  }
}
