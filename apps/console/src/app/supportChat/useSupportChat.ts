/*
 * Every provider-independent messenger behaviour, ported from V1's
 * `useSupportChat`. The adapter only identifies, opens and reports visibility.
 */
import { useCallback, useEffect, useRef } from 'react'
import { TenantMetadataFlag, TenantMetadataKey, isTenantOnboarded } from '@fp/domain'
import { useCurrentUser, useTenant, useUpdateTenantMetadata } from '@fp/query'
import { toast } from '@fp/ui/pages'
import { useSession } from '@/app/session'
import type { SupportChatFlowConfig } from './config'
import {
  OPEN_SUPPORT_CHAT_EVENT,
  SupportChatStatus,
  SupportChatStorageValue,
  SupportChatVisibility,
} from './models'
import type { SupportChatAdapter } from './SupportChatAdapter'

type GtagFn = (...args: unknown[]) => void

function getGtag(): GtagFn | null {
  if (typeof window === 'undefined') return null
  const candidate = (window as unknown as { gtag?: GtagFn }).gtag
  return typeof candidate === 'function' ? candidate : null
}

function logError(action: string, error: unknown) {
  console.error(`[support-chat] ${action} failed`, error)
}

export function useSupportChat(adapter: SupportChatAdapter, flow: SupportChatFlowConfig) {
  const { session } = useSession()
  const user = useCurrentUser(session?.token ?? null).data

  // Primitives, not the `user` object: a refetch returns a fresh reference and would re-init the SDK.
  const userId = user?.id
  const userEmail = user?.email
  const tenantId = user?.tenantId
  const tenantName = user?.tenantName

  const { data: tenant, isLoading: isTenantLoading } = useTenant(tenantId ?? '')
  const tenantCreatedAt = tenant?.createdAt?.getTime()

  // V2's user carries no display name, so the tenant name stands in: which was
  // also the only name V1 sent before Pylon.
  const displayName = tenantName

  const visibility = useRef<SupportChatVisibility>(SupportChatVisibility.Unknown)
  const status = useRef<SupportChatStatus>(SupportChatStatus.Idle)
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateMetadata = useUpdateTenantMetadata()
  const markTenantOnboarded = useCallback(() => {
    updateMetadata.mutate(
      {
        name: tenant?.name || '',
        metadata: {
          ...tenant?.metadata,
          [TenantMetadataKey.OnboardingCompleted]: TenantMetadataFlag.True,
        },
      },
      {
        onSuccess: () => toast.success(flow.toastSuccessMarkOnboarded),
        onError: (error) => {
          logError('mark-tenant-onboarded', error)
          toast.error(flow.toastErrorMarkOnboarded)
        },
      },
    )
  }, [updateMetadata, tenant, flow.toastSuccessMarkOnboarded, flow.toastErrorMarkOnboarded])

  const isOnboardingCompleted = useCallback(() => isTenantOnboarded(tenant), [tenant])

  const handleShow = useCallback(() => {
    if (visibility.current === SupportChatVisibility.Open) return
    visibility.current = SupportChatVisibility.Open

    if (flow.trackGtagEvents) {
      getGtag()?.('event', flow.gtagOpenedEvent, { user_id: userId, tenant_id: tenantId })
    }
  }, [flow.trackGtagEvents, flow.gtagOpenedEvent, userId, tenantId])

  const handleHide = useCallback(() => {
    // Only counts if we saw it open; also collapses repeated hide events into one close.
    if (visibility.current !== SupportChatVisibility.Open) return
    visibility.current = SupportChatVisibility.Closed

    const onboardingCompleted = isOnboardingCompleted()

    if (flow.markCompletedOnClose && !onboardingCompleted && userId && tenant) {
      markTenantOnboarded()
    }

    if (flow.trackGtagEvents) {
      getGtag()?.('event', flow.gtagClosedEvent, {
        user_id: userId,
        tenant_id: tenantId,
        onboarding_completed: onboardingCompleted,
      })
    }

    if (flow.persistMessengerSeenToStorage && typeof window !== 'undefined') {
      try {
        localStorage.setItem(flow.messengerSeenStorageKey, SupportChatStorageValue.Seen)
      } catch {
        /* private-mode browser: nothing to remember it in */
      }
    }
  }, [
    flow.markCompletedOnClose,
    flow.trackGtagEvents,
    flow.gtagClosedEvent,
    flow.persistMessengerSeenToStorage,
    flow.messengerSeenStorageKey,
    isOnboardingCompleted,
    markTenantOnboarded,
    tenant,
    userId,
    tenantId,
  ])

  // Stable indirection so the init effect does not re-run when the handlers' identity changes.
  const handleShowRef = useRef(handleShow)
  const handleHideRef = useRef(handleHide)
  useEffect(() => {
    handleShowRef.current = handleShow
    handleHideRef.current = handleHide
  }, [handleShow, handleHide])

  const open = useCallback(() => {
    if (status.current !== SupportChatStatus.Ready) return
    adapter.show()
  }, [adapter])

  // Boot the provider and wire visibility events. Rebinds on identity change without
  // disposing the adapter: dispose() is terminal (see the effect below) and must fire once.
  useEffect(() => {
    if (!userId) return

    let cancelled = false
    status.current = SupportChatStatus.Initializing

    const unsubscribe = adapter.subscribe({
      onShow: () => handleShowRef.current(),
      onHide: () => handleHideRef.current(),
    })

    adapter
      .init({
        id: userId,
        email: userEmail,
        name: displayName,
        createdAt: tenantCreatedAt,
        tenantId,
      })
      .then(() => {
        if (!cancelled) status.current = SupportChatStatus.Ready
      })
      .catch((error: unknown) => {
        if (cancelled) return
        status.current = SupportChatStatus.Failed
        logError('init', error)
      })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [adapter, userId, userEmail, displayName, tenantCreatedAt, tenantId])

  // Tied only to the adapter instance, so this fires once: on unmount, or if the
  // memoised adapter is ever replaced: never on an identity-only re-run above.
  useEffect(() => {
    return () => {
      adapter.dispose()
    }
  }, [adapter])

  // Open from the command palette (⌘K → Open <provider>).
  useEffect(() => {
    const handler = () => open()
    window.addEventListener(OPEN_SUPPORT_CHAT_EVENT, handler)
    return () => window.removeEventListener(OPEN_SUPPORT_CHAT_EVENT, handler)
  }, [open])

  const resetInactivityTimer = useCallback(() => {
    if (!flow.autoOpenOnInactivity) return

    if (inactivityTimer.current) clearTimeout(inactivityTimer.current)

    if (!isOnboardingCompleted()) {
      inactivityTimer.current = setTimeout(() => {
        open()
      }, flow.inactivityOpenDelayMs)
    }
  }, [flow.autoOpenOnInactivity, flow.inactivityOpenDelayMs, isOnboardingCompleted, open])

  // Auto-open for tenants who have not completed onboarding.
  useEffect(() => {
    if (!flow.autoOpenOnInactivity) return

    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current)
      inactivityTimer.current = null
    }

    if (!userId || isTenantLoading || isOnboardingCompleted()) return

    const activityEvents = flow.activityEvents
    activityEvents.forEach((event) => {
      window.addEventListener(event, resetInactivityTimer, { passive: true })
    })

    resetInactivityTimer()

    return () => {
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current)
        inactivityTimer.current = null
      }
      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetInactivityTimer)
      })
    }
  }, [
    flow.autoOpenOnInactivity,
    flow.activityEvents,
    userId,
    isTenantLoading,
    isOnboardingCompleted,
    resetInactivityTimer,
  ])

  return { open }
}
