import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import {
  AccountState,
  type AccessRequirement,
  LOCKED_REASON,
  type SelfBillingSummary,
} from '@fp/domain'
import {
  type AccessControl,
  isAccountLockedError,
  selfBillingToday,
  useSelfBillingStatus,
  useSelfBillingSummary,
} from '@fp/query'
import { AccountLockedDialog, AccountStatusPill } from '@fp/ui/pages'

/**
 * The tenant's own Flexprice account, for the whole shell.
 *
 * The status is read once per session. While the account is in its trial or
 * locked, the summary is read too: it is what the pill and its card say. A
 * locked account reads everything and writes nothing — every write control is
 * disabled through the access check, a create page shows "Creating is
 * paused", and a write the API still refuses opens the locked dialog.
 */

export const USAGE_BILLING_PATH = '/settings/usage-billing'
export const UPGRADE_PATH = '/settings/usage-billing/go-live'

interface AccountLockValue {
  locked: boolean
  /** The summary the pill and the locked screens read; null until loaded or when not needed. */
  summary: SelfBillingSummary | null
  today: string
  viewDetails: () => void
  upgrade: () => void
}

const AccountLockContext = createContext<AccountLockValue>({
  locked: false,
  summary: null,
  today: selfBillingToday(),
  viewDetails: () => {},
  upgrade: () => {},
})

export function useAccountLock(): AccountLockValue {
  return useContext(AccountLockContext)
}

/** `access`, with every write refused while the account is locked. */
export function useLockedAccess(
  access: AccessControl,
  locked: boolean,
): AccessControl & {
  writeLock: string | null
} {
  return useMemo(() => {
    if (!locked) return { ...access, writeLock: null }
    const writes = (action: AccessRequirement['action']) =>
      Array.isArray(action) ? action.every((a) => a === 'write') : action === 'write'
    return {
      ...access,
      writeLock: LOCKED_REASON,
      can: (entity, action) => (action === 'write' ? false : access.can(entity, action)),
      meets: (requirement) => (writes(requirement.action) ? false : access.meets(requirement)),
    }
  }, [access, locked])
}

export function AccountLockProvider({
  enabled,
  children,
}: {
  /** Read nothing until there is a session and an environment. */
  enabled: boolean
  children: ReactNode
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const status = useSelfBillingStatus({ enabled })
  const state = status.data?.enabled ? status.data.state : null
  const watched = state === AccountState.Trialing || state === AccountState.Suspended
  const summary = useSelfBillingSummary({ enabled: enabled && watched })
  const [refused, setRefused] = useState(false)
  const today = selfBillingToday()

  // A write the API refused because the account is locked: say so once, and
  // read the status again in case it changed since this session read it.
  useEffect(
    () =>
      queryClient.getMutationCache().subscribe((event) => {
        if (event.type !== 'updated' || event.mutation.state.status !== 'error') return
        if (!isAccountLockedError(event.mutation.state.error)) return
        setRefused(true)
        void status.refetch()
      }),
    // `status.refetch` is stable for the query's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient],
  )
  // Leaving the page (View details, Upgrade) closes the dialog.
  useEffect(() => setRefused(false), [pathname])

  const value = useMemo<AccountLockValue>(
    () => ({
      locked: state === AccountState.Suspended,
      summary: watched ? (summary.data ?? null) : null,
      today,
      viewDetails: () => void navigate({ to: USAGE_BILLING_PATH }),
      upgrade: () => void navigate({ to: UPGRADE_PATH }),
    }),
    [state, watched, summary.data, today, navigate],
  )

  return (
    <AccountLockContext.Provider value={value}>
      {children}
      {value.summary ? (
        <AccountLockedDialog
          open={refused}
          onOpenChange={setRefused}
          summary={value.summary}
          today={today}
          onViewDetails={value.viewDetails}
          onUpgrade={value.upgrade}
        />
      ) : null}
    </AccountLockContext.Provider>
  )
}

/** The top-bar pill: in the trial and while locked, on every page. */
export function AccountPill() {
  const { summary, today, viewDetails, upgrade } = useAccountLock()
  if (!summary) return null
  return (
    <AccountStatusPill
      summary={summary}
      today={today}
      onViewDetails={viewDetails}
      onUpgrade={upgrade}
    />
  )
}
