import { useState } from 'react'
import {
  DEFAULT_ADDON_QUERY,
  DEFAULT_COUPON_QUERY,
  DEFAULT_TAX_RATE_QUERY,
  SubscriptionStatus,
  type SubscriptionCancellationType,
  lineRevertDraft,
} from '@fp/domain'
import {
  ApiError,
  useActivateSubscription,
  useCancelSubscriptionCreditGrant,
  useRemoveSubscriptionAddon,
  useRemoveSubscriptionTax,
  useAddons,
  useAddSubscriptionAddon,
  useAddSubscriptionCoupon,
  useCancelSubscription,
  useCoupons,
  useCreateSubscriptionCreditGrant,
  useCreateSubscriptionEntitlement,
  useCreateSubscriptionTax,
  useCustomerIntegrationLinks,
  useIntegrations,
  useLinkCustomerIntegration,
  useTaxRates,
  useUnlinkCustomerIntegration,
  useCreateSubscriptionLineItem,
  useDeleteSubscriptionLineItem,
  useExecuteLineChange,
  usePreviewLineChange,
  useSubscription,
  useContractChargeAlerts,
  useSubscriptionAddons,
  useSubscriptionCoupons,
  useSubscriptionCreditGrants,
  useSubscriptionEntitlements,
  useSubscriptionInvoicePreview,
  useSubscriptionInvoices,
  useSubscriptionLines,
  useSubscriptionLineHistory,
  useSubscriptionSchedules,
  useSubscriptionTaxes,
  useSubscriptionUsage,
  useUpdateAlertSetting,
  useUpdateSubscriptionLineItem,
  useActivityLog,
  serverReason,
} from '@fp/query'
import { SubscriptionDetailView, type SubscriptionPart } from '@fp/ui/pages'
import { ConfirmDialog, DateInput, OptionSelect } from '@fp/ui/compositions'
import { Input, Switch } from '@fp/ui/primitives'
import { usePlanFormOptions } from '../plans/planFormOptions'
import { railActivity } from '@/pages/shared/activityLog'
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
  { value: 'scheduled_date', label: 'On a date' },
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
  // Ended lines too, so a changed price stays visible as an inactive version.
  // If it fails, the page falls back to the lines billing now.
  const lineHistory = useSubscriptionLineHistory(subscriptionId)
  const chargeAlerts = useContractChargeAlerts(subscriptionId)
  const entitlements = useSubscriptionEntitlements(subscriptionId)
  const creditGrants = useSubscriptionCreditGrants(subscriptionId)
  const usage = useSubscriptionUsage(subscriptionId)
  const invoices = useSubscriptionInvoices(subscriptionId)
  const schedules = useSubscriptionSchedules(subscriptionId)
  const addons = useSubscriptionAddons(subscriptionId)
  const coupons = useSubscriptionCoupons(subscriptionId)
  const taxes = useSubscriptionTaxes(subscriptionId)
  const status = subscription.data?.status
  const preview = useSubscriptionInvoicePreview(subscriptionId, {
    hideZeroCharges: true,
    enabled: status === SubscriptionStatus.Active || status === SubscriptionStatus.Paused,
  })
  const cancel = useCancelSubscription()
  const activate = useActivateSubscription()
  const removeAddon = useRemoveSubscriptionAddon()
  const removeTax = useRemoveSubscriptionTax()
  const endGrant = useCancelSubscriptionCreditGrant()
  const addLine = useCreateSubscriptionLineItem()
  const editLine = useUpdateSubscriptionLineItem()
  const endLine = useDeleteSubscriptionLineItem()
  const previewChange = usePreviewLineChange()
  const executeChange = useExecuteLineChange()
  const formOptions = usePlanFormOptions()
  const customerId = subscription.data?.customerId ?? ''
  const integrationLinks = useCustomerIntegrationLinks(customerId)
  const integrations = useIntegrations()
  const linkIntegration = useLinkCustomerIntegration(customerId)
  const unlinkIntegration = useUnlinkCustomerIntegration(customerId)
  const createEntitlement = useCreateSubscriptionEntitlement(subscriptionId)
  const createCreditGrant = useCreateSubscriptionCreditGrant(subscriptionId)
  const addAddon = useAddSubscriptionAddon(subscriptionId)
  const addCoupon = useAddSubscriptionCoupon(subscriptionId)
  const updateAlert = useUpdateAlertSetting()
  const createTax = useCreateSubscriptionTax(subscriptionId)
  const addonCatalogue = useAddons({ ...DEFAULT_ADDON_QUERY, pageSize: 100 })
  const couponCatalogue = useCoupons({ ...DEFAULT_COUPON_QUERY, pageSize: 100 })
  const taxRateCatalogue = useTaxRates({
    ...DEFAULT_TAX_RATE_QUERY,
    pageSize: 100,
    statuses: ['published'],
  })

  const [dialog, setDialog] = useState<'cancel' | 'activate' | null>(null)
  const [cancellationType, setCancellationType] =
    useState<SubscriptionCancellationType>('end_of_period')
  const [reason, setReason] = useState('')
  const [cancelAt, setCancelAt] = useState('')
  const [prorate, setProrate] = useState(false)
  const [finalInvoice, setFinalInvoice] = useState(false)
  const [cancelProblem, setCancelProblem] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(today())

  const activityLog = useActivityLog({ entityType: 'subscription', entityId: subscriptionId })
  const activity = activityLog.data ? railActivity(activityLog.data) : []

  if (!subscription.data) {
    return detailGate(subscription, {
      noun: 'this contract',
      listName: 'contracts',
      onBack: onNavigateToList,
    })
  }

  const data = subscription.data
  const linkedTypes = new Set((integrationLinks.data ?? []).map((link) => link.providerType))
  const linkableProviders = (integrations.data ?? [])
    .filter((integration) => integration.connection && !linkedTypes.has(integration.providerType))
    .map((integration) => ({ providerType: integration.providerType, name: integration.name }))
  const close = () => setDialog(null)

  return (
    <>
      <SubscriptionDetailView
        subscription={data}
        lines={part(lines)}
        {...(lineHistory.data ? { lineHistory: lineHistory.data } : {})}
        onRevertLine={(line, previous) => {
          // No revert endpoint: the old price goes out as a new version from now.
          const draft = lineRevertDraft(previous, line.priceId)
          return draft
            ? editLine.mutateAsync({ lineItemId: line.id, draft })
            : Promise.reject(
                new Error('The earlier price was not reported, so it cannot be restored.'),
              )
        }}
        chargeAlerts={part(chargeAlerts)}
        entitlements={part(entitlements)}
        creditGrants={part(creditGrants)}
        usage={part(usage)}
        invoices={part(invoices)}
        schedules={part(schedules)}
        preview={part(preview)}
        addons={part(addons)}
        coupons={part(coupons)}
        taxes={part(taxes)}
        integrationLinks={integrationLinks.data ?? []}
        linkableProviders={linkableProviders}
        onLinkIntegration={(input) => linkIntegration.mutateAsync(input)}
        onUnlinkIntegration={(input) => unlinkIntegration.mutateAsync(input)}
        onAddEntitlement={(draft) => createEntitlement.mutateAsync(draft)}
        onAddCreditGrant={(draft) => createCreditGrant.mutateAsync(draft)}
        onAddAddon={(draft) => addAddon.mutateAsync(draft)}
        onAddCoupon={(draft) => addCoupon.mutateAsync(draft)}
        onSaveChargeAlert={({ settingId, config }) =>
          updateAlert.mutateAsync({ id: settingId, config })
        }
        onAddTax={(draft) => createTax.mutateAsync(draft)}
        onRemoveAddon={(addon) => removeAddon.mutateAsync(addon.id)}
        onRemoveTax={(tax) => removeTax.mutateAsync(tax.id)}
        onCancelCreditGrant={(grant) => endGrant.mutateAsync(grant.id)}
        sectionOptions={{
          features: formOptions.featureOptions,
          addons: (addonCatalogue.data?.addons ?? [])
            .filter((addon) => addon.status === 'published')
            .map((addon) => ({ id: addon.id, name: addon.name })),
          coupons: (couponCatalogue.data?.coupons ?? [])
            .filter((coupon) => coupon.code !== '')
            .map((coupon) => ({ code: coupon.code, name: coupon.name })),
          taxRates: (taxRateCatalogue.data?.taxRates ?? [])
            .filter((rate) => rate.code !== '')
            .map((rate) => ({
              code: rate.code,
              label: `${rate.name}${rate.percentageValue ? ` (${rate.percentageValue}%)` : ''}`,
            })),
        }}
        activity={activity}
        {...(activityLog.isPending
          ? { activityEmptyText: 'Loading activity…' }
          : activityLog.isError
            ? { activityEmptyText: 'Could not load activity.' }
            : {})}
        activityAwaiting={activityLog.isAwaiting}
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
                onValueChange={(value) => {
                  setCancellationType(value as SubscriptionCancellationType)
                  setCancelProblem(null)
                }}
                options={CANCEL_OPTIONS}
              />
            </label>
            {cancellationType === 'scheduled_date' ? (
              <label htmlFor="cancel-at" className="flex flex-col gap-1.5 text-sm">
                Cancel on
                <DateInput
                  id="cancel-at"
                  value={cancelAt}
                  onValueChange={(value) => {
                    setCancelAt(value)
                    setCancelProblem(null)
                  }}
                />
              </label>
            ) : null}
            <span className="flex items-center justify-between gap-4 text-sm">
              <label htmlFor="cancel-prorate">Prorate the current period</label>
              <Switch id="cancel-prorate" checked={prorate} onCheckedChange={setProrate} />
            </span>
            {cancellationType === 'immediate' ? (
              <span className="flex items-center justify-between gap-4 text-sm">
                <label htmlFor="cancel-invoice">Raise a final invoice now</label>
                <Switch
                  id="cancel-invoice"
                  checked={finalInvoice}
                  onCheckedChange={setFinalInvoice}
                />
              </span>
            ) : null}
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
        error={cancelProblem ?? toError(cancel.error, 'cancel')}
        onConfirm={() => {
          if (cancellationType === 'scheduled_date' && !cancelAt) {
            setCancelProblem('Pick the day the contract ends.')
            return
          }
          if (cancellationType === 'scheduled_date' && cancelAt < today()) {
            setCancelProblem('The cancellation date cannot be in the past.')
            return
          }
          cancel.mutate(
            {
              id: data.id,
              draft: {
                cancellationType,
                reason,
                prorate,
                ...(cancellationType === 'scheduled_date' ? { cancelAt } : {}),
                ...(cancellationType === 'immediate' ? { generateInvoice: finalInvoice } : {}),
              },
            },
            { onSuccess: close },
          )
        }}
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
    return serverReason(error) ?? `You do not have permission to ${verb} contracts here.`
  if (error instanceof ApiError && error.kind === 'invalid')
    return error.message || 'Check the details and try again.'
  return `Could not ${verb} the contract. Try again.`
}
