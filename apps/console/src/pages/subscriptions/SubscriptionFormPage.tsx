import { useMemo, useState } from 'react'
import {
  ApiError,
  useCreateSubscription,
  useCustomers,
  usePlanEntitlements,
  usePlans,
  usePrices,
} from '@fp/query'
import { DEFAULT_CUSTOMER_QUERY, DEFAULT_PLAN_QUERY, PriceEntityType } from '@fp/domain'
import { SubscriptionForm } from '@fp/ui/pages'

export interface SubscriptionFormPageProps {
  /** Set when opened from a customer's own page: the Customer step is dropped. */
  customerId?: string
  embedded?: boolean
  step?: string
  onStepChange: (id: string) => void
  onCancel: () => void
  onDone: (subscriptionId: string) => void
}

const PICKER_PAGE = { page: 1, pageSize: 100 }

/**
 * Create a subscription on its own page, or embedded in a customer's page.
 *
 * Loads the customers and plans to choose from, then the chosen plan's charges
 * and entitlements so the Prices and Entitlements steps can override them.
 */
export function SubscriptionFormPage({
  customerId,
  embedded = false,
  step,
  onStepChange,
  onCancel,
  onDone,
}: SubscriptionFormPageProps) {
  const create = useCreateSubscription()
  const [planId, setPlanId] = useState('')

  const customers = useCustomers({ ...DEFAULT_CUSTOMER_QUERY, ...PICKER_PAGE })
  const plans = usePlans({ ...DEFAULT_PLAN_QUERY, ...PICKER_PAGE })
  const charges = usePrices(PriceEntityType.Plan, planId)
  const entitlements = usePlanEntitlements(planId ? [planId] : [])

  const customerOptions = useMemo(
    () =>
      (customers.data?.customers ?? []).map((c) => ({
        value: c.id,
        label: c.email ? `${c.name} · ${c.email}` : c.name,
      })),
    [customers.data],
  )
  const planOptions = useMemo(
    () => (plans.data?.plans ?? []).map((p) => ({ value: p.id, label: p.name })),
    [plans.data],
  )

  return (
    <SubscriptionForm
      customers={customerOptions}
      plans={planOptions}
      embedded={embedded}
      customerLocked={customerId !== undefined}
      {...(customerId ? { defaultValue: { customerId } } : {})}
      plan={
        planId
          ? {
              charges: charges.data ?? [],
              entitlements: entitlements.data ?? [],
              isLoading: charges.isPending || entitlements.isPending,
            }
          : undefined
      }
      onPlanChange={setPlanId}
      trail={[{ label: 'Subscriptions', onClick: onCancel }, { label: 'New subscription' }]}
      {...(step ? { step } : {})}
      onStepChange={onStepChange}
      onCancel={onCancel}
      isSubmitting={create.isPending}
      submitError={toSubmitError(create.error)}
      onSubmit={(draft) =>
        create.mutate(draft, {
          onSuccess: (created) => onDone((created as { id?: string }).id ?? ''),
        })
      }
    />
  )
}

function toSubmitError(error: unknown): string | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'invalid':
        return error.message || 'Check the details and try again.'
      case 'forbidden':
        return 'You do not have permission to create subscriptions here.'
      case 'network':
        return 'Could not reach Flexprice. Check your connection and try again.'
      default:
        return 'Could not create the subscription. Try again.'
    }
  }
  return 'Could not create the subscription. Try again.'
}
