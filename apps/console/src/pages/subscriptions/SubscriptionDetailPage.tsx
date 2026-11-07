import { env } from '@/env'
import { useState } from 'react'
import { FxRatesPanel } from '@/pages/forex/FxRatesPanel'
import { useSession } from '@/app/session'
import { SubscriptionJournalPanel } from './SubscriptionJournalPanel'
import { SubscriptionRevenuePanel } from './SubscriptionRevenuePanel'
import {
  RBAC_ENTITY,
  activationStartDate,
  activationStartDay,
  AlertEntityType,
  DEFAULT_ADDON_QUERY,
  DEFAULT_TAX_RATE_QUERY,
  isUnstartedSubscription,
  PriceEntityType,
  SubscriptionStatus,
  type SubscriptionCancellationType,
  type SubscriptionLine,
} from '@fp/domain'
import {
  useContractPickerCustomers,
  useContractBenefitRecords,
  useEditContractEntitlement,
  useResetContractEntitlement,
  useCreateSpendingAllowance,
  useDetachInheritedContract,
  useParentContractCandidates,
  useUpdateContractParent,
  useChangeInheritedCustomers,
  useInheritanceBlocks,
  ApiError,
  useActivateSubscription,
  useRevenueRecognitionEnabled,
  useRemoveSubscriptionCoupon,
  usePauseSubscription,
  useResumeSubscription,
  useCancelSubscriptionCreditGrant,
  useRemoveSubscriptionAddon,
  useRemoveSubscriptionTax,
  useAddons,
  useEntitiesCharges,
  useFeaturesByMeters,
  useAddSubscriptionAddon,
  useAddSubscriptionCoupon,
  useCancelSubscription,
  useContractPickerCoupons,
  useCreateSubscriptionCreditGrant,
  useCreateSubscriptionEntitlement,
  useCreateSubscriptionTax,
  useCreateTaxRate,
  useEntityIntegrationControls,
  useTaxRates,
  useCreateSubscriptionLineItem,
  useDeleteSubscriptionLineItem,
  useExecuteLineChange,
  usePreviewLineChange,
  useInheritedContracts,
  useSubscription,
  useContractChargeAlerts,
  useSubscriptionAddons,
  useSubscriptionCoupons,
  useSubscriptionCreditGrants,
  useSubscriptionEntitlements,
  useContractUsageSummary,
  useSubscriptionInvoicePreview,
  useSubscriptionInvoices,
  useSubscriptionLines,
  useCustomer,
  useSubscriptionLineHistory,
  useSubscriptionLineVersions,
  useSubscriptionSchedules,
  useSubscriptionTaxes,
  useSubscriptionUsage,
  useUpdateAlertSetting,
  useAddLineItemAlert,
  useLineItemAlertLookup,
  useUpdateSubscriptionLineItem,
  useActivityLog,
  serverReason,
} from '@fp/query'
import {
  ContractBenefitsEditor,
  ContractHierarchyEditor,
  EntityAlertDialog,
  SubscriptionDetailView,
  type SubscriptionPart,
  type SubscriptionTab,
} from '@fp/ui/pages'
import { AccessScope, ConfirmDialog, DateInput, OptionSelect } from '@fp/ui/compositions'
import { Input, Switch } from '@fp/ui/primitives'
import { usePlanFormOptions, withMeters } from '../plans/planFormOptions'
import { railActivity } from '@/pages/shared/activityLog'
import { CustomerAnalyticsPanel } from '@/pages/customers/CustomerAnalyticsPanel'
import { detailGate } from '../shared/detailGate'
import { useEntityAlert } from '../shared/useEntityAlert'

export interface SubscriptionDetailPageProps {
  subscriptionId: string
  onNavigateToList: () => void
  onOpenCustomer: (customerId: string) => void
  onOpenPlan: (planId: string) => void
  onOpenInvoice: (invoiceId: string) => void
  /** Another contract: an inherited one's parent, or a parent's inherited contracts. */
  onOpenContract?: (subscriptionId: string) => void
  /** The open tab, kept in the URL so going back reopens it. */
  tab?: SubscriptionTab
  onTabChange?: (tab: SubscriptionTab) => void
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
  onOpenContract,
  tab,
  onTabChange,
}: SubscriptionDetailPageProps) {
  const subscription = useSubscription(subscriptionId)
  // A parent's inherited contracts, as V1 lists them; only a parent has any.
  const inheritedContracts = useInheritedContracts(
    subscription.data?.subscriptionType === 'parent' ? subscriptionId : '',
  )
  const lines = useSubscriptionLines(subscriptionId)
  const { environmentId } = useSession()
  const revenueRecognition = useRevenueRecognitionEnabled(environmentId)
  // The Usage tab's breakdown is matched by the customer's external id.
  const contractCustomer = useCustomer(subscription.data?.customerId ?? '')
  // Ended lines too, so a changed price stays visible as an inactive version.
  // If it fails, the page falls back to the lines billing now.
  const lineHistory = useSubscriptionLineHistory(subscriptionId)
  // A charge's versions come from the history API when its sheet opens.
  const [openLine, setOpenLine] = useState<SubscriptionLine | null>(null)
  const lineVersions = useSubscriptionLineVersions(openLine?.id ?? '')
  const chargeAlerts = useContractChargeAlerts(subscriptionId)
  const entitlements = useSubscriptionEntitlements(subscriptionId)
  const benefitRecords = useContractBenefitRecords(subscriptionId)
  const editBenefit = useEditContractEntitlement(subscriptionId)
  const resetBenefit = useResetContractEntitlement(subscriptionId)
  const detachInherited = useDetachInheritedContract()
  const createAllowance = useCreateSpendingAllowance(subscriptionId)
  // Every customer and every parent candidate is a large read: it waits until
  // the hierarchy editor opens a dialog that picks from them.
  const [hierarchyOptions, setHierarchyOptions] = useState(false)
  const hierarchyCustomers = useContractPickerCustomers(hierarchyOptions)
  const parentCandidates = useParentContractCandidates(hierarchyOptions)
  const parentContract = useSubscription(subscription.data?.parentSubscriptionId ?? '')
  const updateParent = useUpdateContractParent(subscriptionId)
  const changeInheritance = useChangeInheritedCustomers(subscriptionId)
  const inheritanceBlocks = useInheritanceBlocks(
    subscription.data?.customerId ?? '',
    (hierarchyCustomers.data?.customers ?? []).map((customer) => customer.id),
    hierarchyOptions,
  )
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
  const pause = usePauseSubscription()
  const resume = useResumeSubscription()
  const contractAlert = useEntityAlert(AlertEntityType.Subscription, subscriptionId, 'Contract')
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
  // The usage against this contract's entitlements, from the endpoint the
  // customer overview reads, narrowed to this contract.
  const entitlementUsage = useContractUsageSummary(customerId, subscriptionId)
  const integrationMappings = useEntityIntegrationControls('subscription', subscriptionId)
  const createEntitlement = useCreateSubscriptionEntitlement(subscriptionId)
  const createCreditGrant = useCreateSubscriptionCreditGrant(
    subscriptionId,
    subscription.data?.currentPeriodEnd,
  )
  const addAddon = useAddSubscriptionAddon(subscriptionId)
  const addCoupon = useAddSubscriptionCoupon(subscriptionId)
  const removeCoupon = useRemoveSubscriptionCoupon(subscriptionId)
  const updateAlert = useUpdateAlertSetting()
  const addLineAlert = useAddLineItemAlert(subscriptionId)
  const loadLineAlert = useLineItemAlertLookup(subscriptionId)
  const createTax = useCreateSubscriptionTax(subscriptionId)
  const createTaxRate = useCreateTaxRate()
  const addonCatalogue = useAddons({ ...DEFAULT_ADDON_QUERY, pageSize: Number.MAX_SAFE_INTEGER })
  const couponCatalogue = useContractPickerCoupons()
  // The charges of add-ons that have any, so attaching one can reprice them and commit on usage.
  const addonIds = (addonCatalogue.data?.addons ?? [])
    .filter((addon) => addon.status === 'published' && addon.chargeCount > 0)
    .map((addon) => addon.id)
  const addonCharges = useEntitiesCharges(PriceEntityType.Addon, addonIds)
  // The add-on charges' meters, by id: the feature picker reads only its first page,
  // and an add-on price override needs its charge's meter to offer a bucket size.
  const addonMeters = useFeaturesByMeters(
    [...(addonCharges.data?.values() ?? [])]
      .flat()
      .flatMap((charge) => (charge.meterId ? [charge.meterId] : [])),
  )
  const meters = withMeters(formOptions.meters, addonMeters.data ?? [])
  const taxRateCatalogue = useTaxRates({
    ...DEFAULT_TAX_RATE_QUERY,
    pageSize: Number.MAX_SAFE_INTEGER,
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
  const [startDate, setStartDate] = useState('')

  const activityLog = useActivityLog({ entityType: 'subscription', entityId: subscriptionId })
  const activity = activityLog.data ? railActivity(activityLog.data) : []

  if (!subscription.data) {
    return detailGate(subscription, {
      noun: 'this contract',
      listName: 'contracts',
      onBack: onNavigateToList,
      recordPath: `/subscriptions/${encodeURIComponent(subscriptionId)}`,
    })
  }

  const data = subscription.data
  const close = () => setDialog(null)

  return (
    <>
      <SubscriptionDetailView
        tab={tab}
        onTabChange={onTabChange}
        subscription={data}
        lines={part(lines)}
        {...(() => {
          // The contract's metered charges, by meter: the usage breakdown is the
          // customer's analytics narrowed to them, opening on the current period.
          const externalId = contractCustomer.data?.externalId ?? ''
          const meterIds = [
            ...new Set(
              (lines.data ?? []).flatMap((line) =>
                line.charge?.meterId && !line.charge.endDate ? [line.charge.meterId] : [],
              ),
            ),
          ]
          const s = subscription.data
          if (!externalId || meterIds.length === 0 || !s) return {}
          // The panel's range is whole local days, so each instant becomes its
          // local date: the day the period starts or ends on this screen.
          const day = (date: Date) =>
            `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
          const now = new Date()
          const start = s.currentPeriodStart
          // Up to today, never past the period's end; a period not yet started
          // opens on its first day alone rather than on a backwards range.
          const end = s.currentPeriodEnd && s.currentPeriodEnd < now ? s.currentPeriodEnd : now
          const from = start ? day(start) : undefined
          const to = from && day(end) < from ? from : day(end)
          return {
            usageBreakdown: (
              <CustomerAnalyticsPanel
                externalId={externalId}
                scope={{
                  meterIds,
                  from,
                  to,
                }}
              />
            ),
          }
        })()}
        {...(lineHistory.data ? { lineHistory: lineHistory.data } : {})}
        onOpenLine={setOpenLine}
        {...(openLine
          ? {
              openLineHistory: {
                ...(lineVersions.data ? { lines: lineVersions.data } : {}),
                isLoading: lineVersions.isLoading,
                error: lineVersions.error ? 'The history could not be loaded.' : null,
                onRetry: () => void lineVersions.refetch(),
              },
            }
          : {})}
        chargeAlerts={part(chargeAlerts)}
        {...(revenueRecognition.data
          ? {
              revenue: <SubscriptionRevenuePanel subscriptionId={subscriptionId} />,
              journal: (
                <SubscriptionJournalPanel
                  subscriptionId={subscriptionId}
                  invoices={invoices.data}
                  onOpenInvoice={onOpenInvoice}
                />
              ),
            }
          : {})}
        fxOverrides={
          // A contract converts from its own currency; an ended one keeps its rows read-only.
          <FxRatesPanel
            owner={{ scope: 'subscription', scopeId: data.id }}
            lockedFrom={data.currency.toLowerCase()}
            emptyDescription="Invoices use the customer's override or the global forex rate."
            readOnly={data.status === 'cancelled'}
          />
        }
        benefitsEditor={
          <AccessScope entity={RBAC_ENTITY.Entitlement}>
            <ContractBenefitsEditor
              spendingAllowancesEnabled={env.spendingAllowancesEnabled}
              currency={data.currency}
              subscriptionId={data.id}
              entitlements={entitlements.data ?? []}
              usage={entitlementUsage.data?.features}
              records={benefitRecords.data ?? []}
              features={formOptions.featureOptions}
              isLoading={benefitRecords.isPending || entitlements.isPending}
              error={
                benefitRecords.isError || entitlements.isError
                  ? 'Reload the entitlement data and try again.'
                  : null
              }
              onRetry={() => {
                void benefitRecords.refetch()
                void entitlements.refetch()
              }}
              readOnly={data.status === 'cancelled' || data.subscriptionType === 'inherited'}
              onCreate={(draft) => createEntitlement.mutateAsync(draft)}
              onCreateAllowance={(draft) => createAllowance.mutateAsync(draft)}
              onEdit={(entitlement, draft) => editBenefit.mutateAsync({ entitlement, draft })}
              onReset={(entitlement) => resetBenefit.mutateAsync(entitlement)}
            />
          </AccessScope>
        }
        hierarchyEditor={
          <AccessScope entity={RBAC_ENTITY.Subscription}>
            <ContractHierarchyEditor
              onDetach={(childId) => detachInherited.mutateAsync(childId)}
              subscription={data}
              inherited={inheritedContracts.data ?? []}
              customers={hierarchyCustomers.data?.customers ?? []}
              parents={parentCandidates.data ?? []}
              blockedCustomerIds={inheritanceBlocks.data}
              loading={data.subscriptionType === 'parent' && inheritedContracts.isPending}
              error={
                data.subscriptionType === 'parent' && inheritedContracts.isError
                  ? 'Reload the contract hierarchy and try again.'
                  : null
              }
              onRetry={() => {
                void inheritedContracts.refetch()
              }}
              parentLabel={
                parentContract.data
                  ? `${parentContract.data.customerName} · ${parentContract.data.planName}`
                  : null
              }
              parent={parentContract.data ?? null}
              {...(onOpenContract ? { onOpenContract } : {})}
              onOpenCustomer={onOpenCustomer}
              onLoadOptions={() => setHierarchyOptions(true)}
              optionsLoading={
                hierarchyOptions && (hierarchyCustomers.isPending || parentCandidates.isPending)
              }
              optionsError={
                hierarchyCustomers.isError || parentCandidates.isError
                  ? 'Reload the customers and contracts to choose from, and try again.'
                  : null
              }
              onRetryOptions={() => {
                void hierarchyCustomers.refetch()
                void parentCandidates.refetch()
              }}
              onParent={(parentId) => updateParent.mutateAsync(parentId)}
              onInherit={(action, externalIds) =>
                changeInheritance.mutateAsync({ action, externalIds })
              }
            />
          </AccessScope>
        }
        entitlements={part(entitlements)}
        entitlementUsage={entitlementUsage.data?.features}
        creditGrants={part(creditGrants)}
        usage={part(usage)}
        invoices={part(invoices)}
        schedules={part(schedules)}
        preview={part(preview)}
        addons={part(addons)}
        coupons={part(coupons)}
        taxes={part(taxes)}
        integrationLinks={integrationMappings.data ?? []}
        linkableProviders={integrationMappings.controls?.linkable ?? []}
        onLinkIntegration={(input) =>
          integrationMappings.controls?.onLink(input) ??
          Promise.reject(new Error('Contract mappings are not loaded.'))
        }
        onUnlinkIntegration={(input) =>
          integrationMappings.controls?.onUnlink(input) ??
          Promise.reject(new Error('Contract mappings are not loaded.'))
        }
        onAddEntitlement={(draft) => createEntitlement.mutateAsync(draft)}
        onAddCreditGrant={(draft) => createCreditGrant.mutateAsync(draft)}
        onAddAddon={(drafts, removals) =>
          addAddon.mutateAsync({ adds: drafts, removes: removals ?? [] })
        }
        onAddCoupon={(draft) => addCoupon.mutateAsync(draft)}
        onRemoveCoupon={(coupon) => removeCoupon.mutateAsync(coupon.id)}
        onSaveChargeAlert={({ settingId, config }) =>
          updateAlert.mutateAsync({ id: settingId, config })
        }
        onCreateChargeAlert={(draft) => addLineAlert.mutateAsync(draft)}
        loadChargeAlert={loadLineAlert}
        onAddTax={(draft) => createTax.mutateAsync(draft)}
        onCreateTaxRate={async (draft) => {
          await createTaxRate.mutateAsync(draft)
          return {
            code: draft.code,
            label: `${draft.name}${draft.percentageValue ? ` (${draft.percentageValue}%)` : ''}`,
          }
        }}
        onRemoveAddon={(addon) => removeAddon.mutateAsync(addon.id)}
        onRemoveTax={(tax) => removeTax.mutateAsync(tax.id)}
        onCancelCreditGrant={(grant, effectiveDate) =>
          endGrant.mutateAsync({ grantId: grant.id, effectiveDate })
        }
        sectionOptions={{
          features: formOptions.featureOptions,
          addons: (addonCatalogue.data?.addons ?? [])
            .filter((addon) => addon.status === 'published')
            .map((addon) => ({ id: addon.id, name: addon.name })),
          // Undefined while unknown (loading or failed); a loaded add-on missing from the result has none.
          addonCharges: (addonId) =>
            addonCatalogue.data && addonIds.length === 0
              ? []
              : addonCharges.data
                ? (addonCharges.data.get(addonId) ?? [])
                : undefined,
          addonChargesFailed: addonCharges.isError && !addonCharges.data,
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
        {...(onOpenContract ? { onOpenContract } : {})}
        {...(data.subscriptionType === 'parent'
          ? { inheritedContracts: part(inheritedContracts) }
          : {})}
        onOpenInvoice={onOpenInvoice}
        {...(isUnstartedSubscription(data.status)
          ? {
              onActivate: () => {
                // Opens on the draft's own start, not today: see activationStartDate.
                setStartDate(activationStartDay(data.startDate))
                setDialog('activate')
              },
            }
          : {})}
        onCancel={() => setDialog('cancel')}
        onPause={(draft) => pause.mutateAsync({ id: data.id, draft })}
        onResume={(draft) => resume.mutateAsync({ id: data.id, draft })}
        onAlertSettings={contractAlert.openAlertSettings}
        meters={meters}
        priceUnits={formOptions.units.filter((unit) => unit.baseCurrency === data.currency)}
        onAddCharge={async (draft) => {
          await addLine.mutateAsync({ id: data.id, draft })
        }}
        onEditCharge={async (line, draft) => {
          await editLine.mutateAsync({
            lineItemId: line.id,
            draft: { ...draft, subscriptionId: data.id },
          })
        }}
        onEndCharge={async (line, draft) => {
          await endLine.mutateAsync({ lineItemId: line.id, draft })
        }}
        onDeleteUpcomingLine={(lineId) =>
          endLine.mutateAsync({ lineItemId: lineId, draft: { effectiveFrom: '' } })
        }
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
            ) : (
              // The API raises a final invoice on demand only when the contract ends now;
              // otherwise the last one comes at the end, as every period's does.
              <span className="text-muted-foreground text-xs">
                The last invoice is raised when the contract ends. To invoice now, cancel
                immediately.
              </span>
            )}
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
            { id: data.id, startDate: activationStartDate(startDate, data.startDate) },
            { onSuccess: close },
          )
        }
      />
      <EntityAlertDialog {...contractAlert.dialog} />
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
