import { useState } from 'react'
import { RefreshCwIcon } from 'lucide-react'
import {
  SUBSCRIPTION_STATUS_LABEL,
  type SubscriptionEntitlement,
  type SubscriptionLine,
  formatMoney,
  type SubscriptionCancellationType,
  SubscriptionStatus,
} from '@fp/domain'
import {
  ApiError,
  useActivateSubscription,
  useCancelSubscription,
  useSubscription,
  useSubscriptionEntitlements,
  useSubscriptionLines,
} from '@fp/query'
import { CatalogDetailFrame, EntityLink, Pill, SubscriptionStatusBadge } from '@fp/ui/pages'
import {
  AppFailure,
  ConfirmDialog,
  DateInput,
  EditableCard,
  LoadingRows,
  OptionSelect,
  PageBody,
  SimpleTable,
} from '@fp/ui/compositions'
import { Input } from '@fp/ui/primitives'

export interface SubscriptionDetailPageProps {
  subscriptionId: string
  onNavigateToList: () => void
  onOpenCustomer: (customerId: string) => void
  onOpenPlan: (planId: string) => void
}

const CANCEL_OPTIONS = [
  { value: 'end_of_period', label: 'At the end of the current period' },
  { value: 'immediate', label: 'Immediately' },
]

const formatDate = (value: Date | null) =>
  value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(value) : '—'

const today = () => new Date().toISOString().slice(0, 10)

/**
 * One subscription, with the two things the API lets you do to it: cancel it
 * (now or at the end of the period) or, if it never started, activate it.
 *
 * The update endpoint only moves `cancel_at`, `status` and the parent, so there
 * is no edit form — the fields shown are the record, and the lifecycle actions
 * are the edit.
 */
export function SubscriptionDetailPage({
  subscriptionId,
  onNavigateToList,
  onOpenCustomer,
  onOpenPlan,
}: SubscriptionDetailPageProps) {
  const subscription = useSubscription(subscriptionId)
  const cancel = useCancelSubscription()
  const activate = useActivateSubscription()

  const [dialog, setDialog] = useState<'cancel' | 'activate' | null>(null)
  const [cancellationType, setCancellationType] =
    useState<SubscriptionCancellationType>('end_of_period')
  const [reason, setReason] = useState('')
  const [startDate, setStartDate] = useState(today())

  if (subscription.isPending) {
    return (
      <PageBody>
        <div className="pt-4">
          <LoadingRows />
        </div>
      </PageBody>
    )
  }

  if (subscription.error || !subscription.data) {
    return (
      <PageBody>
        <AppFailure
          title={subscription.error ? 'This contract could not be loaded' : 'Contract not found'}
          detail="The rest of the console still works. Try again, or go back to the list."
          onRetry={subscription.error ? () => void subscription.refetch() : onNavigateToList}
        />
      </PageBody>
    )
  }

  const data = subscription.data
  const canCancel =
    data.status !== SubscriptionStatus.Cancelled && !data.cancelAtPeriodEnd && !data.cancelledAt
  const canActivate = data.status === SubscriptionStatus.Incomplete
  const close = () => setDialog(null)

  return (
    <CatalogDetailFrame
      listLabel="Contracts"
      onBack={onNavigateToList}
      icon={<RefreshCwIcon />}
      title={`${data.customerName} on ${data.planName}`}
      badges={
        <>
          <Pill>{data.billingPeriodLabel}</Pill>
          <Pill>{data.currency || 'No currency'}</Pill>
        </>
      }
      id={data.id}
      {...(canActivate
        ? { primary: { label: 'Activate', onClick: () => setDialog('activate') } }
        : {})}
      menuLabel="Contract actions"
      menu={[
        {
          id: 'cancel',
          label: 'Cancel contract',
          destructive: true,
          disabled: !canCancel,
          onSelect: () => setDialog('cancel'),
        },
      ]}
      tabs={[
        {
          value: 'overview',
          label: 'Overview',
          content: (
            <EditableCard
              title="Contract"
              locked
              fields={[
                {
                  key: 'status',
                  label: 'Status',
                  value: SUBSCRIPTION_STATUS_LABEL[data.status],
                  display: (
                    <span className="flex items-center gap-2">
                      <SubscriptionStatusBadge status={data.status} />
                      {data.cancelAtPeriodEnd ? (
                        <span className="text-muted-foreground text-xs">Cancels at period end</span>
                      ) : null}
                    </span>
                  ),
                  readOnly: true,
                },
                {
                  key: 'customer',
                  label: 'Customer',
                  value: data.customerName,
                  display: (
                    <EntityLink
                      label={data.customerName}
                      onOpen={() => onOpenCustomer(data.customerId)}
                    />
                  ),
                  readOnly: true,
                },
                {
                  key: 'plan',
                  label: 'Plan',
                  value: data.planName,
                  display: (
                    <EntityLink label={data.planName} onOpen={() => onOpenPlan(data.planId)} />
                  ),
                  readOnly: true,
                },
                {
                  key: 'billing',
                  label: 'Billing',
                  value: `Every ${data.billingPeriodCount} × ${data.billingPeriodLabel}`,
                  readOnly: true,
                },
                {
                  key: 'started',
                  label: 'Started',
                  value: formatDate(data.startDate),
                  readOnly: true,
                },
                {
                  key: 'period',
                  label: 'Current period',
                  value: `${formatDate(data.currentPeriodStart)} – ${formatDate(data.currentPeriodEnd)}`,
                  readOnly: true,
                },
                ...(data.trialEnd
                  ? [
                      {
                        key: 'trial',
                        label: 'Trial ends',
                        value: formatDate(data.trialEnd),
                        readOnly: true,
                      },
                    ]
                  : []),
                ...(data.cancelAt
                  ? [
                      {
                        key: 'cancelAt',
                        label: 'Cancels on',
                        value: formatDate(data.cancelAt),
                        readOnly: true,
                      },
                    ]
                  : []),
                ...(data.cancelledAt
                  ? [
                      {
                        key: 'cancelled',
                        label: 'Cancelled',
                        value: formatDate(data.cancelledAt),
                        readOnly: true,
                      },
                    ]
                  : []),
                ...(data.collectionMethod
                  ? [
                      {
                        key: 'collection',
                        label: 'Collection',
                        value: data.collectionMethod.replaceAll('_', ' '),
                        readOnly: true,
                      },
                    ]
                  : []),
                ...(data.paymentTerms
                  ? [
                      {
                        key: 'terms',
                        label: 'Payment terms',
                        value: data.paymentTerms.replaceAll('_', ' '),
                        readOnly: true,
                      },
                    ]
                  : []),
                ...Object.entries(data.metadata).map(([key, value]) => ({
                  key: `meta_${key}`,
                  label: key,
                  value,
                  readOnly: true,
                })),
                {
                  key: 'id',
                  label: 'Contract ID',
                  value: data.id,
                  display: <span className="font-mono text-xs">{data.id}</span>,
                  readOnly: true,
                },
              ]}
              onSave={async () => undefined}
            />
          ),
        },
        {
          value: 'pricing',
          label: 'Pricing',
          content: <PricingTab subscriptionId={data.id} />,
        },
        {
          value: 'entitlements',
          label: 'Entitlements',
          content: <EntitlementsTab subscriptionId={data.id} />,
        },
      ]}
    >
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
    </CatalogDetailFrame>
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

function PricingTab({ subscriptionId }: { subscriptionId: string }) {
  const lines = useSubscriptionLines(subscriptionId)
  if (lines.isPending) return <LoadingRows />
  if (lines.error) {
    return <AppFailure title="Pricing could not be loaded" onRetry={() => void lines.refetch()} />
  }
  return (
    <SimpleTable<SubscriptionLine>
      rows={lines.data ?? []}
      getRowId={(line) => line.id}
      empty="This contract has no priced lines."
      columns={[
        { key: 'name', header: 'Charge', cell: (line) => line.name },
        {
          key: 'kind',
          header: 'Type',
          cell: (line) => (line.kind === 'usage' ? 'Usage' : 'Fixed'),
        },
        { key: 'quantity', header: 'Quantity', cell: (line) => line.quantity || '—' },
        { key: 'period', header: 'Billed', cell: (line) => line.billingPeriodLabel },
        {
          key: 'amount',
          header: 'Price',
          className: 'text-right',
          cell: (line) => formatMoney(line.amount),
        },
      ]}
    />
  )
}

function EntitlementsTab({ subscriptionId }: { subscriptionId: string }) {
  const entitlements = useSubscriptionEntitlements(subscriptionId)
  if (entitlements.isPending) return <LoadingRows />
  if (entitlements.error) {
    return (
      <AppFailure
        title="Entitlements could not be loaded"
        onRetry={() => void entitlements.refetch()}
      />
    )
  }
  return (
    <SimpleTable<SubscriptionEntitlement>
      rows={entitlements.data ?? []}
      getRowId={(row) => row.featureId || row.name}
      empty="This contract includes no features."
      columns={[
        { key: 'feature', header: 'Feature', cell: (row) => row.name },
        {
          key: 'access',
          header: 'Access',
          cell: (row) => (row.enabled ? 'Included' : 'Not included'),
        },
        {
          key: 'limit',
          header: 'Limit',
          cell: (row) =>
            row.usageLimit === null
              ? 'Unlimited'
              : `${row.usageLimit.toLocaleString()}${row.softLimit ? ' (soft)' : ''}${row.resetPeriodLabel ? ` / ${row.resetPeriodLabel.toLowerCase()}` : ''}`,
        },
      ]}
    />
  )
}
