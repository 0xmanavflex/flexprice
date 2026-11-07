import { env } from '@/env'
import { useMemo, useState } from 'react'
import {
  explainContractCreateError,
  useAddons,
  useEntitiesCharges,
  useContractPickerCoupons,
  useCreateSubscription,
  useCreditGrants,
  useCustomerTaxAssociations,
  useCustomCurrencyConfig,
  useCustomer,
  useContractPickerCustomers,
  useFeaturesByMeters,
  useFxRates,
  useInheritanceBlocks,
  useParentContractCandidates,
  usePlanEntitlements,
  useContractPickerPlans,
  usePrices,
  useTaxRates,
} from '@fp/query'
import {
  AddonStatus,
  type CreateSubscription,
  CreditGrantScope,
  creditGrantToDraft,
  DEFAULT_ADDON_QUERY,
  DEFAULT_TAX_RATE_QUERY,
  formatMoney,
  FxRateScope,
  PriceEntityType,
  TaxRateStatus,
} from '@fp/domain'
import { SubscriptionForm, toast } from '@fp/ui/pages'
import { useSession } from '@/app/session'
import { usePlanFormOptions, withMeters } from '../plans/planFormOptions'

export interface SubscriptionFormPageProps {
  /** Set when opened from a customer's own page: the Customer step is dropped. */
  customerId?: string
  step?: string
  onStepChange: (id: string) => void
  onCancel: () => void
  onDone: (subscriptionId: string, draft?: boolean) => void
}

const PICKER_PAGE = { page: 1, pageSize: Number.MAX_SAFE_INTEGER }

/**
 * Create a subscription (contract) on its own page.
 *
 * Loads the customers and plans to choose from, then the chosen plan's charges
 * and entitlements so the Plan & charges and Benefits steps can override them.
 * The customer list carries no currency today, so the form's currency falls
 * back to the plan's; a customer option with `currency` set would seed it.
 */
export function SubscriptionFormPage({
  customerId,
  step,
  onStepChange,
  onCancel,
  onDone,
}: SubscriptionFormPageProps) {
  const create = useCreateSubscription()
  const [planId, setPlanId] = useState('')
  const [chosenCustomer, setChosenCustomer] = useState(customerId ?? '')

  const customers = useContractPickerCustomers()
  const plans = useContractPickerPlans()
  const charges = usePrices(PriceEntityType.Plan, planId)
  const entitlements = usePlanEntitlements(planId ? [planId] : [])
  const planGrants = useCreditGrants(CreditGrantScope.Plan, planId)
  // The metered features and price units a charge added to this contract alone can use.
  const formOptions = usePlanFormOptions()
  // The global exchange rates: a contract invoiced in another currency needs one for its pair.
  const fxRates = useFxRates({ scope: FxRateScope.Tenant })
  // And the custom currencies, which convert at their own factor instead.
  const { environmentId } = useSession()
  const currencyConfig = useCustomCurrencyConfig(environmentId)
  const fxCustomCurrencies = useMemo(
    () =>
      currencyConfig.data
        ? Object.fromEntries(
            Object.entries(currencyConfig.data.customCurrencies).map(([code, currency]) => [
              code.toLowerCase(),
              Object.fromEntries(
                Object.entries(currency.fiatConversionFactors).map(([fiat, factor]) => [
                  fiat.toLowerCase(),
                  factor,
                ]),
              ),
            ]),
          )
        : undefined,
    [currencyConfig.data],
  )
  const coupons = useContractPickerCoupons()
  const addons = useAddons({
    ...DEFAULT_ADDON_QUERY,
    ...PICKER_PAGE,
    statuses: [AddonStatus.Published],
  })
  // The charges of the add-ons that have any, read in one search, so each can be
  // repriced before it is added and a usage charge can carry a commitment.
  const addonIds = (addons.data?.addons ?? []).filter((a) => a.chargeCount > 0).map((a) => a.id)
  const addonCharges = useEntitiesCharges(PriceEntityType.Addon, addonIds)
  // The plan's and the add-ons' usage charges' meters, by id: the picker reads only
  // the first page of features, and a price override needs its charge's meter to offer a bucket.
  const planMeters = useFeaturesByMeters(
    [...(charges.data ?? []), ...[...(addonCharges.data?.values() ?? [])].flat()].flatMap(
      (charge) => (charge.meterId ? [charge.meterId] : []),
    ),
  )
  const meters = withMeters(formOptions.meters, planMeters.data ?? [])
  // Refetched on focus: "Create a tax rate" opens in a new tab, and the rate
  // made there should be pickable on return without losing this draft.
  const taxRates = useTaxRates(
    {
      ...DEFAULT_TAX_RATE_QUERY,
      ...PICKER_PAGE,
      statuses: [TaxRateStatus.Published],
    },
    { refetchOnWindowFocus: true },
  )
  const associations = useCustomerTaxAssociations(chosenCustomer)
  const customerTaxes = useMemo<CreateSubscription['taxes'] | null>(
    () =>
      associations.data
        ? associations.data.map((association) => ({
            taxRateCode: association.taxRateCode,
            name: association.taxRateName,
            percentage: association.percentage,
            taxBehavior: association.taxBehavior,
            priority: association.priority,
            autoApply: association.autoApply,
          }))
        : null,
    [associations.data],
  )

  // The chosen customer itself, which may sit past the picker's first page: its
  // billing currency decides whether the contract converts.
  const chosen = useCustomer(chosenCustomer)
  const customerOptions = useMemo(() => {
    const list = customers.data?.customers ?? []
    const all =
      chosen.data && !list.some((c) => c.id === chosen.data.id) ? [chosen.data, ...list] : list
    return all.map((c) => ({
      value: c.id,
      // The name in the field; the email under it in the list (and beside it on Review).
      label: c.name,
      ...(c.email ? { hint: c.email } : {}),
      externalId: c.externalId || undefined,
      billingCurrency: c.billingCurrency || undefined,
      timezone: c.timezone || undefined,
    }))
  }, [customers.data, chosen.data])
  // Who can inherit from the chosen customer: anyone without a contract of their own.
  const inheritanceBlocks = useInheritanceBlocks(
    chosenCustomer,
    customerOptions.filter((c) => c.externalId).map((c) => c.value),
  )
  // Contracts this one can sit under, for a customer hierarchy.
  const parentCandidates = useParentContractCandidates()
  const parentContracts = useMemo(
    () =>
      (parentCandidates.data ?? []).map((contract) => ({
        value: contract.id,
        label: `${contract.customerName} · ${contract.planName}`,
        hint: contract.id,
        customerId: contract.customerId,
      })),
    [parentCandidates.data],
  )
  const nameOf = (externalId: string) =>
    customerOptions.find((c) => c.externalId === externalId)?.label ?? externalId
  const planOptions = useMemo(
    () => (plans.data?.plans ?? []).map((p) => ({ value: p.id, label: p.name })),
    [plans.data],
  )

  return (
    <SubscriptionForm
      spendingAllowancesEnabled={env.spendingAllowancesEnabled}
      pickerStatus={
        customers.isError ||
        plans.isError ||
        coupons.isError ||
        addons.isError ||
        taxRates.isError ||
        formOptions.isError
          ? 'failed'
          : customers.isPending ||
              plans.isPending ||
              coupons.isPending ||
              addons.isPending ||
              taxRates.isPending ||
              formOptions.isLoading
            ? 'loading'
            : 'ready'
      }
      customers={customerOptions}
      plans={planOptions}
      customerLocked={customerId !== undefined}
      {...(inheritanceBlocks.data ? { inheritanceBlocks: inheritanceBlocks.data } : {})}
      parentContracts={parentContracts}
      {...(customerId ? { defaultValue: { customerId } } : {})}
      plan={
        planId
          ? {
              charges: charges.data ?? [],
              entitlements: entitlements.data ?? [],
              creditGrants: planGrants.data?.map(creditGrantToDraft),
              isLoading: charges.isPending || entitlements.isPending,
            }
          : undefined
      }
      onPlanChange={setPlanId}
      // Undefined while unknown (loading or failed): the form blocks on a missing rate only once it knows.
      fxCustomCurrencies={fxCustomCurrencies}
      fxSettingsFailed={currencyConfig.isError}
      fxGlobalRates={fxRates.data?.map((rate) => ({
        fromCurrency: rate.fromCurrency,
        toCurrency: rate.toCurrency,
        rate: rate.rate,
      }))}
      onCustomerChange={setChosenCustomer}
      features={formOptions.featureOptions}
      meters={meters}
      priceUnits={formOptions.units}
      couponsStatus={coupons.isPending ? 'loading' : coupons.isError ? 'failed' : 'ready'}
      coupons={(coupons.data?.coupons ?? []).map((coupon) => ({
        value: coupon.id,
        label: coupon.name,
        code: coupon.code || undefined,
        discount: coupon.percentageOff
          ? `${coupon.percentageOff}%`
          : coupon.amountOff
            ? formatMoney(coupon.amountOff)
            : undefined,
      }))}
      addons={(addons.data?.addons ?? []).map((addon) => ({
        value: addon.id,
        label: addon.name,
        type: addonType(addon.fixedChargeCount, addon.usageChargeCount),
      }))}
      // Undefined while unknown (loading or failed); a loaded add-on missing from the result has none.
      addonCharges={(addonId) =>
        addons.data && addonIds.length === 0
          ? []
          : addonCharges.data
            ? (addonCharges.data.get(addonId) ?? [])
            : undefined
      }
      addonChargesFailed={addonCharges.isError && !addonCharges.data}
      createTaxRateHref="/taxes/new"
      taxRates={(taxRates.data?.taxRates ?? []).map((rate) => ({
        code: rate.code,
        name: rate.name,
        percentage: rate.percentageValue,
      }))}
      customerTaxes={chosenCustomer ? customerTaxes : null}
      trail={[{ label: 'Contracts', onClick: onCancel }, { label: 'New contract' }]}
      {...(step ? { step } : {})}
      onStepChange={onStepChange}
      onCancel={onCancel}
      isSubmitting={create.isPending}
      // The hierarchy explanation is guidance, so it stays at the top; every
      // other refusal from the API is a toast (MutationToasts).
      submitError={explainContractCreateError(create.error, nameOf)}
      onSubmit={(draft) =>
        create.mutate(draft, {
          onSuccess: (created) => {
            if (created.entitlementFailures.length)
              toast.warning('Contract created with missing entitlements', {
                description: `Could not add ${created.entitlementFailures.map((id) => formOptions.featureOptions.find((feature) => feature.id === id)?.name ?? id).join(', ')}. Open Entitlements on the contract to retry.`,
                duration: 12000,
              })
            onDone((created as { id?: string }).id ?? '', draft.draft)
          },
        })
      }
    />
  )
}

/** What an add-on bills, from its charges: "Fixed", "Usage" or "Fixed and usage". */
function addonType(fixed: number, usage: number): string | undefined {
  if (fixed > 0 && usage > 0) return 'Fixed and usage'
  if (fixed > 0) return 'Fixed'
  if (usage > 0) return 'Usage'
  return undefined
}
