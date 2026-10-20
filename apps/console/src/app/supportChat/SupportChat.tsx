import { useEffect, useMemo, useRef } from 'react'
import { useFetchSupportChatHash } from '@fp/query'
import { useSession } from '@/app/session'
import { createSupportChatAdapter } from './adapters'
import { SUPPORT_CHAT_FLOW, getActiveSupportChatProvider } from './config'
import { OPEN_SUPPORT_CHAT_EVENT, type SupportChatProvider } from './models'
import { useSupportChat } from './useSupportChat'

/** Mounted only when a provider is configured. */
function SupportChatImpl({ provider }: { provider: SupportChatProvider }) {
  const { environmentId } = useSession()
  const fetchEmailHash = useFetchSupportChatHash(environmentId)
  // The adapter is built once per provider, so it reads the fetcher through a
  // ref: the environment it signs against can change after it is built.
  const fetchRef = useRef(fetchEmailHash)
  useEffect(() => {
    fetchRef.current = fetchEmailHash
  }, [fetchEmailHash])
  const flow = SUPPORT_CHAT_FLOW[provider]
  const adapter = useMemo(
    () => createSupportChatAdapter(provider, flow, () => fetchRef.current()),
    [provider, flow],
  )
  useSupportChat(adapter, flow)

  // Nothing of our own to draw: the provider's launcher, bottom-left, opens it.
  return null
}

/**
 * Boots the support chat. The provider's own launcher stays in the bottom-left
 * corner and opens it; ⌘K and the idle auto-open still work. Nothing is
 * mounted when no provider is enabled or its app id is missing — as V1.
 */
export function SupportChat() {
  const provider = getActiveSupportChatProvider()
  if (!provider) return null
  return <SupportChatImpl provider={provider} />
}

/** Opens the support chat from anywhere, e.g. the command palette. */
export function openSupportChat() {
  window.dispatchEvent(new Event(OPEN_SUPPORT_CHAT_EVENT))
}
