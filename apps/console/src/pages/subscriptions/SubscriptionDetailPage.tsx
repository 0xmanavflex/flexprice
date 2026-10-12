import { useMemo, useState } from 'react'
import { SubscriptionStatus, type SubscriptionCancellationType } from '@fp/domain'
import {
  ApiError,
  useActivateSubscription,
  useCancelSubscription,
  useCreateSubscriptionLineItem,
  useDeleteSubscriptionLineItem,
  useExecuteLineChange,
  usePreviewLineChange,
  useSubscription,
  useSubscriptionCreditGrants,
  useSubscriptionEntitlements,
  useSubscriptionInvoices,
  useSubscriptionLines,
  useSubscriptionSchedules,
  useSubscriptionUsage,
  useUpdateSubscriptionLineItem,
} from '@fp/query'
import { SubscriptionDetailView, type SubscriptionPart } from '@fp/ui/pages'
import { ConfirmDialog, DateInput, OptionSelect } from '@fp/ui/compositions'
import { Input } from '@fp/ui/primitives'
import { usePlanFormOptions } from '../plans/planFormOptions'
import { subscriptionLifecycle } from './subscriptionLifecycle'
import { detailGate } from '../shared/detailGate'

export interface SubscriptionDetailPageProps {
  subscriptionId: string
  onNavigateToList: () => void
  onOpenCustomer: (customerId: string) => void
  onOpenPlan: (planId: string) => void
  onOpenInvoice: (invoiceId: string) => void
}

const CANCEL_OPTIONS = [
  { value: 'end_of_period', label: 'At the end of the current period' },
  { value: 'immediate', label: 'Immediately' },
]

const today = () => new Date().toISOString().slice(0, 10)

/** Adapts a query result to the view's per-section loading, error and retry shape. */
function part<T>(query: {
  data: T | undefined
  isPending: boolean
  error: unknown
  refetch: () => unknown
}): SubscriptionPart<T> {
  return {
    data: query.data,
    isLoading: query.isPending,
    isError: Boolean(query.error),
    onRetry: () => void query.refetch(),
  }
}

/**
 * One contract, read-only, with the two things the API lets you do to it:
 * cancel it (now or at the end of the period) or, if it never started,
 * activate it. Each section loads on its own, so the header renders as soon as
 * the contract itself arrives.
 */
export function SubscriptionDetailPage({
  subscriptionId,
  onNavigateToList,
  onOpenCustomer,
  onOpenPlan,
  onOpenInvoice,
}: SubscriptionDetailPageProps) {
  const subscription = useSubscription(subscriptionId)
  const lines = useSubscriptionLines(subscriptionId)
  const entitlements = useSubscriptionEntitlements(subscriptionId)
  const creditGrants = useSubscriptionCreditGrants(subscriptionId)
  const usage = useSubscriptionUsage(subscriptionId)
  const invoices = useSubscriptionInvoices(subscriptionId)
  const schedules = useSubscriptionSchedules(subscriptionId)
  const cancel = useCancelSubscription()
  const activate = useActivateSubscription()
  const addLine = useCreateSubscriptionLineItem()
  const editLine = useUpdateSubscriptionLineItem()
  const endLine = useDeleteSubscriptionLineItem()
  const previewChange = usePreviewLineChange()
  const executeChange = useExecuteLineChange()
  const formOptions = usePlanFormOptions()

  const [dialog, setDialog] = useState<'cancel' | 'activate' | null>(null)
  const [cancellationType, setCancellationType] =
    useState<SubscriptionCancellationType>('end_of_period')
  const [reason, setReason] = useState('')
  const [startDate, setStartDate] = useState(today())

  const activity = useMemo(
    () => (subscription.data ? subscriptionLifecycle(subscription.data) : []),
    [subscription.data],
  )

  if (!subscription.data) {
    return detailGate(subscription, {
      noun: 'this contract',
      listName: 'contracts',
      onBack: onNavigateToList,
    })
  }

  const data = subscription.data
  const close = () => setDialog(null)

  return (
    <>
      <SubscriptionDetailView
        subscription={data}
        lines={part(lines)}
        entitlements={part(entitlements)}
        creditGrants={part(creditGrants)}
        usage={part(usage)}
        invoices={part(invoices)}
        schedules={part(schedules)}
        activity={activity}
        onBack={onNavigateToList}
        onOpenCustomer={() => onOpenCustomer(data.customerId)}
        onOpenPlan={() => onOpenPlan(data.planId)}
        onOpenInvoice={onOpenInvoice}
        {...(data.status === SubscriptionStatus.Incomplete
          ? { onActivate: () => setDialog('activate') }
          : {})}
        onCancel={() => setDialog('cancel')}
        meters={formOptions.meters}
        priceUnits={formOptions.units.filter((unit) => unit.baseCurrency === data.currency)}
        onAddCharge={async (draft) => {
          await addLine.mutateAsync({ id: data.id, draft })
        }}
        onEditCharge={async (line, draft) => {
          await editLine.mutateAsync({ lineItemId: line.id, draft })
        }}
        onEndCharge={async (line, draft) => {
          await endLine.mutateAsync({ lineItemId: line.id, draft })
        }}
        onPreviewQuantity={(line, draft) =>
          previewChange.mutateAsync({ subscriptionId: data.id, line, draft })
        }
        onChangeQuantity={async (line, draft) => {
          await executeChange.mutateAsync({ subscriptionId: data.id, line, draft })
        }}
      />
      <ConfirmDialog
        open={dialog === 'cancel'}
        onOpenChange={(open) => (open ? undefined : close())}
        title="Cancel this contract?"
        description={
          <span className="flex flex-col gap-3 pt-2 text-left">
            <label htmlFor="cancel-when" className="flex flex-col gap-1.5 text-sm">
              When
              <OptionSelect
                id="cancel-when"
                value={cancellationType}
                onValueChange={(value) =>
                  setCancellationType(value as SubscriptionCancellationType)
                }
                options={CANCEL_OPTIONS}
              />
            </label>
            <label htmlFor="cancel-reason" className="flex flex-col gap-1.5 text-sm">
              Reason (optional)
              <Input
                id="cancel-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          </span>
        }
        confirmLabel="Cancel contract"
        cancelLabel="Keep contract"
        destructive
        isPending={cancel.isPending}
        error={toError(cancel.error, 'cancel')}
        onConfirm={() =>
          cancel.mutate({ id: data.id, draft: { cancellationType, reason } }, { onSuccess: close })
        }
      />
      <ConfirmDialog
        open={dialog === 'activate'}
        onOpenChange={(open) => (open ? undefined : close())}
        title="Activate this contract?"
        description={
          <span className="flex flex-col gap-3 pt-2 text-left">
            <label htmlFor="activate-start" className="flex flex-col gap-1.5 text-sm">
              Start date
              <DateInput id="activate-start" value={startDate} onValueChange={setStartDate} />
            </label>
          </span>
        }
        confirmLabel="Activate"
        isPending={activate.isPending}
        error={toError(activate.error, 'activate')}
        onConfirm={() =>
          activate.mutate(
            { id: data.id, startDate: new Date(`${startDate || today()}T00:00:00Z`) },
            { onSuccess: close },
          )
        }
      />
    </>
  )
}

function toError(error: unknown, verb: 'cancel' | 'activate'): string | null {
  if (!error) return null
  if (error instanceof ApiError && error.kind === 'forbidden')
    return `You do not have permission to ${verb} contracts here.`
  if (error instanceof ApiError && error.kind === 'invalid')
    return error.message || 'Check the details and try again.'
  return `Could not ${verb} the contract. Try again.`
}
