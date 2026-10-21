import { createContext, type ReactNode, useContext, useMemo } from 'react'
import {
  type AccessRequirement,
  type RbacAction,
  type RbacEntity,
  accessDeniedReason,
} from '@fp/domain'
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/components/primitives/tooltip'
import { Alert, AlertDescription } from '@ui/components/reui/alert'
import { LockIcon } from '@ui/icons'
import { ErrorState } from '@ui/compositions/feedback/States'
import { PageLoadingState } from '@ui/compositions/feedback/Skeletons'
import { provenance } from '@ui/provenance'

/**
 * Access control in the UI, in one place, as V1 does it:
 *
 * - **`AccessProvider`** — the app hands in what the signed-in principal may
 *   do (`@fp/query` `useAccessControl`). Without a provider, everything is
 *   allowed, so stories and tests render the full UI.
 * - **`RequireAccess`** — a page's gate: a loader while roles load (never a
 *   false "Access denied"), then the page or the denied screen.
 * - **`AccessScope`** — which entity a page (or a tab of it) writes. The
 *   kit's write controls — a list's create button and row actions, a detail
 *   page's menu, an editable card's Edit — read it and disable themselves.
 * - **`WriteGate`** — wraps any other control: disabled, with the reason in a
 *   tooltip, when write is not allowed. Controls stay visible, as in V1.
 *
 * The API stays the authority: this decides what is offered, never what is
 * allowed.
 */
export const AccessProvenance = provenance({
  source: 'composition',
  composes: [
    'ui/tooltip',
    '@reui/alert',
    'compositions/feedback/States',
    'compositions/feedback/Skeletons',
  ],
  note: 'RBAC in the UI: provider, page gate, write scope and write gate (disabled + tooltip), as V1.',
})

export type AccessStatus = 'loading' | 'ready' | 'error' | 'unrestricted'

export interface AccessValue {
  status: AccessStatus
  isSuperAdmin: boolean
  can: (entity: RbacEntity, action: RbacAction) => boolean
  meets: (requirement: AccessRequirement) => boolean
}

const ALLOW_ALL: AccessValue = {
  status: 'unrestricted',
  isSuperAdmin: true,
  can: () => true,
  meets: () => true,
}

const AccessContext = createContext<AccessValue>(ALLOW_ALL)

export function AccessProvider({ value, children }: { value: AccessValue; children: ReactNode }) {
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
}

export function useAccess(): AccessValue {
  return useContext(AccessContext)
}

/** `can(entity, action)` for the signed-in principal. */
export function useCan(entity: RbacEntity, action: RbacAction): boolean {
  return useAccess().can(entity, action)
}

/* ---- Write scope ---------------------------------------------------------- */

interface ScopeValue {
  entity: RbacEntity
  superAdmin: boolean
}

const ScopeContext = createContext<ScopeValue | null>(null)

/**
 * The entity the controls inside write to. Nest one for a tab or section
 * that writes something else (a customer's invoices, a plan's prices).
 */
export function AccessScope({
  entity,
  superAdmin = false,
  children,
}: {
  entity: RbacEntity
  /** Also require super admin, as V1 does for tenant-wide settings. */
  superAdmin?: boolean
  children: ReactNode
}) {
  const value = useMemo(() => ({ entity, superAdmin }), [entity, superAdmin])
  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>
}

export interface WriteAccess {
  allowed: boolean
  /** Why not, for a tooltip; null when allowed. */
  reason: string | null
}

/**
 * A checker for several controls at once (a menu's items): each may name its
 * own entity, else it writes to the surrounding `AccessScope`'s. Outside any
 * scope, an item with no entity is not gated.
 */
export function useWriteCheck(): (
  entity?: RbacEntity,
  options?: { superAdmin?: boolean },
) => WriteAccess {
  const access = useAccess()
  const scope = useContext(ScopeContext)
  return (entity, options = {}) => {
    const target = entity ?? scope?.entity
    if (!target) return { allowed: true, reason: null }
    const superAdmin = options.superAdmin ?? (entity ? false : (scope?.superAdmin ?? false))
    if (access.status === 'loading') return { allowed: false, reason: 'Checking your access…' }
    const allowed = access.meets({ entity: target, action: 'write', superAdmin })
    return { allowed, reason: allowed ? null : accessDeniedReason({ superAdmin }) }
  }
}

/**
 * Whether the controls here may write: to `entity` when given, else to the
 * surrounding `AccessScope`'s. Outside any scope, writing is not gated.
 */
export function useWriteAccess(
  entity?: RbacEntity,
  options: { superAdmin?: boolean } = {},
): WriteAccess {
  return useWriteCheck()(entity, options)
}

/**
 * A control that writes: shown as is when allowed, otherwise disabled with
 * the reason in a tooltip. A `<fieldset disabled>` disables every button and
 * input inside without each needing a prop.
 */
export function WriteGate({
  entity,
  superAdmin,
  block = false,
  children,
}: {
  entity?: RbacEntity
  superAdmin?: boolean
  /**
   * A whole form or panel rather than one control: a note above it says why,
   * and every input and button inside is disabled (V1's settings panels).
   */
  block?: boolean
  children: ReactNode
}) {
  const write = useWriteAccess(entity, superAdmin === undefined ? {} : { superAdmin })
  if (write.allowed) return <>{children}</>
  if (block) {
    return (
      <div className="flex flex-col gap-4" data-access="denied">
        <Alert>
          <LockIcon aria-hidden />
          <AlertDescription>{write.reason}</AlertDescription>
        </Alert>
        <fieldset disabled className="contents">
          {children}
        </fieldset>
      </div>
    )
  }
  return (
    <Tooltip>
      <TooltipTrigger render={<span tabIndex={0} className="inline-flex" data-access="denied" />}>
        <fieldset disabled className="contents" aria-disabled>
          {children}
        </fieldset>
      </TooltipTrigger>
      <TooltipContent>{write.reason}</TooltipContent>
    </Tooltip>
  )
}

/* ---- Page gate ------------------------------------------------------------ */

/**
 * A page that needs `requirement`: the loader while access loads, the page
 * when it is met, and V1's "Access denied" in place when not.
 */
export function RequireAccess({
  requirement,
  children,
}: {
  requirement: AccessRequirement | null | undefined
  children: ReactNode
}) {
  const access = useAccess()
  if (!requirement) return <>{children}</>
  if (access.status === 'loading') return <PageLoadingState label="Checking your access" />
  if (!access.meets(requirement)) {
    return (
      <ErrorState
        variant="page"
        kind="denied"
        title="Access denied"
        description="You don't have permission to view this page. Ask an admin for access."
      />
    )
  }
  return <>{children}</>
}
