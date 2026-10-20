import { useEffect, useMemo, useRef } from 'react'
import { useFetchSupportChatHash } from '@fp/query'
import { Button } from '@fp/ui/primitives'
import { BotIcon } from '@fp/ui/icons'
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
  const { open } = useSupportChat(adapter, flow)

  return (
    <Button size="sm" variant="outline" className="h-8 px-3" onClick={open}>
      <BotIcon aria-hidden />
      Help
    </Button>
  )
}

/**
 * The header's Help button, which opens the support chat. Renders nothing when
 * no provider is enabled or its app id is missing — as V1.
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
