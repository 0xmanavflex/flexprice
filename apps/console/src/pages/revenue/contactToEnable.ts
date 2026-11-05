import { openSupportChat } from '@/app/supportChat/SupportChat'
import { isSupportChatAvailable } from '@/app/supportChat/config'
import { env } from '@/env'

/**
 * How someone asks Flexprice to turn revenue recognition on: the support chat when the
 * deployment has one (as ⌘K's "Open Pylon"), otherwise an email to the configured contact
 * address (`VITE_PLATFORM_CONFIG.contact_us.email`). Undefined when neither exists, as in a
 * white-label deployment that hides every contact option; the page then shows no button.
 */
export function contactToEnableRevenueRecognition(
  options: { chat: boolean; email: string | null } = {
    chat: isSupportChatAvailable(),
    email: env.platform.contact.email,
  },
): (() => void) | undefined {
  if (options.chat) return openSupportChat
  const email = options.email
  if (email) {
    return () => {
      window.location.href = `mailto:${email}?subject=${encodeURIComponent('Enable revenue recognition')}`
    }
  }
  return undefined
}
