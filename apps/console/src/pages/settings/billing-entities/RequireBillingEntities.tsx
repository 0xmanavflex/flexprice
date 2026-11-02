import type { ReactNode } from 'react'
import { Navigate } from '@tanstack/react-router'
import { BillingEntityMode } from '@fp/domain'
import { useBillingEntityStatus } from '@fp/query'
import { PageBody, PageLoadingState } from '@fp/ui/compositions'

/**
 * Entity pages exist only once the environment's mode is `enabled`; a stale
 * link lands back on the Billing entities section instead.
 */
export function RequireBillingEntities({ children }: { children: ReactNode }) {
  const status = useBillingEntityStatus()
  if (status.isPending) {
    return (
      <PageBody>
        <PageLoadingState variant="detail" label="Loading billing entities" />
      </PageBody>
    )
  }
  if (status.data !== BillingEntityMode.Enabled) {
    return (
      <Navigate to="/settings" search={{ section: 'billing-entities', tab: 'entities' }} replace />
    )
  }
  return <>{children}</>
}
