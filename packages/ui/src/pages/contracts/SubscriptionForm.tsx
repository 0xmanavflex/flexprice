import { useCalmForm } from '@ui/compositions/forms/useCalmForm'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Controller, type FieldErrors, type Resolver, type UseFormRegister } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  CalendarIcon,
  CoinsIcon,
  KeyRoundIcon,
  LayersIcon,
  ExternalLinkIcon,
  InfoIcon,
  MoreHorizontalIcon,
  CircleDollarSignIcon,
  PencilIcon,
  PlusIcon,
  PuzzleIcon,
  ReceiptIcon,
  RotateCcwIcon,
  ScaleIcon,
  Settings2Icon,
  TicketPercentIcon,
  Trash2Icon,
  UserIcon,
  UsersIcon,
  WalletIcon,
  XIcon,
} from '@ui/icons'
import {
  BILLING_MODEL_LABEL,
  BILLING_PERIOD_LABEL,
  BillingModel,
  BillingPeriod,
  type AddContractCharge,
  BillingCycle,
  type Charge,
  InvoiceCadence,
  attachableAddonCharges,
  attachableAddonCommitments,
  attachableAddonOverrides,
  type ChargeCommitment,
  type CreateCreditGrant,
  type CreateSubscription,
  FEATURE_TYPE_LABEL,
  PAYMENT_TERMS_LABEL,
  PaymentTerms,
  PriceType,
  type SubscriptionDiscount,
  type SubscriptionPhase,
  emptyPhase,
  phaseStarts,
  contractDay,
  selectContractCharges,
  type ContractChargeSelection,
  CREDIT_GRANT_CADENCE_LABEL,
  CREDIT_GRANT_EXPIRY_DURATION_UNIT_LABEL,
  CREDIT_GRANT_EXPIRY_TYPE_LABEL,
  CREDIT_GRANT_PERIOD_LABEL,
  CreditGrantCadence,
  CreditGrantExpiryType,
  type Entitlement,
  EntitlementGrantDurationUnit,
  EntitlementGrantMeasure,
  entitlementGrant,
  FeatureType,
  type MeteredGrant,
  meteredGrantSchema,
  meteredAllowanceLabel,
  meteredResetLabel,
  type PriceOverride,
  overrideFromCharge,
  type PriceTier,
  SUBSCRIPTION_BILLING_PERIODS,
  TierMode,
  USAGE_RESET_PERIOD_LABEL,
  createSubscriptionSchema,
  emptySubscription,
  currencyCodes,
  INHERITANCE_BLOCK_LABEL,
  InheritanceBlock,
  contractDateToInstant,
  tierUnitLabel,
} from '@fp/domain'
import { Alert, AlertDescription } from '@ui/components/reui/alert'
import { Badge } from '@ui/components/reui/badge'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@ui/components/primitives/input-group'
import { Switch } from '@ui/components/primitives/switch'
import type { DetailCrumb } from '@ui/compositions/detail/DetailShell'
import {
  ChoiceCards,
  Composer,
  SimpleTable,
  type SimpleColumn,
} from '@ui/compositions/detail/DetailKit'
import { LabelWithHint } from '@ui/compositions/forms/LabelWithHint'
import { Field } from '@ui/compositions/forms/Field'
import { GrantAllowanceFields } from '@ui/pages/product-catalog/entitlements/GrantAllowanceFields'
import { parseDateValue } from '@ui/compositions/forms/DateInput'
import { DateInput } from '@ui/compositions/forms/DateInput'
import { EmptyState } from '@ui/compositions/feedback/EmptyState'
import { FormCard, FormRow } from '@ui/compositions/forms/FormCard'
import { FormPage } from '@ui/compositions/forms/FormPage'
import { OptionCombobox } from '@ui/compositions/forms/OptionCombobox'
import { type Option, OptionSelect } from '@ui/compositions/forms/OptionSelect'
import { useFormSteps } from '@ui/compositions/forms/useFormSteps'
import { CreditGrantCreateForm } from '@ui/pages/product-catalog/credit-grants/CreditGrantForm'
import { PriceOverrideForm } from '@ui/pages/product-catalog/charges/PriceOverrideForm'
import type { MeterOption, PriceUnitOption } from '@ui/pages/product-catalog/charges/ChargeForm'
import { RowActionsMenu } from '@ui/pages/shared/RowActionsMenu'
import { DetailTable, type DetailColumn } from '@ui/pages/shared/DetailTable'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'
import { FormDialog } from '@ui/compositions/forms/FormDialog'
import { ContractChargeDialog } from './ContractChargeDialog'
import { addDays, everyPeriod, formatDay, localToday, periodNoun } from './ContractSummary'
import { ChargeCommitmentDialog, commitmentText } from './ChargeCommitmentDialog'
import {
  ChargeCouponDialog,
  type ChargeCouponOption,
  type CouponsStatus,
  couponOptionLabel,
  noCouponsText,
} from './ChargeCouponDialog'
import { provenance } from '@ui/provenance'

/**
 * Create a contract (subscription), in five steps:
 *
 * 1. **Contract**: the customer, then the plan (its billing period and
 *    currency), and the contract's dates: when it starts and ends, the day it
 *    bills on, a free trial, and proration (off unless turned on).
 * 2. **Charges & add-ons**: the plan's charges as a searchable table (price,
 *    quantity, commitment and coupon from each row), the contract's discount
 *    and its add-ons. A contract with more than one phase shows each
 *    phase's charges in its own card instead.
 * 3. **Commitments & benefits**: the contract-wide commitment, then the plan's
 *    entitlements, credit grants and taxes.
 * 4. **Billing**: payment terms, who pays (this customer, another one, and
 *    customers that inherit the contract), and the remaining settings.
 * 5. **Review**: one card per step, each with its Edit.
 *
 * There is no running summary or first-invoice estimate: the API has nothing
 * to estimate one with, so the form does not guess. Save as draft sits in the
 * header on every step.
 *
 * One react-hook-form draft over the domain schema, walked by `useFormSteps`.
 * The toolbar carries the stepper, Save as draft, Previous / Next and, on the
 * last step, Create; the breadcrumb names the page, so the toolbar has no title.
 *
 * The form never fetches: the page hands it the customers and plans to choose
 * from and, once a plan is chosen (reported through `onPlanChange`), that
 * plan's charges and entitlements. `customerLocked` drops the Customer card
 * when the form is opened from a customer's own page. Currency defaults to the
 * customer's own currency when the customer option carries one, else to the
 * plan's when it bills in only one.
 */
export const SubscriptionFormProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/form-page',
    'compositions/form-card',
    'compositions/option-combobox',
    'compositions/date-input',
    'compositions/detail-kit',
    'pages/price-override-form',
    'pages/shared/DetailTable',
    'compositions/form-dialog',
    'ui/dropdown-menu',
    'pages/credit-grant-form',
  ],
  note: 'RHF + the domain schema, five steps with Previous/Next, Save as draft and the stepper in the toolbar (ChoiceCards and SimpleTable from the detail kit); sub-forms (price override, credit grant) sit outside the form element.',
})

export interface SubscriptionPlanContext {
  charges: Charge[]
  entitlements: Entitlement[]
  /** The plan's own credit grants, as drafts; undefined while they load. */
  creditGrants?: CreateCreditGrant[] | undefined
  isLoading: boolean
}

/** A customer to choose from; `currency` (ISO, any case) seeds the contract's currency. */
export interface SubscriptionCustomerOption extends Option {
  currency?: string | undefined
  /** Needed to bill another customer or let one inherit the contract (the API takes external ids). */
  externalId?: string | undefined
  /** The currency their invoices go out in, when it is set; else the contract's own. */
  billingCurrency?: string | undefined
  /** The IANA zone the customer bills in; the contract's dates and times default to it. */
  timezone?: string | undefined
}

/** A global exchange rate, one unit of `fromCurrency` in `toCurrency` (lower-case codes). */
export interface SubscriptionFxRateOption {
  fromCurrency: string
  toCurrency: string
  rate: string
}

/** A coupon to choose from; `discount` ("20%", "$50") and `code` are shown beside its name. */
export interface SubscriptionCouponOption extends ChargeCouponOption {
  code?: string | undefined
}

/** An add-on to start with; `type` ("Fixed and usage") and `price`, when known, fill its row. */
export interface SubscriptionAddonOption extends Option {
  type?: string | undefined
  price?: string | undefined
}

/** A tax rate the contract can carry. */
export interface SubscriptionTaxRateOption {
  code: string
  name: string
  percentage: string
}

export interface SubscriptionFormProps {
  defaultValue?: Partial<CreateSubscription>
  customers: readonly SubscriptionCustomerOption[]
  plans: readonly Option[]
  /** The chosen plan's charges and entitlements; undefined until a plan is chosen. */
  plan: SubscriptionPlanContext | undefined
  onPlanChange: (planId: string) => void
  /** The customer changed: the page loads their tax rates. */
  onCustomerChange?: (customerId: string) => void
  /** Coupons a phase or charge can be discounted with. */
  coupons?: readonly SubscriptionCouponOption[]
  /**
   * Whether the coupon list has arrived. While it loads or after it fails,
   * the pickers say so rather than "No coupons yet".
   */
  couponsStatus?: CouponsStatus
  /** Rates that can be added to the contract. */
  taxRates?: readonly SubscriptionTaxRateOption[]
  /**
   * Where a tax rate is created. Opened in a new tab so the contract being
   * drafted here is not lost; the rate list refreshes when this tab regains focus.
   */
  createTaxRateHref?: string | undefined
  /** The chosen customer's tax associations, applied when the customer is picked (as V1 does). */
  customerTaxes?: CreateSubscription['taxes'] | null
  /** Add-ons the contract can start with. */
  addons?: readonly SubscriptionAddonOption[]
  /**
   * An add-on's charges, so each can be repriced and a usage charge can carry a
   * commitment (as V1's add-on card). Undefined while unknown: loading or failed.
   */
  addonCharges?: ((addonId: string) => readonly Charge[] | undefined) | undefined
  /** The add-ons' charges could not be loaded: the add-on dialog says so instead of "Loading". */
  addonChargesFailed?: boolean | undefined
  /** For charges added to this contract alone: the metered features and price units. */
  meters?: MeterOption[]
  priceUnits?: PriceUnitOption[]
  customerLocked?: boolean
  /**
   * Customers (by id) that cannot inherit this contract, and why: the API
   * refuses a child that has a contract of its own or inherits another one.
   * Loaded for the chosen customer; they are listed but cannot be picked.
   */
  inheritanceBlocks?: Readonly<Record<string, InheritanceBlock>>
  /**
   * The global exchange rates. A contract billed in another currency than the
   * invoicing customer's needs one for the pair (the API refuses it otherwise),
   * and may set its own rate over it. Undefined while unknown: nothing is
   * blocked on it then.
   */
  fxGlobalRates?: readonly SubscriptionFxRateOption[] | undefined
  /**
   * The tenant's custom currencies (lower-case code) and each one's factors to
   * fiat currencies (lower-case code to decimal). Undefined while unknown.
   */
  fxCustomCurrencies?: Readonly<Record<string, Readonly<Record<string, string>>>> | undefined
  /** The custom currency settings failed to load (not merely still loading). */
  fxSettingsFailed?: boolean | undefined
  onSubmit: (subscription: CreateSubscription) => void
  onCancel: () => void
  isSubmitting?: boolean
  submitError?: string | null
  trail: DetailCrumb[]
  step?: string
  onStepChange?: (id: string) => void
  /** Today, as `YYYY-MM-DD`; injectable so stories and tests read the same dates. */
  today?: string
}

const FORM_ID = 'subscription-form'

const NO_BLOCKS: Readonly<Record<string, InheritanceBlock>> = {}

const FALLBACK_CURRENCIES = currencyCodes()

/**
 * Step ids are URL-safe and mirrored by the console's route
 * (`app/subscriptionSteps.ts`). The ids predate the titles: `plan` is
 * "Contract", `phases` is "Charges & add-ons", `commitments` is "Commitments &
 * benefits": and are kept so links already shared still land.
 *
 * Customer and plan are **one** step: the customer decides the currency, the
 * plan decides the billing periods on offer, and picking them a page apart
 * hides that from the person making the choice. The plan card stays hidden
 * until a customer is chosen, so the step opens as one question.
 */
export const SUBSCRIPTION_FORM_STEPS = [
  { id: 'plan', title: 'Contract' },
  { id: 'phases', title: 'Charges & add-ons' },
  { id: 'commitments', title: 'Commitments & benefits' },
  { id: 'billing', title: 'Billing' },
  { id: 'review', title: 'Review' },
] as const

/** The first failed field as "path: message", e.g. "addons.0.startDate: Choose a date". */
function firstFieldError(errors: object, path = ''): string | null {
  for (const [key, value] of Object.entries(errors)) {
    if (!value || typeof value !== 'object' || key === 'ref') continue
    const at = path ? `${path}.${key}` : key
    if ('message' in value && typeof value.message === 'string' && value.message) {
      return `${at}: ${value.message}`
    }
    const nested = firstFieldError(value, at)
    if (nested) return nested
  }
  return null
}

const STEP_FIELDS: Record<string, (keyof CreateSubscription)[]> = {
  plan: [
    'customerId',
    'planId',
    'currency',
    'billingPeriod',
    'billingPeriodCount',
    'startDate',
    'trialPeriodDays',
    'billingAnchor',
    'prorate',
  ],
  phases: ['phases', 'chargeCommitments'],
  commitments: ['commitmentAmount', 'overageFactor'],
  billing: ['autoInvoiceThreshold', 'inheritedCustomerExternalIds', 'fxRates'],
}

const unique = <T,>(values: T[]) => [...new Set(values)]

const WhoPays = { Same: 'same', Another: 'another' } as const
type WhoPays = (typeof WhoPays)[keyof typeof WhoPays]

const CHOOSE_PAYER = 'Choose who pays, or switch back to the same customer.'

/** Why the first of the picked customers cannot inherit, naming it; null when all can. */
function inheritanceBlockedMessage(
  externalIds: readonly string[],
  customers: readonly SubscriptionCustomerOption[],
  blocks: Readonly<Record<string, InheritanceBlock>>,
): string | null {
  for (const externalId of externalIds) {
    const customer = customers.find((c) => c.externalId === externalId)
    const block = customer ? blocks[customer.value] : undefined
    if (!customer || !block) continue
    return block === InheritanceBlock.OwnContract
      ? `${customer.label} has a contract of its own, so it cannot inherit this one. Remove it, or end that contract first.`
      : `${customer.label} already inherits another customer's contract. Remove it from Inherited customers.`
  }
  return null
}

/** The three ways a contract can choose its billing day. */
type BillOn = 'start' | 'calendar' | 'date'

/** Calendar billing in words: "The 1st of every month", "The start of every calendar year". */
function calendarTitle(period: string): string {
  return period === 'MONTHLY'
    ? '1st of every month'
    : `Start of ${everyPeriod(period, 1).replace('every', 'every calendar')}`
}

/** A `YYYY-MM-DD` day at 00:00 local, as an instant: where a new contract starts by default. */
function startOfDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d).toISOString()
}

/** What the calendar billing day is called in a sentence: "the 1st", "the start of the quarter". */
function calendarStart(period: string): string {
  return period === 'MONTHLY'
    ? '1st'
    : `start of the ${everyPeriod(period, 1).replace('every ', '')}`
}

export function SubscriptionForm({
  defaultValue,
  customers,
  plans,
  plan,
  onPlanChange,
  onCustomerChange,
  coupons = [],
  couponsStatus = 'ready',
  taxRates = [],
  createTaxRateHref,
  customerTaxes = null,
  addons = [],
  addonCharges,
  addonChargesFailed = false,
  meters = [],
  priceUnits = [],
  customerLocked = false,
  inheritanceBlocks = NO_BLOCKS,
  fxGlobalRates,
  fxCustomCurrencies,
  fxSettingsFailed = false,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitError = null,
  trail,
  step,
  onStepChange,
  today = localToday(),
}: SubscriptionFormProps) {
  const form = useCalmForm<CreateSubscription>({
    resolver: standardSchemaResolver(createSubscriptionSchema) as Resolver<CreateSubscription>,
    // Starts today at midnight unless the caller says otherwise, as the reference does.
    defaultValues: {
      ...emptySubscription(),
      startDate: startOfDay(today),
      ...defaultValue,
    },
  })
  const errors = form.formState.errors
  const values = form.watch()

  /*
   * Bill on is three choices over two fields: the start date (anniversary),
   * the 1st (calendar), or a date of your choosing (anniversary, anchored on
   * `billingAnchor`). The third is held here because an empty anchor reads the
   * same as "the start date" until a date is picked.
   */
  const [billOn, setBillOn] = useState<BillOn>(() =>
    defaultValue?.billingAnchor
      ? 'date'
      : defaultValue?.billingCycle === BillingCycle.Calendar
        ? 'calendar'
        : 'start',
  )
  const chooseBillOn = (next: BillOn) => {
    setBillOn(next)
    form.setValue(
      'billingCycle',
      next === 'calendar' ? BillingCycle.Calendar : BillingCycle.Anniversary,
      { shouldDirty: true },
    )
    // Leaving the custom date drops it, so nothing anchors on a hidden value.
    if (next !== 'date') {
      form.setValue('billingAnchor', '', { shouldDirty: true })
      form.clearErrors('billingAnchor')
    }
  }

  // Who pays is a choice before it is a value: "another customer" with none
  // picked yet is still the same customer to the API, so it is held here.
  const [whoPays, setWhoPays] = useState<WhoPays>(
    defaultValue?.invoicingCustomerExternalId ? WhoPays.Another : WhoPays.Same,
  )
  const payerMissing = () =>
    whoPays === WhoPays.Another && !form.getValues('invoicingCustomerExternalId')
  // Invoices go out in the invoicing customer's billing currency. When it is
  // not the contract's, the API converts at the global rate for the pair
  // (refusing the contract without one) or at a rate the contract sets itself.
  const payer = values.invoicingCustomerExternalId
    ? customers.find((c) => c.externalId === values.invoicingCustomerExternalId)
    : customers.find((c) => c.value === values.customerId)
  const billingCurrency = (payer?.billingCurrency ?? '').trim().toLowerCase()
  const contractCurrency = values.currency.trim().toLowerCase()
  const fxNeeded = Boolean(
    billingCurrency && contractCurrency && billingCurrency !== contractCurrency,
  )
  // As the API's `conversionAvailable`: a custom currency converts at its own
  // factor (and takes no contract rate: the API refuses fx_rates for it), any
  // other at the global rate for the pair. Only a loaded custom currency config
  // says which a pair is, so only then does a missing conversion block. Until
  // then nothing blocks; if they failed to load, an ISO pair with no global
  // rate is a warning (none while still loading), and the API stays the final check.
  const configKnown = fxCustomCurrencies !== undefined
  const customFactors = fxCustomCurrencies?.[contractCurrency]
  const customFactor = fxNeeded && customFactors ? customFactors[billingCurrency] : undefined
  const fxCustom = fxNeeded && customFactors !== undefined
  const fxOverridable = fxNeeded && !fxCustom
  const globalRate = fxOverridable
    ? fxGlobalRates?.find(
        (r) => r.fromCurrency === contractCurrency && r.toCurrency === billingCurrency,
      )
    : undefined
  const noGlobalRate = fxOverridable && fxGlobalRates !== undefined && !globalRate
  const fxMissing = configKnown && (fxCustom ? !(Number(customFactor ?? 0) > 0) : noGlobalRate)
  const fxUnsure =
    !configKnown &&
    fxSettingsFailed &&
    noGlobalRate &&
    isoCurrency(contractCurrency) &&
    isoCurrency(billingCurrency)
  const pair = `${contractCurrency.toUpperCase()} → ${billingCurrency.toUpperCase()}`
  const fxMissingMessage = fxCustom
    ? `No conversion factor for ${pair}. Set ${contractCurrency.toUpperCase()}'s factor for ${billingCurrency.toUpperCase()} in the custom currency settings first.`
    : `No exchange rate for ${pair}. Add a global rate in Settings › Currency first: the API needs one even when the contract sets its own.`
  // A rate entered while the currencies differed means nothing once they match,
  // and a half-typed one would otherwise fail validation from a hidden card.
  useEffect(() => {
    if (!fxOverridable && form.getValues('fxRates').length > 0) {
      form.setValue('fxRates', [])
      form.clearErrors('fxRates')
    }
  }, [fxOverridable, form])
  /** Flags a contract the API would refuse for want of a rate; true when it was flagged. */
  const fxBlocked = () => {
    if (fxMissing) form.setError('fxRates', { type: 'validate', message: fxMissingMessage })
    else if (form.getFieldState('fxRates').error?.type === 'validate') form.clearErrors('fxRates')
    return fxMissing
  }
  /** Flags a picked customer the API would refuse to let inherit; true when one was flagged. */
  const inheritanceBlocked = () => {
    const message = inheritanceBlockedMessage(
      form.getValues('inheritedCustomerExternalIds'),
      customers,
      inheritanceBlocks,
    )
    if (message) form.setError('inheritedCustomerExternalIds', { type: 'validate', message })
    return message !== null
  }

  // The contract's end is its last phase's end: one field, wherever it is edited.
  const lastPhase = values.phases.length - 1
  const endPath = `phases.${lastPhase}.endDate` as const

  const flow = useFormSteps({
    steps: SUBSCRIPTION_FORM_STEPS,
    step,
    onStepChange,
    validate: async (id) => {
      const fields: string[] = [...(STEP_FIELDS[id] ?? [])]
      if (id === 'plan') fields.push(endPath)
      const valid = fields.length > 0 ? await form.trigger(fields as never) : true
      // Choosing "a date" means choosing one.
      if (id === 'plan' && billOn === 'date' && !form.getValues('billingAnchor')) {
        form.setError('billingAnchor', { type: 'required', message: 'Choose the billing date' })
        return false
      }
      if (id === 'billing' && payerMissing()) {
        form.setError('invoicingCustomerExternalId', { type: 'required', message: CHOOSE_PAYER })
        return false
      }
      if (id === 'billing' && valid && inheritanceBlocked()) return false
      if (id === 'billing' && valid && fxBlocked()) return false
      return valid
    },
  })

  // A picker has no blur to mark it touched, so a value it sets is validated
  // here: an earlier "Choose a plan" error clears the moment a plan is chosen.
  const pick = (name: 'customerId' | 'planId' | 'currency' | 'billingPeriod', value: string) => {
    form.setValue(name, value as never, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })
    if (name === 'customerId') onCustomerChange?.(value)
    // Entitlement changes name the old plan's entitlements: another plan starts without them.
    if (name === 'planId' && value !== values.planId) form.setValue('entitlementOverrides', [])
  }

  // V1 starts a contract with the chosen customer's tax rates; once per customer.
  const [taxesFor, setTaxesFor] = useState<string | null>(null)
  useEffect(() => {
    if (!values.customerId || !customerTaxes || taxesFor === values.customerId) return
    form.setValue('taxes', [...customerTaxes], { shouldDirty: true })
    setTaxesFor(values.customerId)
  }, [values.customerId, customerTaxes, taxesFor, form])

  // A contract starts with its plan's credit grants, once per plan.
  const [grantsFor, setGrantsFor] = useState<string | null>(null)
  useEffect(() => {
    if (!values.planId || !plan?.creditGrants || grantsFor === values.planId) return
    form.setValue('creditGrants', [...plan.creditGrants])
    form.setValue('creditGrantsChanged', false)
    setGrantsFor(values.planId)
  }, [values.planId, plan?.creditGrants, grantsFor, form])

  // A plan's free trial (on its recurring fixed charges) fills in the
  // contract's, once per plan; a trial the draft opened with is kept.
  const planTrial = useMemo(
    () => Math.max(0, ...(plan?.charges ?? []).map((charge) => charge.trialPeriodDays ?? 0)),
    [plan],
  )
  const [trialFor, setTrialFor] = useState<string | null>(() =>
    defaultValue?.trialPeriodDays !== undefined ? (defaultValue.planId ?? null) : null,
  )
  useEffect(() => {
    if (!values.planId || !plan || plan.isLoading || trialFor === values.planId) return
    setTrialFor(values.planId)
    if (planTrial > 0) form.setValue('trialPeriodDays', planTrial, { shouldDirty: true })
  }, [values.planId, plan, planTrial, trialFor, form])

  const starts = phaseStarts(values)
  const set = <K extends keyof CreateSubscription>(name: K, value: CreateSubscription[K]) =>
    form.setValue(name, value as never, { shouldDirty: true })

  useEffect(() => {
    if (values.planId) onPlanChange(values.planId)
  }, [values.planId, onPlanChange])

  const customer = customers.find((c) => c.value === values.customerId)
  const customerCurrency = customer?.currency?.trim().toUpperCase() || undefined

  const currencyOptions = useMemo<Option[]>(() => {
    const fromCharges = unique(
      (plan?.charges ?? []).map((c) => c.currency.toUpperCase()).filter(Boolean),
    )
    const codes = fromCharges.length > 0 ? fromCharges : FALLBACK_CURRENCIES
    return codes.map((code) => ({ value: code, label: code }))
  }, [plan])
  const periodOptions = useMemo<Option[]>(() => {
    const fromCharges = unique((plan?.charges ?? []).map((c) => c.billingPeriod as string)).filter(
      (p) => (SUBSCRIPTION_BILLING_PERIODS as readonly string[]).includes(p),
    )
    const periods = fromCharges.length > 0 ? fromCharges : [...SUBSCRIPTION_BILLING_PERIODS]
    return periods.map((p) => ({
      value: p,
      label: BILLING_PERIOD_LABEL[p as keyof typeof BILLING_PERIOD_LABEL],
    }))
  }, [plan])

  // Currency follows the customer when they have one the plan bills in, else
  // the plan when it bills in only one. A choice the person made that is still
  // valid is left alone.
  useEffect(() => {
    const codes = currencyOptions.map((o) => o.value)
    const preferred =
      customerCurrency && codes.includes(customerCurrency)
        ? customerCurrency
        : codes.length === 1
          ? codes[0]
          : undefined
    if (preferred && (!values.currency || !codes.includes(values.currency))) {
      form.setValue('currency', preferred, { shouldValidate: Boolean(values.currency) })
    }
  }, [currencyOptions, customerCurrency, values.currency, form])

  // True-up bills a shortfall against the commitment, so it goes off when the
  // commitment does: a new amount later starts with it off, not the old choice.
  const committed = hasCommitment(values.commitmentAmount)
  useEffect(() => {
    if (!committed && values.enableTrueUp) form.setValue('enableTrueUp', false)
  }, [committed, values.enableTrueUp, form])

  // A plan that bills on one cadence has nothing to choose.
  useEffect(() => {
    if (periodOptions.length > 0 && !periodOptions.some((o) => o.value === values.billingPeriod)) {
      form.setValue('billingPeriod', periodOptions[0]!.value as CreateSubscription['billingPeriod'])
    }
  }, [periodOptions, values.billingPeriod, form])

  /*
   * The charges this contract will bill, by the API's own rule: in the
   * contract's currency, one-time or on its billing period: plus any charge at
   * another cadence that fits and was opted into. Everything the form shows as
   * billable comes from this, so it never lists a charge the API would drop.
   */
  const selection = useMemo(
    () =>
      selectContractCharges(plan?.charges ?? [], {
        currency: values.currency,
        billingPeriod: values.billingPeriod,
        billingPeriodCount: values.billingPeriodCount,
        optedInIds: values.optedInChargeIds,
      }),
    [
      plan,
      values.currency,
      values.billingPeriod,
      values.billingPeriodCount,
      values.optedInChargeIds,
    ],
  )
  const charges = selection.attached
  // Fixed charges bill every period, so an early invoice on usage does not apply.
  const hasFixedCharges =
    charges.some((charge) => charge.type === PriceType.Fixed) ||
    values.phases.some((phase) =>
      phase.extraCharges.some((extra) => extra.charge.type === PriceType.Fixed),
    )

  /**
   * What is sent: settings on charges this contract will not bill are dropped
   * (they would be refused, or silently ignored), and `include_price_ids` is the
   * selection's own.
   */
  const toSubmit = (draft: CreateSubscription): CreateSubscription => {
    const billed = new Set(selection.attached.map((charge) => charge.id))
    return {
      ...draft,
      phases: draft.phases.map((phase) => ({
        ...phase,
        priceOverrides: phase.priceOverrides.filter((o) => billed.has(o.priceId)),
        quantities: phase.quantities.filter((q) => billed.has(q.priceId)),
        discounts: phase.discounts.filter((d) => !d.priceId || billed.has(d.priceId)),
      })),
      chargeCommitments: draft.chargeCommitments.filter((c) => billed.has(c.priceId)),
      // Only changes to this plan's entitlements: the API refuses any other id.
      entitlementOverrides:
        plan && !plan.isLoading
          ? draft.entitlementOverrides.filter((o) =>
              plan.entitlements.some((e) => e.id === o.entitlementId),
            )
          : draft.entitlementOverrides,
      // An add-on override or commitment on a price this currency and period do
      // not attach would be refused: it was set before either changed, and is hidden now.
      addons: draft.addons.map((addon) =>
        withAddonPricing(addon, {
          priceOverrides: attachableAddonOverrides(
            addon.priceOverrides ?? [],
            addonCharges?.(addon.addonId),
            draft,
          ),
          commitments: attachableAddonCommitments(
            addon.commitments ?? [],
            addonCharges?.(addon.addonId),
            draft,
          ),
        }),
      ),
      optedInChargeIds: draft.optedInChargeIds.filter((id) => billed.has(id)),
      // Only when invoices are converted, and only a rate that was set: the API
      // refuses fx_rates on a contract billed in the customer's own currency.
      fxRates: fxOverridable ? draft.fxRates.filter((fx) => fx.rate) : [],
      includePriceIds: selection.includePriceIds,
      // Not offered with fixed charges; a value typed before they were added is not sent.
      ...(hasFixedCharges ? { autoInvoiceThreshold: '' } : {}),
    }
  }

  /** The step a failed field is asked on; the contract's end is asked on the first. */
  const stepOf = (failed: FieldErrors<CreateSubscription>) => {
    if (failed.phases?.[lastPhase]?.endDate && values.phases.length === 1) return 'plan'
    return flow.steps.find((s) => STEP_FIELDS[s.id]?.some((field) => failed[field] !== undefined))
      ?.id
  }
  /**
   * What the API will refuse about this contract's status, said before the
   * request rather than after it. Charges added here are attached as line
   * items, which the API takes only on an active contract: not on a draft, and
   * not on a contract with a free trial (it starts trialing). Add-ons are
   * refused while trialing too.
   */
  const statusConflict = (draft: CreateSubscription): string | null => {
    const added = draft.phases.some((phase) => phase.extraCharges.length > 0)
    const trial = (draft.trialPeriodDays ?? 0) > 0
    if (added && draft.draft) {
      return 'A draft contract cannot take the charges added here. Create it instead, or remove those charges and add them once it is active.'
    }
    if (added && trial) {
      return 'A contract with a free trial starts as trialing, and the charges added here need an active one. Remove the trial or those charges, or add them after the trial.'
    }
    if (draft.addons.length > 0 && trial && !draft.draft) {
      return 'A contract with a free trial starts as trialing, and add-ons cannot be attached then. Remove the trial or the add-ons, or add them after the trial.'
    }
    return null
  }
  const [conflict, setConflict] = useState<string | null>(null)
  // Any change may resolve it, and a stale one would hide the API's own error:
  // it is cleared on the next edit and checked again on the next submit.
  useEffect(() => {
    const subscription = form.watch(() => setConflict(null))
    return () => subscription.unsubscribe()
  }, [form])

  const submitWith = (patch: Partial<CreateSubscription>) =>
    form.handleSubmit(
      (draft) => {
        const blocked = statusConflict({ ...draft, ...patch })
        setConflict(blocked)
        if (blocked) return
        if (payerMissing()) {
          form.setError('invoicingCustomerExternalId', { type: 'required', message: CHOOSE_PAYER })
          flow.goTo('billing')
          return
        }
        if (inheritanceBlocked()) {
          flow.goTo('billing')
          return
        }
        if (fxBlocked()) {
          flow.goTo('billing')
          return
        }
        onSubmit(toSubmit({ ...draft, ...patch }))
      },
      (failed) => {
        const bad = stepOf(failed)
        if (bad) {
          flow.goTo(bad)
          return
        }
        // A field no step asks for (add-ons, taxes, opted-in charges…) would otherwise fail silently.
        setConflict(firstFieldError(failed) ?? 'Some details are not valid. Review each step.')
      },
    )
  const submitAll = submitWith({})
  // Save as draft: the same contract, created to activate later.
  const saveDraft = () => void submitWith({ draft: true })()

  const planLabel = plans.find((p) => p.value === values.planId)?.label
  const trialDays = values.trialPeriodDays ?? 0

  const customerStep = (
    <FormCard
      title="Customer"
      status="required"
      icon={<UserIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />}
    >
      <FormRow
        label="Customer"
        hint="Who the contract bills."
        required
        error={errors.customerId?.message}
      >
        {({ id, ...field }) => (
          <Controller
            control={form.control}
            name="customerId"
            render={({ field: control }) => (
              <OptionCombobox
                id={id}
                {...field}
                value={control.value}
                onValueChange={(value) => pick('customerId', value)}
                options={customers}
                placeholder="Search customers…"
                disabled={isSubmitting}
              />
            )}
          />
        )}
      </FormRow>
    </FormCard>
  )

  const planCard = (
    <FormCard
      title="Plan"
      status="required"
      icon={<LayersIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />}
    >
      <FormRow
        label="Plan"
        hint="Fills in the billing period, currency and free trial, and copies its charges, entitlements and credit grants onto the contract."
        required
        error={errors.planId?.message}
      >
        {({ id, ...field }) => (
          <Controller
            control={form.control}
            name="planId"
            render={({ field: control }) => (
              <OptionCombobox
                id={id}
                {...field}
                value={control.value}
                onValueChange={(value) => pick('planId', value)}
                options={plans}
                placeholder="Search plans…"
                disabled={isSubmitting}
              />
            )}
          />
        )}
      </FormRow>
      {values.planId ? (
        <>
          <FormRow
            label="Billing period"
            hint="How often the contract is invoiced. From the plan."
            required
            error={errors.billingPeriod?.message}
          >
            {({ id, ...field }) => (
              <Controller
                control={form.control}
                name="billingPeriod"
                render={({ field: control }) => (
                  <OptionSelect
                    id={id}
                    {...field}
                    value={control.value}
                    onValueChange={(value) => pick('billingPeriod', value)}
                    options={periodOptions}
                    disabled={isSubmitting}
                  />
                )}
              />
            )}
          </FormRow>
          <FormRow
            label="Currency"
            required
            hint="From the plan's prices."
            error={errors.currency?.message}
          >
            {({ id, ...field }) => (
              <Controller
                control={form.control}
                name="currency"
                render={({ field: control }) => (
                  <OptionSelect
                    id={id}
                    {...field}
                    value={control.value}
                    onValueChange={(value) => pick('currency', value)}
                    options={currencyOptions}
                    placeholder="Choose a currency"
                    disabled={isSubmitting}
                  />
                )}
              />
            )}
          </FormRow>
        </>
      ) : null}
    </FormCard>
  )

  const endError = errors.phases?.[lastPhase]?.endDate?.message
  const contractEnd = values.phases[lastPhase]?.endDate ?? ''
  const setEnd = (value: string) =>
    form.setValue(endPath, value, { shouldDirty: true, shouldValidate: true })
  const datesCard = (
    <FormCard
      title="Dates and billing"
      icon={<CalendarIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />}
    >
      <FormRow
        label="Starts"
        hint="When the contract starts. Today unless you pick another day."
        required
        error={errors.startDate?.message}
      >
        {({ id, ...field }) => (
          <DateInput
            id={id}
            {...field}
            withTime
            timeZone={customer?.timezone}
            value={values.startDate}
            onValueChange={(value) =>
              form.setValue('startDate', value, { shouldDirty: true, shouldValidate: true })
            }
            placeholder="Pick the start"
            min={addDays(today, -90)}
            disabled={isSubmitting}
          />
        )}
      </FormRow>
      <FormRow label="Ends" hint="Leave empty to run until cancelled." error={endError}>
        {({ id, ...field }) => (
          <DateInput
            id={id}
            {...field}
            withTime
            timeZone={customer?.timezone}
            clearable
            clearLabel="Clear end date"
            value={contractEnd}
            onValueChange={setEnd}
            placeholder="Runs until cancelled"
            min={addDays(contractDay(values.startDate || today), 1)}
            disabled={isSubmitting}
          />
        )}
      </FormRow>
      <FormRow
        label="Bill on"
        hint="The day each invoice falls on: the contract's own start date, the 1st of each month, or a date you choose."
        align="start"
      >
        <div className="flex flex-col gap-3">
          <ChoiceCards<BillOn>
            label="Bill on"
            stacked
            value={billOn}
            onChange={chooseBillOn}
            choices={[
              {
                value: 'start',
                title: 'Contract start date',
                description: `The same day ${everyPeriod(values.billingPeriod, 1).replace('every', 'each')} as the start.`,
              },
              {
                value: 'calendar',
                title: calendarTitle(values.billingPeriod),
                description: `The first invoice is prorated up to the ${calendarStart(values.billingPeriod)}.`,
              },
              {
                value: 'date',
                title: 'Custom date',
                description: 'Billing starts on the date you pick below.',
              },
            ]}
          />
          {billOn === 'date' ? (
            <Controller
              control={form.control}
              name="billingAnchor"
              render={({ field: control }) => (
                <div>
                  <label htmlFor="contract-billing-date" className="sr-only">
                    Billing date
                  </label>
                  <DateInput
                    id="contract-billing-date"
                    withTime
                    timeZone={customer?.timezone}
                    min={contractDay(values.startDate || today)}
                    value={control.value}
                    onValueChange={(value) => {
                      form.setValue('billingAnchor', value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }}
                    placeholder="Pick the billing date"
                    {...(errors.billingAnchor ? { 'aria-invalid': true as const } : {})}
                    disabled={isSubmitting}
                    aria-describedby={
                      errors.billingAnchor ? 'contract-billing-date-error' : undefined
                    }
                  />
                  {/* On the picker, not the row: a row error would redden all three cards. */}
                  {errors.billingAnchor?.message ? (
                    <p
                      id="contract-billing-date-error"
                      role="alert"
                      className="text-destructive mt-1.5 text-xs"
                    >
                      {errors.billingAnchor.message}
                    </p>
                  ) : null}
                </div>
              )}
            />
          ) : null}
        </div>
      </FormRow>
      <FormRow
        label="Free trial"
        hint="From the plan. Billing starts after the trial; clear it for no trial."
        error={errors.trialPeriodDays?.message}
        align="start"
      >
        {({ id, ...field }) => (
          <div className="flex flex-col gap-1.5">
            <InputGroup className="h-9">
              <InputGroupInput
                id={id}
                type="number"
                min={0}
                placeholder="No trial"
                disabled={isSubmitting}
                {...field}
                {...form.register('trialPeriodDays', {
                  setValueAs: (raw) => (raw === '' || raw == null ? undefined : Number(raw)),
                })}
              />
              <InputGroupAddon align="inline-end">days</InputGroupAddon>
            </InputGroup>
            {trialDays > 0 && billOn !== 'date' ? (
              <p className="text-muted-foreground text-xs">
                The trial ends and billing starts on{' '}
                {formatDay(addDays(contractDay(values.startDate || today), trialDays))}.
              </p>
            ) : null}
          </div>
        )}
      </FormRow>
      {/* A billing term, so it sits with the dates; off until someone turns it on. */}
      <FormRow
        label="Proration"
        hint="Charge or credit the part of a period a mid-cycle change falls in."
        error={errors.prorate?.message}
      >
        {({ id }) => (
          <Switch
            id={id}
            checked={values.prorate}
            onCheckedChange={(next) => set('prorate', next)}
            disabled={isSubmitting}
          />
        )}
      </FormRow>
    </FormCard>
  )

  const noPlan = (what: string) => (
    <EmptyState
      size="inline"
      title="No plan chosen yet"
      description={`${what} come from the plan. Go back and choose one.`}
    />
  )

  const formEl = (children: ReactNode) => (
    <form
      id={FORM_ID}
      onSubmit={flow.guardSubmit(submitAll)}
      noValidate
      className="flex flex-col gap-5"
    >
      {children}
    </form>
  )

  const hasCustomer = customerLocked || Boolean(values.customerId)

  const content: Record<string, ReactNode> = {
    // One form element around the cards: they are one step, and a second
    // <form> would break Enter-to-advance and the toolbar's submit.
    plan: formEl(
      <>
        {customerLocked ? null : customerStep}
        {hasCustomer ? planCard : null}
        {hasCustomer && values.planId ? datesCard : null}
      </>,
    ),
    phases: values.planId ? (
      <div className="flex flex-col gap-5">
        <OtherCadences
          selection={selection}
          optedIn={values.optedInChargeIds}
          onChange={(next) => set('optedInChargeIds', next)}
        />
        <PhasesStep
          phases={values.phases}
          starts={starts}
          startDate={values.startDate}
          onStartDate={(value) =>
            form.setValue('startDate', value, { shouldDirty: true, shouldValidate: true })
          }
          startError={errors.startDate?.message}
          today={today}
          charges={charges}
          isLoading={plan?.isLoading ?? true}
          coupons={coupons}
          errors={errors.phases}
          onChange={(next) => set('phases', next)}
          commitments={values.chargeCommitments}
          onCommitments={(next) => set('chargeCommitments', next)}
          currency={values.currency}
          billingPeriod={values.billingPeriod}
          meters={meters}
          priceUnits={priceUnits}
          planLabel={planLabel}
        />
        <AddonsSection
          selected={values.addons}
          options={addons}
          onChange={(next) => set('addons', next)}
          chargesOf={addonCharges}
          chargesFailed={addonChargesFailed}
          currency={values.currency}
          billingPeriod={values.billingPeriod}
          meters={meters}
        />
      </div>
    ) : (
      noPlan('Charges')
    ),
    commitments: (
      <div className="flex flex-col gap-5">
        <CommitmentsSection
          values={values}
          errors={errors}
          register={form.register}
          onDuration={(value) => set('commitmentDuration', value)}
          onTrueUp={(value) => set('enableTrueUp', value)}
        />
        {values.planId ? (
          <EntitlementsSection
            planLabel={planLabel}
            entitlements={plan?.entitlements ?? []}
            isLoading={plan?.isLoading ?? true}
            overrides={values.entitlementOverrides}
            onChange={(next) => set('entitlementOverrides', next)}
          />
        ) : (
          noPlan('Entitlements')
        )}
        <CreditsSection
          grants={values.creditGrants}
          changed={values.creditGrantsChanged}
          fromPlan={(plan?.creditGrants?.length ?? 0) > 0}
          onChange={(next) => {
            form.setValue('creditGrants', next, { shouldDirty: true })
            form.setValue('creditGrantsChanged', true)
          }}
          onReset={() => {
            form.setValue('creditGrants', [...(plan?.creditGrants ?? [])])
            form.setValue('creditGrantsChanged', false)
          }}
        />
        <TaxesSection
          taxes={values.taxes}
          taxRates={taxRates}
          createTaxRateHref={createTaxRateHref}
          onChange={(next) => set('taxes', next)}
        />
      </div>
    ),
    billing: formEl(
      <BillingStep
        values={values}
        errors={errors}
        register={form.register}
        isSubmitting={isSubmitting}
        customers={customers}
        inheritanceBlocks={inheritanceBlocks}
        onChange={(name, value) => {
          set(name, value)
          if (name === 'invoicingCustomerExternalId' || name === 'inheritedCustomerExternalIds')
            form.clearErrors(name)
        }}
        whoPays={whoPays}
        onWhoPays={(next) => {
          setWhoPays(next)
          form.clearErrors(['invoicingCustomerExternalId', 'inheritedCustomerExternalIds'])
        }}
        hasFixedCharges={hasFixedCharges}
        fx={
          fxNeeded
            ? {
                from: contractCurrency,
                to: billingCurrency,
                globalRate: globalRate?.rate,
                customFactor: fxCustom ? (customFactor ?? '') : undefined,
                missing: fxMissing,
                warning: fxUnsure
                  ? `Could not load currency settings. If ${contractCurrency.toUpperCase()} → ${billingCurrency.toUpperCase()} has no global rate, the API will refuse this contract.`
                  : undefined,
              }
            : undefined
        }
      />,
    ),
    review: formEl(
      <ReviewStep
        values={values}
        customerLabel={
          customer ? [customer.label, customer.hint].filter(Boolean).join(' · ') : undefined
        }
        planLabel={planLabel}
        charges={charges}
        entitlements={plan?.entitlements ?? []}
        coupons={coupons}
        addons={addons}
        // As submitted: an override on a price the contract no longer takes is not sent.
        repricedOf={(addon) =>
          attachableAddonOverrides(
            addon.priceOverrides ?? [],
            addonCharges?.(addon.addonId),
            values,
          ).length
        }
        customers={customers}
        showCustomer={!customerLocked}
        today={today}
        onEdit={flow.goTo}
        whoPays={whoPays}
        hasFixedCharges={hasFixedCharges}
      />,
    ),
  }

  return (
    <FormPage
      title="Create contract"
      trail={trail}
      toolbar={{
        mode: 'create',
        noun: 'contract',
        formId: FORM_ID,
        onCancel,
        isSubmitting,
        submitError: conflict ?? submitError,
        actions: (
          <Button type="button" variant="outline" onClick={saveDraft} disabled={isSubmitting}>
            Save as draft
          </Button>
        ),
      }}
      stepper={{ flow, label: 'Contract steps' }}
      // The charges table needs the room; every other step keeps the narrow measure.
      width={flow.step === 'phases' ? 'medium' : 'narrow'}
    >
      <CouponsStatusContext.Provider value={couponsStatus}>
        {content[flow.step]}
      </CouponsStatusContext.Provider>
    </FormPage>
  )
}

/**
 * The coupon list's status, for the pickers deep in the phases step; a
 * context rather than a prop through every step between.
 */
const CouponsStatusContext = createContext<CouponsStatus>('ready')

/* ------------------------------------------------------------------------- */
/* Pricing text                                                              */
/* ------------------------------------------------------------------------- */

function money(amount: string | undefined, currency: string): string {
  const raw = (amount ?? '').trim()
  if (!raw) return '—'
  const code = currency.trim().toUpperCase()
  const value = Number(raw)
  if (!Number.isFinite(value) || !/^[A-Z]{3}$/.test(code)) return `${raw} ${code}`.trim()
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currencyDisplay: 'narrowSymbol',
      currency: code,
      maximumFractionDigits: 8,
    }).format(value)
  } catch {
    return `${raw} ${code}`
  }
}

function tierLines(tiers: readonly PriceTier[], currency: string): string[] {
  let from = 0
  return tiers.map((tier) => {
    const band =
      tier.upTo == null
        ? from > 0
          ? `Above ${from.toLocaleString('en-US')}`
          : 'Any quantity'
        : `${from > 0 ? `${(from + 1).toLocaleString('en-US')}–` : 'Up to '}${tier.upTo.toLocaleString('en-US')}`
    if (tier.upTo != null) from = tier.upTo
    const flat = tier.flatAmount?.trim() ? ` + ${money(tier.flatAmount, currency)} flat` : ''
    const unit = tier.transformQuantity?.divideBy ? tierUnitLabel(tier) : '/ unit'
    return `${band}: ${money(tier.unitAmount, currency)} ${unit}${flat}`
  })
}

const TIER_MODE_SHORT: Record<string, string> = {
  [TierMode.Volume]: 'volume',
  [TierMode.Slab]: 'slab',
}

export interface ChargePricing {
  /** One line: model and amount, e.g. "Tiered (volume) · 3 tiers". */
  summary: string
  /** The tier bands, when the pricing is tiered. */
  tiers: string[]
  overridden: boolean
}

/**
 * How a charge will bill on this contract. An override wins: its own model,
 * amount or tiers, never the plan's `displayAmount`.
 */
export function chargePricing(charge: Charge, override: PriceOverride | undefined): ChargePricing {
  const currency = charge.currency
  if (override) {
    switch (override.billingModel) {
      case BillingModel.FlatFee:
        return {
          summary: `${BILLING_MODEL_LABEL[BillingModel.FlatFee]} · ${money(override.amount, currency)}`,
          tiers: [],
          overridden: true,
        }
      case BillingModel.Package:
        return {
          summary: `${BILLING_MODEL_LABEL[BillingModel.Package]} · ${money(override.amount, currency)} per ${override.divideBy.toLocaleString('en-US')} units`,
          tiers: [],
          overridden: true,
        }
      case BillingModel.Tiered:
        return {
          summary: `${BILLING_MODEL_LABEL[BillingModel.Tiered]} (${TIER_MODE_SHORT[override.tierMode] ?? override.tierMode}) · ${override.tiers.length} ${override.tiers.length === 1 ? 'tier' : 'tiers'}`,
          tiers: tierLines(override.tiers, currency),
          overridden: true,
        }
    }
  }
  if (charge.billingModel === BillingModel.Tiered && charge.tiers.length > 0) {
    const mode = charge.tierMode ? ` (${TIER_MODE_SHORT[charge.tierMode] ?? charge.tierMode})` : ''
    return {
      summary: `${BILLING_MODEL_LABEL[BillingModel.Tiered]}${mode} · ${charge.tiers.length} ${charge.tiers.length === 1 ? 'tier' : 'tiers'}`,
      tiers: tierLines(charge.tiers, currency),
      overridden: false,
    }
  }
  const amount = charge.displayAmount || money(charge.amount, currency)
  const model = BILLING_MODEL_LABEL[charge.billingModel] ?? ''
  const pack =
    charge.billingModel === BillingModel.Package && charge.transformQuantity
      ? ` per ${charge.transformQuantity.divideBy.toLocaleString('en-US')} units`
      : ''
  return { summary: `${model ? `${model} · ` : ''}${amount}${pack}`, tiers: [], overridden: false }
}

function chargeName(charge: Charge): string {
  return charge.displayName || charge.description || charge.meterName || charge.id
}

/* ------------------------------------------------------------------------- */
/* Sections                                                                  */
/* ------------------------------------------------------------------------- */

function PricingText({ pricing, period }: { pricing: ChargePricing; period?: string }) {
  return (
    <span className="text-muted-foreground flex flex-col text-xs">
      <span>
        {pricing.summary}
        {period ? ` · ${period}` : ''}
      </span>
      {pricing.tiers.length > 0 ? (
        <ul className="mt-1 flex flex-col gap-0.5 tabular-nums">
          {pricing.tiers.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </span>
  )
}

/** A close (X) for an in-place sub-form: the sub-forms draw no Cancel of their own. */
function CloseSubForm({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon-sm" aria-label={label} onClick={onClick}>
      <XIcon aria-hidden />
    </Button>
  )
}

/**
 * Charges the contract does not bill by default: those at another cadence that
 * fits (which can be opted in, as V1's "additional plan prices"), and those it
 * cannot bill at all: said plainly, so nothing looks billable that is not.
 */
function OtherCadences({
  selection,
  optedIn,
  onChange,
}: {
  selection: ContractChargeSelection
  optedIn: string[]
  onChange: (next: string[]) => void
}) {
  const optedInCharges = selection.attached.filter((charge) => optedIn.includes(charge.id))
  const offered = [...optedInCharges, ...selection.optional]
  if (offered.length === 0 && selection.excluded.length === 0) return null
  const why = (reason: 'currency' | 'cadence') =>
    reason === 'currency' ? 'another currency' : "a cadence this contract can't bill"
  return (
    <FormCard title="Charges at other cadences" status="optional">
      {offered.length > 0 ? (
        <ul className="divide-y">
          {offered.map((charge) => {
            const on = optedIn.includes(charge.id)
            const name = chargeName(charge)
            return (
              <li
                key={charge.id}
                className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium">{name}</span>
                  <PricingText
                    pricing={chargePricing(charge, undefined)}
                    period={BILLING_PERIOD_LABEL[charge.billingPeriod]}
                  />
                </div>
                <Switch
                  aria-label={`Also bill ${name}`}
                  checked={on}
                  onCheckedChange={(next) =>
                    onChange(
                      next ? [...optedIn, charge.id] : optedIn.filter((id) => id !== charge.id),
                    )
                  }
                />
              </li>
            )
          })}
        </ul>
      ) : null}
      {selection.excluded.length > 0 ? (
        <div className="text-muted-foreground border-t px-5 py-3 text-xs sm:px-6">
          Not billed on this contract:{' '}
          {selection.excluded
            .map(({ charge, reason }) => `${chargeName(charge)} (${why(reason)})`)
            .join(', ')}
          .
        </div>
      ) : null}
    </FormCard>
  )
}

/* ------------------------------------------------------------------------- */
/* Shared pieces                                                             */
/* ------------------------------------------------------------------------- */

/** A titled block inside a card: heading, a muted line, and an action on the right. */
function SubSection({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-sm font-medium">{title}</h3>
          {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

/** The bordered frame a table or an empty list sits in, inside a card. */
function Frame({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      {children}
      {footer ? <div className="border-t px-4 py-2">{footer}</div> : null}
    </div>
  )
}

/**
 * The muted, centred line an empty list shows. A create action never goes
 * here: it stays at the top right of the section, empty or not (`AddButton`).
 * `action` is for guidance only, such as where to create what the list needs.
 */
function EmptyLine({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
      <p className="text-muted-foreground text-sm">{children}</p>
      {action}
    </div>
  )
}

/**
 * "+ Add …", the section's create action: top right, on the line of the
 * section title, in the same place whether the list is empty or not.
 */
function AddButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: string
  onClick: () => void
  disabled?: boolean
  label?: string
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      <PlusIcon data-icon="inline-start" aria-hidden />
      {children}
    </Button>
  )
}

/** A charge's kind and model, e.g. "Fixed · Flat fee" or "Usage · Volume tiered". */
function chargeKind(charge: Charge): string {
  const kind = charge.type === PriceType.Usage ? 'Usage' : 'Fixed'
  if (charge.billingModel === BillingModel.Tiered) {
    const mode = charge.tierMode === TierMode.Slab ? 'Slab' : 'Volume'
    return `${kind} · ${mode} tiered`
  }
  return `${kind} · ${BILLING_MODEL_LABEL[charge.billingModel] ?? charge.billingModel}`
}

/** The price cell: the amount, or the tiers in brief. An override wins. */
/**
 * What a new commitment window's price starts from: the rate the charge bills
 * at, an override's when it has one. A package price keeps its package size, so
 * "$10 per 1,000" never becomes $10 per unit. A tiered price has no one rate:
 * the window starts blank and its price is entered.
 */
export function windowSeed(
  charge: Charge,
  override?: PriceOverride,
): { unitAmount: string; packageSize?: string } {
  if (override) {
    switch (override.billingModel) {
      case BillingModel.FlatFee:
        return { unitAmount: override.amount }
      case BillingModel.Package:
        return { unitAmount: override.amount, packageSize: String(override.divideBy) }
      case BillingModel.Tiered:
        return { unitAmount: '' }
    }
  }
  if (charge.billingModel === BillingModel.Package && charge.transformQuantity)
    return { unitAmount: charge.amount, packageSize: String(charge.transformQuantity.divideBy) }
  return { unitAmount: charge.amount }
}

/** A usage charge as the commitment dialog takes it: its name, price and what a window's price builds on. */
export function commitmentChargeOf(charge: Charge, override?: PriceOverride) {
  return {
    priceId: charge.id,
    name: chargeName(charge),
    description: `${BILLING_MODEL_LABEL[override?.billingModel ?? charge.billingModel]} · ${priceText(charge, override)}`,
    // The price override's bucket, when it chose one, else the plan charge's.
    bucketSize: override?.bucketSize || charge.bucketSize || '',
    // A window's price starts from the price the charge bills at.
    ...windowSeed(charge, override),
    priceBase: charge.meterId
      ? {
          entityId: charge.entityId,
          entityType: charge.entityType,
          meterId: charge.meterId,
          currency: charge.currency,
          billingPeriod: charge.billingPeriod,
          billingPeriodCount: charge.billingPeriodCount,
          invoiceCadence: charge.invoiceCadence,
        }
      : undefined,
  } as const
}

function priceText(charge: Charge, override: PriceOverride | undefined): string {
  const tiers =
    override?.billingModel === BillingModel.Tiered
      ? override.tiers
      : !override && charge.billingModel === BillingModel.Tiered
        ? charge.tiers
        : null
  if (tiers && tiers.length > 0) {
    const count = `${tiers.length} ${tiers.length === 1 ? 'tier' : 'tiers'}`
    // Per-package and per-unit rates don't compare, so a packaged price leads with its first band.
    if (tiers.some((tier) => tier.transformQuantity?.divideBy)) {
      const first = tiers[0]!
      return `${count}, from ${money(first.unitAmount, charge.currency)} ${tierUnitLabel(first)}`
    }
    const lowest = Math.min(
      ...tiers.map((tier) => Number(tier.unitAmount)).filter((n) => Number.isFinite(n)),
    )
    return `${count}${
      Number.isFinite(lowest) ? `, from ${money(String(lowest), charge.currency)} per unit` : ''
    }`
  }
  return chargePricing(charge, override).summary.replace(/^[^·]+· /, '')
}

/* ------------------------------------------------------------------------- */
/* Charges & add-ons                                                         */
/* ------------------------------------------------------------------------- */

/** A charge as the charges table lists it: plain strings for search and the filters, the charge behind them. */
export type ChargeRow = {
  id: string
  name: string
  type: 'Fixed' | 'Usage'
  status: 'Changed' | 'As on the plan'
  price: string
} & ({ kind: 'plan'; charge: Charge } | { kind: 'extra'; extra: AddContractCharge; index: number })

/**
 * When a charge in the wizard is in effect: its own dates, or with the phase.
 * A plan charge's dates are calendar days stored at midnight UTC, so they are
 * read in UTC as `ChargeTable` reads them; an added charge's `YYYY-MM-DD` day
 * is parsed as local midnight, so it stays in local time.
 */
export function chargeInEffect(row: ChargeRow): string {
  const fmt = (date: Date, timeZone?: 'UTC') =>
    date.toLocaleDateString('en-US', { dateStyle: 'medium', timeZone })
  if (row.kind === 'extra') {
    const start = parseDateValue(row.extra.startDate)
    return start ? `From ${fmt(start)}` : 'With the phase'
  }
  const { startDate, endDate } = row.charge
  if (!startDate && !endDate) return 'With the phase'
  return `${startDate ? fmt(startDate, 'UTC') : '—'} → ${endDate ? fmt(endDate, 'UTC') : 'Ongoing'}`
}

/** A contract date (a day, or an instant with a time) as its `YYYY-MM-DD` day; blank stays blank. */
function contractDayOrBlank(value: string): string {
  return value ? contractDay(value) : ''
}

/**
 * Whether a plan charge is in effect on a `YYYY-MM-DD` day. Its dates are
 * calendar days at midnight UTC, so they are compared as UTC days.
 */
export function inEffectOn(charge: Charge, day: string): boolean {
  const iso = (date: Date) => date.toISOString().slice(0, 10)
  if (charge.startDate && iso(charge.startDate) > day) return false
  if (charge.endDate && iso(charge.endDate) <= day) return false
  return true
}

/** "One charge sits outside the contract start (Nov 1, 2026): Seats, from Dec 1, 2026." */
export function outsideNote(charges: readonly Charge[], start: string): string {
  const day = formatDay(start)
  const which = charges
    .map((charge) => {
      const fmt = (date: Date) =>
        date.toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' })
      const when =
        charge.startDate && charge.startDate.toISOString().slice(0, 10) > start
          ? `from ${fmt(charge.startDate)}`
          : charge.endDate
            ? `ended ${fmt(charge.endDate)}`
            : ''
      return `${chargeName(charge)}${when ? `, ${when}` : ''}`
    })
    .join('; ')
  const lead =
    charges.length === 1
      ? 'One charge sits outside the contract start'
      : `${charges.length.toLocaleString('en-US')} charges sit outside the contract start`
  const each = charges.length === 1 ? 'It bills' : 'Each bills'
  return `${lead}${day ? ` (${day})` : ''}: ${which}. ${each} only while its own dates are in effect.`
}

/** A change a charge row carries, drawn as a chip under its name that opens the matching dialog. */
function ChargeFlag({
  icon,
  label,
  name,
  onClick,
}: {
  icon: ReactNode
  label: string
  name: string
  onClick: () => void
}) {
  return (
    <Badge
      variant="outline"
      size="lg"
      className="hover:bg-muted shrink-0 cursor-pointer font-normal"
      render={<button type="button" aria-label={`${label}: edit on ${name}`} onClick={onClick} />}
    >
      {icon}
      {label}
    </Badge>
  )
}

/**
 * A phase's charges as the reference's searchable table: any added to this
 * contract alone first, then the plan's: a type and a status filter, twenty a
 * page. A fixed charge's quantity is edited in its row; everything else: a new
 * price, a usage charge's commitment, a coupon on just that charge, back to the
 * plan: is in the row's one menu, and each change shows as a chip under the
 * name that reopens it.
 */
function ChargesTable({
  charges,
  extraCharges,
  isLoading,
  overrides,
  onChange,
  quantities,
  onQuantities,
  phaseLabel,
  currency,
  commitments,
  onCommitment,
  onRemoveExtra,
  onEditExtra,
  couponOf,
  onCoupon,
  onReset,
  meters,
  phaseStart = '',
}: {
  charges: Charge[]
  extraCharges: AddContractCharge[]
  isLoading: boolean
  overrides: PriceOverride[]
  onChange: (next: PriceOverride[]) => void
  quantities: SubscriptionPhase['quantities']
  onQuantities: (next: SubscriptionPhase['quantities']) => void
  phaseLabel: string
  currency: string
  /** Present on a single-phase contract, where a usage charge can carry a commitment. */
  commitments?: ChargeCommitment[]
  onCommitment?: (priceId: string, next: ChargeCommitment | null) => void
  onRemoveExtra: (index: number) => void
  /** Reopens a charge added on this contract, to change it before saving. */
  onEditExtra: (index: number) => void
  /** The coupon on one charge, if it has one. */
  couponOf: (priceId: string) => SubscriptionCouponOption | undefined
  /** Opens the coupon dialog for a charge; absent when there are no coupons. */
  onCoupon?: ((priceId: string) => void) | undefined
  /** Puts a charge back as the plan has it: price, quantity, commitment and coupon. */
  onReset: (priceId: string) => void
  /** The metered features, so a usage charge's override offers a bucket only where the API takes one. */
  meters: MeterOption[]
  /** `YYYY-MM-DD`: the phase's first day, to note plan charges not in effect on it. */
  phaseStart?: string
}) {
  // " in Phase 2" on a contract of phases; nothing on a contract of one.
  const inPhase = phaseLabel ? ` in ${phaseLabel}` : ''
  const quantityEntry = (priceId: string) => quantities.find((q) => q.priceId === priceId)
  // A fixed charge bills one unless this contract says otherwise.
  const setQuantity = (priceId: string, quantity: string) =>
    onQuantities(
      quantity.trim() === '1'
        ? quantities.filter((q) => q.priceId !== priceId)
        : [...quantities.filter((q) => q.priceId !== priceId), { priceId, quantity }],
    )
  // The plan charge whose price dialog is open.
  const [repricing, setRepricing] = useState<string | null>(null)
  // The usage charge whose commitment dialog is open.
  const [committing, setCommitting] = useState<string | null>(null)
  const byId = new Map(overrides.map((o) => [o.priceId, o]))
  const commitmentOf = new Map((commitments ?? []).map((c) => [c.priceId, c]))

  if (isLoading) return <EmptyLine>Loading the plan&apos;s charges…</EmptyLine>

  const changed = (charge: Charge) =>
    byId.has(charge.id) ||
    quantityEntry(charge.id) !== undefined ||
    commitmentOf.has(charge.id) ||
    couponOf(charge.id) !== undefined

  const rows: ChargeRow[] = [
    ...extraCharges.map((extra, index) => ({
      id: `extra-${index}`,
      kind: 'extra' as const,
      extra,
      index,
      name: extra.charge.displayName || 'Contract charge',
      type: extra.charge.type === PriceType.Usage ? ('Usage' as const) : ('Fixed' as const),
      status: 'Changed' as const,
      price: extraPriceText(extra),
    })),
    ...charges.map((charge) => ({
      id: charge.id,
      kind: 'plan' as const,
      charge,
      name: chargeName(charge),
      type: charge.type === PriceType.Usage ? ('Usage' as const) : ('Fixed' as const),
      status: changed(charge) ? ('Changed' as const) : ('As on the plan' as const),
      price: priceText(charge, byId.get(charge.id)),
    })),
  ]
  if (rows.length === 0)
    return (
      <Frame>
        <EmptyLine>This plan has no charges.</EmptyLine>
      </Frame>
    )

  const committingCharge = charges.find((charge) => charge.id === committing)
  const repricingCharge = charges.find((charge) => charge.id === repricing)

  // Plan charges not in effect on the phase's first day: one note under the table, not a column.
  const outside = phaseStart ? charges.filter((charge) => !inEffectOn(charge, phaseStart)) : []

  /*
   * Widths that fit the wizard's measure without a sideways scroll: the cells
   * keep the table's own padding, and nothing but the charge (its change chips)
   * may take a second line.
   */
  const columns: DetailColumn<ChargeRow>[] = [
    {
      key: 'charge',
      header: 'Charge',
      width: 224,
      className: 'whitespace-normal',
      text: (row) => row.name,
      cell: (row) => {
        if (row.kind === 'extra') {
          return (
            <span className="flex min-w-0 flex-col gap-0.5 py-2">
              <span className="flex items-center gap-1.5">
                <span className="truncate font-medium">{row.name}</span>
                <Badge variant="outline" size="sm" className="shrink-0 font-normal">
                  Added
                </Badge>
              </span>
              <span className="text-muted-foreground text-xs">{extraChargeSummary(row.extra)}</span>
            </span>
          )
        }
        const { charge } = row
        const coupon = couponOf(charge.id)
        const commitment = commitmentOf.get(charge.id)
        const flags: ReactNode[] = []
        if (byId.has(charge.id))
          flags.push(
            <ChargeFlag
              key="price"
              icon={<CircleDollarSignIcon aria-hidden className="text-info size-3.5" />}
              label="Price changed"
              name={row.name}
              onClick={() => setRepricing(charge.id)}
            />,
          )
        if (coupon)
          flags.push(
            <ChargeFlag
              key="coupon"
              icon={<TicketPercentIcon aria-hidden className="text-success size-3.5" />}
              label={coupon.discount ? `${coupon.discount} off` : coupon.label}
              name={row.name}
              onClick={() => onCoupon?.(charge.id)}
            />,
          )
        if (commitment)
          flags.push(
            <ChargeFlag
              key="commitment"
              icon={
                <ScaleIcon aria-hidden className="text-primary dark:text-foreground size-3.5" />
              }
              label="Commitment"
              name={row.name}
              onClick={() => setCommitting(charge.id)}
            />,
          )
        return (
          <span className="flex min-w-0 flex-col gap-0.5 py-2">
            <span className="truncate font-medium">{row.name}</span>
            <span className="text-muted-foreground text-xs">
              {chargeKind(charge)}
              {charge.startDate || charge.endDate ? ` · ${chargeInEffect(row)}` : ''}
            </span>
            {flags.length > 0 ? (
              <span className="flex flex-wrap items-center gap-1.5 pt-1">
                {flags}
                {commitment ? (
                  <span className="text-muted-foreground text-xs">
                    {commitmentText(commitment, currency)}
                  </span>
                ) : null}
              </span>
            ) : null}
          </span>
        )
      },
    },
    {
      key: 'price',
      header: 'Price',
      width: 200,
      text: (row) => row.price,
      cell: (row) => (
        <span className="flex min-w-0 flex-col tabular-nums">
          <span className="truncate">{row.price}</span>
          {row.kind === 'plan' && byId.has(row.charge.id) ? (
            <span className="text-muted-foreground truncate text-xs line-through">
              {priceText(row.charge, undefined)}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'quantity',
      header: 'Quantity',
      width: 104,
      cell: (row) =>
        row.type !== 'Fixed' ? null : row.kind === 'plan' ? (
          <Input
            aria-label={`Quantity of ${row.name}${inPhase}`}
            inputMode="decimal"
            className="h-8 w-20"
            value={quantityEntry(row.charge.id)?.quantity ?? '1'}
            onChange={(event) => setQuantity(row.charge.id, event.target.value)}
          />
        ) : (
          <span className="tabular-nums">{row.extra.quantity || '1'}</span>
        ),
    },
    // When each charge is billed and in effect, as on the contract's own charges table.
    {
      key: 'timing',
      header: 'Billing timing',
      width: 128,
      cell: (row) => {
        const cadence =
          row.kind === 'plan' ? row.charge.invoiceCadence : row.extra.charge.invoiceCadence
        return (
          <span className="text-muted-foreground">
            {cadence === InvoiceCadence.Advance ? 'In advance' : 'In arrears'}
          </span>
        )
      },
    },
    {
      key: 'actions',
      header: '',
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={`More for ${row.name}${inPhase}`}
              />
            }
          >
            <MoreHorizontalIcon aria-hidden className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            {row.kind === 'extra' ? (
              <>
                <DropdownMenuItem onClick={() => onEditExtra(row.index)}>
                  <PencilIcon aria-hidden />
                  Edit charge
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => onRemoveExtra(row.index)}>
                  <Trash2Icon aria-hidden />
                  Remove charge
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => setRepricing(row.charge.id)}>
                    <CircleDollarSignIcon aria-hidden />
                    Override price
                  </DropdownMenuItem>
                  {onCommitment && row.type === 'Usage' ? (
                    <DropdownMenuItem onClick={() => setCommitting(row.charge.id)}>
                      <ScaleIcon aria-hidden />
                      {commitmentOf.has(row.charge.id) ? 'Edit commitment' : 'Add commitment'}
                    </DropdownMenuItem>
                  ) : null}
                  {onCoupon ? (
                    <DropdownMenuItem onClick={() => onCoupon(row.charge.id)}>
                      <TicketPercentIcon aria-hidden />
                      {couponOf(row.charge.id) ? 'Change coupon' : 'Apply coupon'}
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuGroup>
                {row.status === 'Changed' ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onReset(row.charge.id)}>
                      <RotateCcwIcon aria-hidden />
                      Reset to plan
                    </DropdownMenuItem>
                  </>
                ) : null}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      <DetailTable
        rows={rows}
        columns={columns}
        label={phaseLabel ? `Charges in ${phaseLabel}` : 'Charges'}
        noun="charges"
        facets={[
          { id: 'type', label: 'Type', value: (row) => row.type },
          { id: 'status', label: 'Status', value: (row) => row.status },
        ]}
        searchText={(row) => `${row.name} ${row.price}`}
        pageSize={20}
        compact
        border
      />
      {outside.length > 0 ? (
        <Alert variant="info">
          <InfoIcon aria-hidden />
          <AlertDescription>{outsideNote(outside, phaseStart)}</AlertDescription>
        </Alert>
      ) : null}
      <FormDialog
        open={repricingCharge !== undefined}
        onOpenChange={(open) => (open ? undefined : setRepricing(null))}
        size="lg"
        title={repricingCharge ? `Override price · ${chargeName(repricingCharge)}` : ''}
      >
        {repricingCharge ? (
          <div className="flex flex-col gap-4">
            <PriceOverrideForm
              key={repricingCharge.id}
              priceId={repricingCharge.id}
              meter={
                repricingCharge.type === PriceType.Usage
                  ? meters.find((meter) => meter.id === repricingCharge.meterId)
                  : undefined
              }
              defaultValue={byId.get(repricingCharge.id) ?? overrideFromCharge(repricingCharge)}
              onSubmit={(value) => {
                onChange([...overrides.filter((o) => o.priceId !== repricingCharge.id), value])
                // One bucket per charge reaches the API: a bucket chosen here
                // becomes the commitment's too, so neither silently loses.
                const commitment = commitmentOf.get(repricingCharge.id)
                if (
                  onCommitment &&
                  commitment &&
                  value.bucketSize &&
                  value.bucketSize !== commitment.bucketSize
                )
                  onCommitment(repricingCharge.id, { ...commitment, bucketSize: value.bucketSize })
                setRepricing(null)
              }}
            />
          </div>
        ) : null}
      </FormDialog>
      {onCommitment ? (
        <ChargeCommitmentDialog
          charge={
            committingCharge
              ? commitmentChargeOf(committingCharge, byId.get(committingCharge.id))
              : null
          }
          commitment={committing ? commitmentOf.get(committing) : undefined}
          currency={currency}
          onClose={() => setCommitting(null)}
          onSave={(next) => {
            if (committing) {
              onCommitment(committing, next)
              // And the other way: a commitment's new bucket replaces one the price override chose.
              const override = byId.get(committing)
              if (next && override?.bucketSize && override.bucketSize !== next.bucketSize)
                onChange(
                  overrides.map((o) =>
                    o.priceId === committing ? { ...o, bucketSize: next.bucketSize } : o,
                  ),
                )
            }
            setCommitting(null)
          }}
        />
      ) : null}
    </div>
  )
}

/** An added charge's price: its amount, or "—" for usage priced by its own model. */
function extraPriceText(extra: AddContractCharge): string {
  const { charge } = extra
  return 'amount' in charge && charge.amount ? money(charge.amount, charge.currency) : '—'
}

/** "1 charge", "1,200 charges". */
function chargeCountText(count: number): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? 'charge' : 'charges'}`
}

/** "Usage · Monthly", or "Flat fee · $250.00 · One time". */
function extraChargeSummary(extra: AddContractCharge): string {
  const { charge } = extra
  const amount =
    'amount' in charge && charge.amount ? ` · ${money(charge.amount, charge.currency)}` : ''
  const kind = charge.type === PriceType.Usage ? 'Usage' : BILLING_MODEL_LABEL[charge.billingModel]
  return `${kind}${amount} · ${BILLING_PERIOD_LABEL[charge.billingPeriod]}`
}

/**
 * A phase's discounts: coupons on the whole phase, listed, and a picker that
 * opens from "Add coupon": or from a charge's menu, aimed at that charge.
 */
function PhaseDiscounts({
  discounts,
  charges,
  coupons,
  phaseLabel,
  picking,
  onPicking,
  onChange,
}: {
  discounts: SubscriptionDiscount[]
  charges: Charge[]
  coupons: readonly SubscriptionCouponOption[]
  phaseLabel: string
  /** The target the picker is open for (`all`, or a charge id), or null while closed. */
  picking: string | null
  onPicking: (target: string | null) => void
  onChange: (next: SubscriptionDiscount[]) => void
}) {
  const couponsStatus = useContext(CouponsStatusContext)
  const [couponId, setCouponId] = useState('')
  const idBase = `discount-${phaseLabel.toLowerCase().replace(/\s+/g, '-')}`
  const couponName = (id: string) => coupons.find((c) => c.value === id)?.label ?? id
  const chargeLabel = (id: string) => {
    const charge = charges.find((c) => c.id === id)
    return charge ? chargeName(charge) : id
  }
  const close = () => {
    setCouponId('')
    onPicking(null)
  }

  return (
    <SubSection
      title="Discounts"
      description={`Coupons on all of ${phaseLabel}. A coupon on one charge is applied from that charge's menu.`}
      // Offered even with no coupons in the catalogue, so it is clear where a
      // discount goes; the picker then says there is nothing to choose yet.
      action={
        <AddButton
          onClick={() => onPicking('all')}
          disabled={picking !== null}
          label={`Add a coupon to ${phaseLabel}`}
        >
          Add coupon
        </AddButton>
      }
    >
      <Frame
        footer={
          picking === null ? null : coupons.length === 0 ? (
            <div className="flex items-center justify-between gap-3 py-1.5">
              <p className="text-muted-foreground text-xs">{noCouponsText(couponsStatus)}</p>
              <CloseSubForm label={`Close coupon picker for ${phaseLabel}`} onClick={close} />
            </div>
          ) : (
            <div className="grid gap-2 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] sm:items-start">
              <label htmlFor={`${idBase}-coupon`} className="sr-only">
                Coupon for {phaseLabel}
              </label>
              <OptionCombobox
                id={`${idBase}-coupon`}
                value={couponId}
                onValueChange={setCouponId}
                options={coupons.map((coupon) => ({
                  value: coupon.value,
                  label: couponOptionLabel(coupon),
                }))}
                placeholder="Choose a coupon…"
              />
              <label htmlFor={`${idBase}-target`} className="sr-only">
                Discount applies to, in {phaseLabel}
              </label>
              <OptionSelect
                id={`${idBase}-target`}
                value={picking}
                onValueChange={onPicking}
                options={[
                  { value: 'all', label: `All of ${phaseLabel}` },
                  ...charges.map((charge) => ({ value: charge.id, label: chargeName(charge) })),
                ]}
              />
              <Button
                type="button"
                variant="outline"
                disabled={!couponId}
                onClick={() => {
                  onChange([
                    ...discounts,
                    { couponId, ...(picking === 'all' ? {} : { priceId: picking }) },
                  ])
                  close()
                }}
              >
                Add discount
              </Button>
              <CloseSubForm label={`Close coupon picker for ${phaseLabel}`} onClick={close} />
            </div>
          )
        }
      >
        {discounts.length === 0 ? (
          <EmptyLine>No discounts on {phaseLabel}.</EmptyLine>
        ) : (
          <ul className="divide-y">
            {discounts.map((discount, index) => (
              <li
                key={`${discount.couponId}-${discount.priceId ?? 'all'}-${index}`}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{couponName(discount.couponId)}</span>
                  <span className="text-muted-foreground text-xs">
                    {discount.priceId
                      ? `On ${chargeLabel(discount.priceId)}`
                      : `On all of ${phaseLabel}`}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange(discounts.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Frame>
    </SubSection>
  )
}

/**
 * The contract's own discount: one coupon on the whole contract, or none. A
 * coupon on one charge is applied from that charge's menu, so this card leaves
 * those alone. Both are the phase's discounts underneath: this one without a
 * charge: so the request is the same either way.
 */
function DiscountCard({
  discounts,
  coupons,
  onChange,
}: {
  discounts: SubscriptionDiscount[]
  coupons: readonly SubscriptionCouponOption[]
  onChange: (next: SubscriptionDiscount[]) => void
}) {
  const whole = discounts.find((d) => !d.priceId)
  const onCharges = discounts.filter((d) => d.priceId)
  return (
    <FormCard
      title="Discount"
      status="optional"
      icon={<TicketPercentIcon aria-hidden className="text-success size-4 shrink-0" />}
    >
      <FormRow
        label="Coupon"
        hint="A coupon on the whole contract. A coupon on one charge is applied from that charge's menu."
      >
        {({ id, ...field }) => (
          <OptionSelect
            id={id}
            {...field}
            value={whole?.couponId ?? NO_DISCOUNT}
            onValueChange={(couponId) =>
              onChange(couponId === NO_DISCOUNT ? onCharges : [...onCharges, { couponId }])
            }
            options={[
              { value: NO_DISCOUNT, label: 'No discount' },
              ...coupons.map((coupon) => ({
                value: coupon.value,
                label: couponOptionLabel(coupon),
              })),
            ]}
          />
        )}
      </FormRow>
    </FormCard>
  )
}

const NO_DISCOUNT = 'none'

/** The phase's number in a filled circle, beside its title. */
function PhaseNumber({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium tabular-nums"
    >
      {n}
    </span>
  )
}

/**
 * The contract's charges. A contract of one phase is one card: the charges
 * table, then the discounts: the dates (and proration) are the contract's own,
 * asked on the first step. "Add phase" splits it once it has an end date.
 *
 * With more than one phase it is a timeline: each phase a card with its dates,
 * its charges and then its discounts: and, after the last, the dashed button
 * that adds the next phase. Phase 1 starts with the contract; each later phase
 * starts where the one before it ends, so only ends are chosen after the first.
 */
function PhasesStep({
  phases,
  starts,
  startDate,
  onStartDate,
  startError,
  today,
  charges,
  isLoading,
  coupons,
  errors,
  onChange,
  commitments,
  onCommitments,
  currency,
  billingPeriod,
  meters,
  priceUnits,
  planLabel,
}: {
  phases: SubscriptionPhase[]
  starts: string[]
  startDate: string
  onStartDate: (value: string) => void
  startError: string | undefined
  today: string
  charges: Charge[]
  isLoading: boolean
  coupons: readonly SubscriptionCouponOption[]
  errors: FieldErrors<CreateSubscription>['phases']
  onChange: (next: SubscriptionPhase[]) => void
  commitments: ChargeCommitment[]
  onCommitments: (next: ChargeCommitment[]) => void
  currency: string
  billingPeriod: CreateSubscription['billingPeriod']
  meters: MeterOption[]
  priceUnits: PriceUnitOption[]
  planLabel: string | undefined
}) {
  const update = (index: number, patch: Partial<SubscriptionPhase>) =>
    onChange(phases.map((phase, i) => (i === index ? { ...phase, ...patch } : phase)))
  const setCommitment = (priceId: string, next: ChargeCommitment | null) => {
    const rest = commitments.filter((c) => c.priceId !== priceId)
    onCommitments(next ? [...rest, next] : rest)
  }
  // Which phase the add-charge dialog adds to; null while it is closed.
  const [addingTo, setAddingTo] = useState<number | null>(null)
  // A charge added on this contract, reopened to change it.
  const [editingExtra, setEditingExtra] = useState<{ phase: number; index: number } | null>(null)
  // Which phase's coupon picker is open, and for what.
  const [couponFor, setCouponFor] = useState<{ phase: number; target: string } | null>(null)
  // The charge whose coupon dialog is open, and in which phase.
  const [couponing, setCouponing] = useState<{ phase: number; priceId: string } | null>(null)
  // Phases folded away so a newly added one can take the page.
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(new Set())
  const single = phases.length === 1
  const last = phases[phases.length - 1]
  const canAdd = Boolean(last?.endDate)
  const expand = (index: number) =>
    setCollapsed((current) => {
      const next = new Set(current)
      next.delete(index)
      return next
    })
  const shiftCollapsed = (removed: number) =>
    setCollapsed((current) => {
      const next = new Set<number>()
      for (const i of current) {
        if (i === removed) continue
        next.add(i > removed ? i - 1 : i)
      }
      return next
    })
  const rangeOf = (index: number) =>
    `${formatDay(starts[index] || (index === 0 ? today : '')) || 'When the previous phase ends'} → ${
      phases[index]?.endDate ? formatDay(phases[index]!.endDate) : 'until cancelled'
    }`

  /** The coupon on one charge in a phase, as the coupon list names it. */
  const couponOn = (index: number, priceId: string): SubscriptionCouponOption | undefined => {
    const discount = phases[index]?.discounts.find((d) => d.priceId === priceId)
    if (!discount) return undefined
    return (
      coupons.find((c) => c.value === discount.couponId) ?? {
        value: discount.couponId,
        label: discount.couponId,
      }
    )
  }
  /** How many of a phase's charges differ from the plan, counting those added to it. */
  const changedIn = (index: number) => {
    const phase = phases[index]!
    const committed = new Set(single ? commitments.map((c) => c.priceId) : [])
    return (
      phase.extraCharges.length +
      charges.filter(
        (charge) =>
          phase.priceOverrides.some((o) => o.priceId === charge.id) ||
          phase.quantities.some((q) => q.priceId === charge.id) ||
          phase.discounts.some((d) => d.priceId === charge.id) ||
          committed.has(charge.id),
      ).length
    )
  }

  /** One phase's charges table, and the quantity error under it. */
  const chargesOf = (index: number, label: string) => {
    const phase = phases[index]!
    const quantityErrors = errors?.[index]?.quantities
    const quantityError = quantityErrors
      ? Object.values(quantityErrors as Record<string, { quantity?: { message?: string } }>)
          .map((row) => row?.quantity?.message)
          .find(Boolean)
      : undefined
    return (
      <>
        <ChargesTable
          charges={charges}
          extraCharges={phase.extraCharges}
          isLoading={isLoading}
          overrides={phase.priceOverrides}
          onChange={(priceOverrides) => update(index, { priceOverrides })}
          quantities={phase.quantities}
          onQuantities={(quantities) => update(index, { quantities })}
          phaseLabel={label}
          currency={currency}
          onRemoveExtra={(at) =>
            update(index, { extraCharges: phase.extraCharges.filter((_, i) => i !== at) })
          }
          onEditExtra={(at) => setEditingExtra({ phase: index, index: at })}
          meters={meters}
          // A day, though the start may carry a time.
          phaseStart={contractDayOrBlank(starts[index] || (index === 0 ? today : ''))}
          couponOf={(priceId) => couponOn(index, priceId)}
          onCoupon={(priceId) => setCouponing({ phase: index, priceId })}
          onReset={(priceId) => {
            update(index, {
              priceOverrides: phase.priceOverrides.filter((o) => o.priceId !== priceId),
              quantities: phase.quantities.filter((q) => q.priceId !== priceId),
              discounts: phase.discounts.filter((d) => d.priceId !== priceId),
            })
            if (single) setCommitment(priceId, null)
          }}
          {...(single
            ? {
                commitments,
                onCommitment: setCommitment,
              }
            : {})}
        />
        {quantityError ? (
          <p className="text-destructive text-xs" role="alert">
            {quantityError}
          </p>
        ) : null}
      </>
    )
  }

  const discountsOf = (index: number, label: string) => (
    <PhaseDiscounts
      discounts={phases[index]!.discounts}
      charges={charges}
      coupons={coupons}
      phaseLabel={label}
      picking={couponFor?.phase === index ? couponFor.target : null}
      onPicking={(target) => setCouponFor(target === null ? null : { phase: index, target })}
      onChange={(discounts) => update(index, { discounts })}
    />
  )

  const addCharge = (index: number, label?: string) => (
    <Button
      type="button"
      variant={label ? 'outline' : 'default'}
      size="sm"
      {...(label ? { 'aria-label': `Add a charge to ${label}` } : {})}
      onClick={() => setAddingTo(index)}
    >
      <PlusIcon data-icon="inline-start" aria-hidden />
      Add charge
    </Button>
  )

  const addPhase = (
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full border-dashed"
        disabled={!canAdd}
        onClick={() => {
          setCollapsed(new Set(phases.map((_, i) => i)))
          onChange([...phases, emptyPhase()])
        }}
      >
        <PlusIcon data-icon="inline-start" aria-hidden />
        Add phase
      </Button>
      <p className="text-muted-foreground text-center text-xs">
        {single
          ? canAdd
            ? `Change the charges partway through: a second phase starts on ${formatDay(last!.endDate)}, with its own charges and discounts.`
            : 'Change the charges partway through with a second phase. It starts where the contract ends, so give the contract an end date first.'
          : canAdd
            ? `Phase ${phases.length + 1} starts when Phase ${phases.length} ends, with its own charges and discounts.`
            : `A new phase starts when Phase ${phases.length} ends, so Phase ${phases.length} needs an end date first.`}
      </p>
    </div>
  )

  const couponingCharge = couponing
    ? charges.find((charge) => charge.id === couponing.priceId)
    : undefined
  const couponsStatus = useContext(CouponsStatusContext)
  const couponDialog = (
    <ChargeCouponDialog
      charge={
        couponing && couponingCharge
          ? { priceId: couponingCharge.id, name: chargeName(couponingCharge) }
          : null
      }
      couponId={couponing ? couponOn(couponing.phase, couponing.priceId)?.value : undefined}
      coupons={coupons}
      status={couponsStatus}
      onClose={() => setCouponing(null)}
      onSave={(couponId) => {
        if (couponing) {
          const phase = phases[couponing.phase]!
          // One coupon per charge: a new one replaces the old.
          const rest = phase.discounts.filter((d) => d.priceId !== couponing.priceId)
          update(couponing.phase, {
            discounts: couponId ? [...rest, { couponId, priceId: couponing.priceId }] : rest,
          })
        }
        setCouponing(null)
      }}
    />
  )

  const edited = editingExtra
    ? phases[editingExtra.phase]?.extraCharges[editingExtra.index]
    : undefined
  const closeChargeDialog = () => {
    setAddingTo(null)
    setEditingExtra(null)
  }
  const addChargeDialog = (
    <ContractChargeDialog
      state={edited ? { mode: 'add', initial: edited } : addingTo === null ? null : { mode: 'add' }}
      addTitle="Add a charge"
      addDescription="It bills on this contract only, on top of the plan's charges."
      onClose={closeChargeDialog}
      currency={currency}
      billingPeriod={billingPeriod}
      meters={meters}
      priceUnits={priceUnits}
      // A phase that starts after today: a charge added to it cannot start
      // before it, which the API would refuse.
      // The bound is the phase's start exactly as the request sends it (a day
      // is midnight UTC, a picked time is kept), so a charge that starts with
      // the phase is never sent as starting before it.
      {...(() => {
        const phaseIndex = editingExtra?.phase ?? addingTo
        const start = phaseIndex === null ? '' : (starts[phaseIndex] ?? '')
        if (!start) return {}
        const at = contractDateToInstant(start)
        return !Number.isNaN(at.getTime()) && at.getTime() > Date.now()
          ? { earliestStart: at.toISOString() }
          : {}
      })()}
      onAdd={(draft) => {
        if (editingExtra) {
          // An edit replaces the charge where it is.
          const phase = phases[editingExtra.phase]
          if (phase)
            update(editingExtra.phase, {
              extraCharges: phase.extraCharges.map((extra, i) =>
                i === editingExtra.index ? draft : extra,
              ),
            })
          closeChargeDialog()
          return
        }
        if (addingTo === null) return
        const phase = phases[addingTo]
        // Newest first: the charge just added is the one at the top of the table.
        if (phase) update(addingTo, { extraCharges: [draft, ...phase.extraCharges] })
        setAddingTo(null)
      }}
      onEdit={() => undefined}
      onEnd={() => undefined}
    />
  )

  if (single) {
    return (
      <div className="flex flex-col gap-5">
        <FormCard
          title="Charges"
          icon={
            <CircleDollarSignIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />
          }
          adornment={addCharge(0)}
        >
          <div className="flex flex-col gap-3 px-5 py-4 sm:px-6">
            <p className="text-muted-foreground text-[13px]">
              {chargeCountText(charges.length + phases[0]!.extraCharges.length)} from the{' '}
              {planLabel ?? ''} plan
              {changedIn(0) > 0 ? `, ${changedIn(0)} changed on this contract` : ''}. Search for one
              to override its price, set a commitment or apply a coupon.
            </p>
            {chargesOf(0, '')}
          </div>
        </FormCard>
        <DiscountCard
          discounts={phases[0]!.discounts}
          coupons={coupons}
          onChange={(discounts) => update(0, { discounts })}
        />
        {addChargeDialog}
        {couponDialog}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-base font-medium">Contract timeline</h2>
      {phases.map((phase, index) => {
        const label = `Phase ${index + 1}`
        const start = starts[index]
        const endError = errors?.[index]?.endDate?.message
        if (collapsed.has(index)) {
          return (
            <button
              key={index}
              type="button"
              onClick={() => expand(index)}
              className="bg-background hover:bg-muted/40 flex w-full items-center justify-between gap-4 rounded-xl border px-5 py-4 text-left sm:px-6"
            >
              <span className="flex min-w-0 items-center gap-2">
                <PhaseNumber n={index + 1} />
                <span className="text-sm font-medium">{label}</span>
                <span className="text-muted-foreground text-xs">· {rangeOf(index)}</span>
              </span>
              <span className="text-muted-foreground shrink-0 text-xs">Edit</span>
            </button>
          )
        }
        return (
          <FormCard
            key={index}
            title={label}
            icon={<PhaseNumber n={index + 1} />}
            description={rangeOf(index)}
            adornment={
              index > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove ${label.toLowerCase()}`}
                  onClick={() => {
                    const next = phases.filter((_, i) => i !== index)
                    // The phase before now runs to where the removed one ended.
                    const before = next[index - 1]
                    if (before && index === phases.length - 1) {
                      next[index - 1] = { ...before, endDate: phase.endDate }
                    }
                    shiftCollapsed(index)
                    onChange(next)
                  }}
                >
                  Remove phase
                </Button>
              ) : undefined
            }
          >
            <div>
              <div className="px-5 pt-4 sm:px-6">
                <h3 className="text-sm font-medium">Dates</h3>
              </div>
              {index === 0 ? (
                <FormRow
                  label="Starts"
                  hint="The contract start date. Leave it as today to start now."
                  error={startError}
                >
                  {({ id, ...field }) => (
                    <DateInput
                      id={id}
                      {...field}
                      value={startDate}
                      onValueChange={onStartDate}
                      placeholder={`Today, ${formatDay(today)}`}
                    />
                  )}
                </FormRow>
              ) : (
                <FormRow label="Starts" hint="When the previous phase ends.">
                  {() => (
                    <p className="text-sm">
                      {start ? formatDay(start) : 'When the previous phase ends'}
                    </p>
                  )}
                </FormRow>
              )}
              <FormRow
                label="Ends"
                hint={
                  index === phases.length - 1
                    ? 'The contract end date. Leave empty to run until cancelled.'
                    : 'The next phase starts when this one ends.'
                }
                error={endError}
              >
                {({ id, ...field }) => (
                  <DateInput
                    id={id}
                    {...field}
                    value={phase.endDate}
                    onValueChange={(endDate) => update(index, { endDate })}
                    placeholder={
                      index === phases.length - 1 ? 'Runs until cancelled' : 'Choose a date'
                    }
                  />
                )}
              </FormRow>
            </div>
            <SubSection
              title="Charges"
              description={`The plan's prices for ${label}. Change only what this deal changes.`}
              action={addCharge(index, label)}
            >
              {charges.some((charge) => charge.type === PriceType.Usage) ? (
                <p className="text-muted-foreground text-xs">
                  A commitment on an individual charge is kept for a contract with one phase. Remove
                  the extra phases to set one.
                </p>
              ) : null}
              {chargesOf(index, label)}
            </SubSection>
            {discountsOf(index, label)}
          </FormCard>
        )
      })}
      {addChargeDialog}
      {couponDialog}
      {addPhase}
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/* Add-ons, commitments & benefits                                          */
/* ------------------------------------------------------------------------- */

/** Removing a row from a table inside the form: a red delete icon. */
function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="text-destructive hover:text-destructive hover:bg-destructive/10 size-7"
      aria-label={label}
      onClick={onClick}
    >
      <Trash2Icon aria-hidden />
    </Button>
  )
}

/** An add-on's own pricing on one contract: new prices on its charges, commitments on its usage charges. */
export interface AddonPricing {
  priceOverrides: PriceOverride[]
  commitments: ChargeCommitment[]
}

/**
 * An add-on's charges, fixed and usage, before it is added to a contract. Each
 * charge can take a new price, sent as the add-on's `override_line_items`, and
 * each usage charge a commitment, as a plan charge can. The price and
 * commitment dialogs replace this one while open, so only one dialog shows.
 *
 * `charges` are only those the API attaches (`attachableAddonCharges`); null
 * hides the table (no add-on chosen yet), undefined says they are loading.
 */
export function AddonChargesDialog({
  open,
  title,
  submitLabel,
  charges,
  chargesFailed = false,
  currency,
  meters = [],
  value,
  onChange,
  pending = false,
  error,
  disabled,
  onClose,
  onSubmit,
  children,
}: {
  open: boolean
  title: string
  submitLabel: string
  charges: readonly Charge[] | null | undefined
  /** With `charges` undefined: they failed to load rather than still loading. */
  chargesFailed?: boolean
  currency: string
  /** The metered features, so a usage charge's override offers a bucket where the API takes one. */
  meters?: readonly MeterOption[] | undefined
  value: AddonPricing
  onChange: (next: AddonPricing) => void
  pending?: boolean
  error?: string | null | undefined
  disabled?: boolean
  onClose: () => void
  onSubmit: () => void
  /** Above the charges: the add-on picker, where the dialog chooses one. */
  children?: ReactNode
}) {
  const [editing, setEditing] = useState<{
    kind: 'price' | 'commitment'
    charge: Charge
  } | null>(null)
  const overrideOf = (priceId: string) => value.priceOverrides.find((o) => o.priceId === priceId)
  const commitmentOf = (priceId: string) => value.commitments.find((c) => c.priceId === priceId)
  const without = <T extends { priceId: string }>(list: T[], priceId: string) =>
    list.filter((item) => item.priceId !== priceId)
  const columns: SimpleColumn<Charge>[] = [
    {
      key: 'charge',
      header: 'Charge',
      cell: (charge) => {
        const commitment = commitmentOf(charge.id)
        return (
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{chargeName(charge)}</span>
            <span className="text-muted-foreground truncate text-xs">
              {chargeKind(charge)}
              {commitment ? ` · ${commitmentText(commitment, currency)}` : ''}
            </span>
          </span>
        )
      },
    },
    {
      key: 'price',
      header: 'Price',
      cell: (charge) => {
        const override = overrideOf(charge.id)
        return (
          <span className="flex min-w-0 flex-col tabular-nums">
            <span>{priceText(charge, override)}</span>
            {override ? (
              <span className="text-muted-foreground text-xs line-through">
                {priceText(charge, undefined)}
              </span>
            ) : null}
          </span>
        )
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10 text-right',
      cell: (charge) => {
        const name = chargeName(charge)
        const changed = overrideOf(charge.id) !== undefined || commitmentOf(charge.id) !== undefined
        return (
          <RowActionsMenu
            label={name}
            extra={[
              {
                label: overrideOf(charge.id) ? 'Edit price' : 'Override price',
                icon: <CircleDollarSignIcon aria-hidden />,
                onSelect: () => setEditing({ kind: 'price', charge }),
              },
              ...(charge.type === PriceType.Usage
                ? [
                    {
                      label: commitmentOf(charge.id) ? 'Edit commitment' : 'Add commitment',
                      icon: <ScaleIcon aria-hidden />,
                      onSelect: () => setEditing({ kind: 'commitment', charge }),
                    },
                  ]
                : []),
              ...(changed
                ? [
                    {
                      label: 'Reset to add-on price',
                      icon: <RotateCcwIcon aria-hidden />,
                      onSelect: () =>
                        onChange({
                          priceOverrides: without(value.priceOverrides, charge.id),
                          commitments: without(value.commitments, charge.id),
                        }),
                    },
                  ]
                : []),
            ]}
          />
        )
      },
    },
  ]
  const repricing = editing?.kind === 'price' ? editing.charge : null
  const committing = editing?.kind === 'commitment' ? editing.charge : null
  return (
    <>
      <FormDialog
        open={open && editing === null}
        onOpenChange={(next) => (next ? undefined : onClose())}
        title={title}
        size="lg"
        isPending={pending}
      >
        <Composer
          submitLabel={submitLabel}
          onCancel={onClose}
          submitting={pending}
          // Not while the chosen add-on's charges are loading: it would attach before
          // they could be priced. A failed load still attaches it, as the note says.
          disabled={Boolean(disabled) || (charges === undefined && !chargesFailed)}
          onSubmit={onSubmit}
        >
          {children}
          {charges === null ? null : (
            <div className="flex flex-col gap-2">
              <LabelWithHint hint="Every charge this add-on bills on the contract. Change a price, or commit on a usage charge, before adding it. Optional.">
                Charges
              </LabelWithHint>
              {charges === undefined ? (
                chargesFailed ? (
                  <p role="alert" className="text-destructive text-[13px]">
                    The add-on&apos;s charges could not be loaded, so they cannot be repriced now.
                    Add it as it is, or reload the page to price it.
                  </p>
                ) : (
                  <p className="text-muted-foreground text-[13px]">
                    Loading the add-on&apos;s charges…
                  </p>
                )
              ) : (
                <SimpleTable
                  rows={[...charges]}
                  getRowId={(charge) => charge.id}
                  columns={columns}
                  empty="This add-on has no charges in this contract's currency and billing period."
                />
              )}
            </div>
          )}
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
        </Composer>
      </FormDialog>
      <FormDialog
        open={open && repricing !== null}
        onOpenChange={(next) => (next ? undefined : setEditing(null))}
        size="lg"
        title={repricing ? `Override price · ${chargeName(repricing)}` : ''}
      >
        {repricing ? (
          <div className="flex flex-col gap-4">
            <PriceOverrideForm
              key={repricing.id}
              priceId={repricing.id}
              meter={
                repricing.type === PriceType.Usage
                  ? meters.find((meter) => meter.id === repricing.meterId)
                  : undefined
              }
              defaultValue={overrideOf(repricing.id) ?? overrideFromCharge(repricing)}
              onSubmit={(override) => {
                // One bucket per charge reaches the API: a bucket chosen here
                // becomes the commitment's too, so neither silently loses.
                const commitment = commitmentOf(repricing.id)
                onChange({
                  priceOverrides: [...without(value.priceOverrides, repricing.id), override],
                  commitments:
                    commitment &&
                    override.bucketSize &&
                    override.bucketSize !== commitment.bucketSize
                      ? value.commitments.map((c) =>
                          c.priceId === repricing.id
                            ? { ...c, bucketSize: override.bucketSize! }
                            : c,
                        )
                      : value.commitments,
                })
                setEditing(null)
              }}
            />
          </div>
        ) : null}
      </FormDialog>
      <ChargeCommitmentDialog
        charge={
          open && committing ? commitmentChargeOf(committing, overrideOf(committing.id)) : null
        }
        commitment={committing ? commitmentOf(committing.id) : undefined}
        currency={currency}
        onClose={() => setEditing(null)}
        onSave={(next) => {
          if (committing) {
            const override = overrideOf(committing.id)
            onChange({
              // And the other way: a commitment's new bucket replaces one the price override chose.
              priceOverrides:
                next && override?.bucketSize && override.bucketSize !== next.bucketSize
                  ? value.priceOverrides.map((o) =>
                      o.priceId === committing.id ? { ...o, bucketSize: next.bucketSize } : o,
                    )
                  : value.priceOverrides,
              commitments: [...without(value.commitments, committing.id), ...(next ? [next] : [])],
            })
          }
          setEditing(null)
        }}
      />
    </>
  )
}

/** An add-on draft with only the pricing it carries: empty lists are left off. */
function withAddonPricing(
  addon: { addonId: string; name: string },
  pricing: AddonPricing,
): CreateSubscription['addons'][number] {
  return {
    addonId: addon.addonId,
    name: addon.name,
    ...(pricing.priceOverrides.length > 0 ? { priceOverrides: pricing.priceOverrides } : {}),
    ...(pricing.commitments.length > 0 ? { commitments: pricing.commitments } : {}),
  }
}

/**
 * Add-ons the contract starts with: a table once there is one, and a picker
 * under it for the next. Picking an add-on opens its charges, fixed and usage,
 * to reprice or commit on before it is added; Edit reopens them. An add-on has
 * no quantity on a new contract: the API takes none.
 */
function AddonsSection({
  selected,
  options,
  onChange,
  chargesOf,
  chargesFailed,
  currency,
  billingPeriod,
  meters,
}: {
  selected: CreateSubscription['addons']
  options: readonly SubscriptionAddonOption[]
  onChange: (next: CreateSubscription['addons']) => void
  chargesOf?: ((addonId: string) => readonly Charge[] | undefined) | undefined
  chargesFailed: boolean
  currency: string
  billingPeriod: BillingPeriod
  meters: readonly MeterOption[]
}) {
  // The add-on whose charges dialog is open: one being added, or one already on the contract.
  const [open, setOpen] = useState<{
    addonId: string
    name: string
    adding: boolean
    pricing: AddonPricing
  } | null>(null)
  // Only the prices the API will attach (this currency, this period or one-time).
  const chargesFor = (addonId: string) => {
    const charges = chargesOf?.(addonId)
    return charges ? attachableAddonCharges(charges, { currency, billingPeriod }) : undefined
  }
  // Only what is sent: an override or commitment on a price the contract no
  // longer takes (its currency or period changed since) is dropped on submit.
  const pricingOf = (addon: CreateSubscription['addons'][number]): AddonPricing => ({
    priceOverrides: attachableAddonOverrides(
      addon.priceOverrides ?? [],
      chargesOf?.(addon.addonId),
      {
        currency,
        billingPeriod,
      },
    ),
    commitments: attachableAddonCommitments(addon.commitments ?? [], chargesOf?.(addon.addonId), {
      currency,
      billingPeriod,
    }),
  })
  const available = options.filter((o) => !selected.some((a) => a.addonId === o.value))
  const optionOf = (addonId: string) => options.find((o) => o.value === addonId)
  const nameOf = (addon: CreateSubscription['addons'][number]) =>
    addon.name || optionOf(addon.addonId)?.label || addon.addonId
  const edit = (addon: CreateSubscription['addons'][number]) =>
    setOpen({
      addonId: addon.addonId,
      name: nameOf(addon),
      adding: false,
      pricing: pricingOf(addon),
    })
  const save = () => {
    if (!open) return
    const next = withAddonPricing(open, open.pricing)
    onChange(
      open.adding
        ? [...selected, next]
        : selected.map((addon) => (addon.addonId === open.addonId ? next : addon)),
    )
    setOpen(null)
  }
  const columns: SimpleColumn<CreateSubscription['addons'][number]>[] = [
    {
      key: 'addon',
      header: 'Add-on',
      cell: (addon) => <span className="font-medium">{nameOf(addon)}</span>,
    },
    {
      key: 'charges',
      header: 'Charges',
      cell: (addon) => {
        const charges = chargesFor(addon.addonId)
        if (!charges)
          return (
            <span className="text-muted-foreground">{optionOf(addon.addonId)?.type ?? '—'}</span>
          )
        if (charges.length === 0) return <span className="text-muted-foreground">—</span>
        const pricing = pricingOf(addon)
        return (
          <span className="flex flex-col gap-0.5 text-[13px]">
            {charges.map((charge) => {
              const override = pricing.priceOverrides.find((o) => o.priceId === charge.id)
              const commitment = pricing.commitments.find((c) => c.priceId === charge.id)
              return (
                <span key={charge.id}>
                  <span className="font-medium">{chargeName(charge)}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {`: ${priceText(charge, override)}`}
                    {override ? ' (changed)' : ''}
                    {commitment ? ` · ${commitmentText(commitment, currency)}` : ''}
                  </span>
                </span>
              )
            })}
          </span>
        )
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10 text-right',
      cell: (addon) => (
        <RowActionsMenu
          label={nameOf(addon)}
          {...(chargesOf ? { onEdit: () => edit(addon) } : {})}
          onRemove={() => onChange(selected.filter((a) => a.addonId !== addon.addonId))}
          removeLabel="Remove add-on"
        />
      ),
    },
  ]
  return (
    <FormCard
      title="Add-ons"
      status="optional"
      icon={<PuzzleIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />}
    >
      {/*
       * One card row: the table, the picker under it and the (portalled)
       * dialog. As separate rows the card ruled a line under the table and
       * another, empty, under the dialog.
       */}
      <div>
        {selected.length > 0 ? (
          <div className="px-5 pt-4 sm:px-6">
            <Frame>
              <SimpleTable columns={columns} rows={selected} getRowId={(addon) => addon.addonId} />
            </Frame>
          </div>
        ) : null}
        <FormRow
          label={selected.length > 0 ? 'Add another' : 'Add-on'}
          hint="An add-on brings its own charges and entitlements onto the contract."
        >
          {({ id, ...field }) =>
            options.length === 0 ? (
              <p className="text-muted-foreground text-sm">No add-ons exist yet.</p>
            ) : (
              <OptionCombobox
                // A fresh picker after each pick, so it reads empty again.
                key={selected.length}
                id={id}
                {...field}
                value=""
                placeholder={selected.length > 0 ? 'Add another add-on…' : 'Choose an add-on…'}
                options={available}
                onValueChange={(addonId) => {
                  const option = available.find((o) => o.value === addonId)
                  if (!option) return
                  const addon = { addonId: option.value, name: option.label }
                  // Without the add-on's charges there is nothing to price: add it as it is.
                  if (!chargesOf) onChange([...selected, addon])
                  else
                    setOpen({
                      ...addon,
                      adding: true,
                      pricing: { priceOverrides: [], commitments: [] },
                    })
                }}
              />
            )
          }
        </FormRow>
        <AddonChargesDialog
          open={open !== null}
          title={open ? `${open.adding ? 'Add add-on' : 'Edit add-on'} · ${open.name}` : ''}
          submitLabel={open?.adding ? 'Add add-on' : 'Save add-on'}
          charges={open ? chargesFor(open.addonId) : null}
          chargesFailed={chargesFailed}
          currency={currency}
          meters={meters}
          value={open?.pricing ?? { priceOverrides: [], commitments: [] }}
          onChange={(pricing) =>
            setOpen((current) => (current ? { ...current, pricing } : current))
          }
          onClose={() => setOpen(null)}
          onSubmit={save}
        />
      </div>
    </FormCard>
  )
}

/**
 * The contract-wide commitment, across every charge. A commitment on one
 * charge is set from that charge's menu, on the phases step. Period, overage,
 * and true-up stay visible so they can be found before an amount is entered.
 */
/** A contract commitment is set only when its amount is above zero, as the API reads it. */
function hasCommitment(amount: string | undefined): boolean {
  return Number(amount?.trim() || 0) > 0
}

function CommitmentsSection({
  values,
  errors,
  register,
  onDuration,
  onTrueUp,
}: {
  values: CreateSubscription
  errors: FieldErrors<CreateSubscription>
  register: UseFormRegister<CreateSubscription>
  onDuration: (value: CreateSubscription['commitmentDuration']) => void
  onTrueUp: (value: boolean) => void
}) {
  return (
    <FormCard
      title="Contract commitment"
      status="optional"
      icon={<ScaleIcon aria-hidden className="text-primary dark:text-foreground size-4 shrink-0" />}
      description="Applies to the whole contract, across every charge. Leave the amount empty for none. A commitment on a single charge is set on that charge, in the previous step."
    >
      <FormRow
        label="Commitment amount"
        hint={`The least the contract bills per commitment period, in ${values.currency.toUpperCase() || 'the contract currency'}.`}
        error={errors.commitmentAmount?.message}
      >
        {({ id, ...field }) => (
          <InputGroup className="h-9">
            <InputGroupAddon align="inline-start">
              {values.currency.toUpperCase() || '—'}
            </InputGroupAddon>
            <InputGroupInput
              id={id}
              inputMode="decimal"
              placeholder="No commitment"
              {...field}
              {...register('commitmentAmount')}
            />
          </InputGroup>
        )}
      </FormRow>
      <FormRow
        label="Commitment period"
        hint="The period the commitment is measured over, e.g. a year on a monthly contract."
      >
        {({ id, ...field }) => (
          <OptionSelect
            id={id}
            {...field}
            value={values.commitmentDuration || 'billing'}
            onValueChange={(value) =>
              onDuration(
                (value === 'billing' ? '' : value) as CreateSubscription['commitmentDuration'],
              )
            }
            options={[
              { value: 'billing', label: 'Same as billing period' },
              ...SUBSCRIPTION_BILLING_PERIODS.filter(
                (period) => period !== BillingPeriod.Daily && period !== BillingPeriod.Weekly,
              ).map((period) => ({
                value: period,
                label: BILLING_PERIOD_LABEL[period],
              })),
            ]}
          />
        )}
      </FormRow>
      <FormRow
        label="Overage factor"
        hint="Multiplier on spend beyond the commitment. 1 bills it at the normal rate."
        error={errors.overageFactor?.message}
      >
        {({ id, ...field }) => (
          <Input
            id={id}
            inputMode="decimal"
            placeholder="1"
            className="w-32"
            {...field}
            {...register('overageFactor')}
          />
        )}
      </FormRow>
      {/* True-up bills a shortfall against the commitment, so it needs one: without an
          amount the API drops it, and the switch would say on while nothing happens. */}
      <FormRow
        label="True-up"
        hint={
          hasCommitment(values.commitmentAmount)
            ? 'Bill the shortfall when spend stays under the commitment.'
            : 'Set a commitment amount above to bill a shortfall.'
        }
      >
        {({ id }) => (
          <Switch
            id={id}
            checked={values.enableTrueUp && hasCommitment(values.commitmentAmount)}
            disabled={!hasCommitment(values.commitmentAmount)}
            onCheckedChange={onTrueUp}
          />
        )}
      </FormRow>
    </FormCard>
  )
}

/** "Every billing period", "Daily", or "—". */
function resetsText(entitlement: Entitlement): string {
  if (entitlement.featureType !== FeatureType.Metered || !entitlement.usageResetPeriod) return '—'
  return entitlement.usageResetPeriod === 'MONTHLY'
    ? 'Every billing period'
    : USAGE_RESET_PERIOD_LABEL[entitlement.usageResetPeriod]
}

type EntitlementOverride = CreateSubscription['entitlementOverrides'][number]

const GRANT_UNIT_LABEL: Record<MeteredGrant['unit'], string> = {
  [EntitlementGrantDurationUnit.SubscriptionPeriod]: 'Every billing period',
  [EntitlementGrantDurationUnit.Hour]: 'Hourly',
  [EntitlementGrantDurationUnit.Day]: 'Daily',
  [EntitlementGrantDurationUnit.Week]: 'Weekly',
}

/** What the contract grants, in words: the override when there is one, else the plan's. */
function entitlementValueText(entitlement: Entitlement, override?: EntitlementOverride): string {
  if (override?.grant) {
    const { quota, measure } = override.grant
    if (quota === null) return 'Unlimited'
    const value = Number(quota).toLocaleString('en-US', { maximumFractionDigits: 20 })
    return measure === EntitlementGrantMeasure.Amount ? `${value} of usage value` : value
  }
  if (override?.usageLimit !== undefined) return override.usageLimit.toLocaleString('en-US')
  if (override?.staticValue !== undefined) return override.staticValue
  if (override?.isEnabled !== undefined) return override.isEnabled ? 'On' : 'Off'
  return planEntitlementValue(entitlement)
}

function entitlementResetsText(entitlement: Entitlement, override?: EntitlementOverride): string {
  if (override?.grant) {
    const { quota, unit, every } = override.grant
    if (quota === null) return '—'
    // As `meteredResetLabel` reads a grant: a longer window says how long.
    return every && unit !== EntitlementGrantDurationUnit.SubscriptionPeriod
      ? `Every ${every} ${unit}s`
      : GRANT_UNIT_LABEL[unit]
  }
  if (entitlement.featureType !== FeatureType.Metered) return '—'
  return meteredResetLabel(entitlement) ?? resetsText(entitlement)
}

/**
 * The plan's entitlements, as a table. A metered, static or on/off one can be
 * changed for this contract alone from its row, with the entitlement form's
 * own fields (a metered allowance's value type, value, window and stacking).
 * A config entitlement keeps the plan's.
 */
function EntitlementsSection({
  planLabel,
  entitlements,
  isLoading,
  overrides,
  onChange,
}: {
  planLabel: string | undefined
  entitlements: Entitlement[]
  isLoading: boolean
  overrides: EntitlementOverride[]
  onChange: (next: EntitlementOverride[]) => void
}) {
  const [editing, setEditing] = useState<Entitlement | null>(null)
  const overrideOf = (id: string) => overrides.find((o) => o.entitlementId === id)
  const nameOf = (entitlement: Entitlement) => entitlement.featureName ?? entitlement.featureId
  const editable = (entitlement: Entitlement) =>
    entitlement.featureType === FeatureType.Metered ||
    entitlement.featureType === FeatureType.Static ||
    entitlement.featureType === FeatureType.Boolean
  const columns: SimpleColumn<Entitlement>[] = [
    {
      key: 'feature',
      header: 'Feature',
      cell: (entitlement) => (
        <span className="flex items-center gap-1.5">
          <span className="font-medium">{nameOf(entitlement)}</span>
          {overrideOf(entitlement.id) ? (
            <Badge variant="outline" size="sm" className="shrink-0 font-normal">
              Changed
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      cell: (entitlement) => FEATURE_TYPE_LABEL[entitlement.featureType] ?? entitlement.featureType,
    },
    {
      key: 'allowance',
      header: 'Allowance',
      cell: (entitlement) => (
        <span className="tabular-nums">
          {entitlementValueText(entitlement, overrideOf(entitlement.id))}
        </span>
      ),
    },
    {
      key: 'resets',
      header: 'Resets',
      cell: (entitlement) => entitlementResetsText(entitlement, overrideOf(entitlement.id)),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10 text-right',
      cell: (entitlement) =>
        editable(entitlement) ? (
          <RowActionsMenu
            label={nameOf(entitlement)}
            onEdit={() => setEditing(entitlement)}
            extra={
              overrideOf(entitlement.id)
                ? [
                    {
                      label: 'Reset to plan',
                      icon: <RotateCcwIcon aria-hidden />,
                      onSelect: () =>
                        onChange(overrides.filter((o) => o.entitlementId !== entitlement.id)),
                    },
                  ]
                : undefined
            }
          />
        ) : null,
    },
  ]

  return (
    <FormCard
      title="Entitlements"
      icon={<KeyRoundIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />}
      description={`From the ${planLabel ? `${planLabel} ` : ''}plan. Change one for this contract alone from its row.`}
    >
      <div className="px-5 py-4 sm:px-6">
        <Frame>
          {isLoading ? (
            <EmptyLine>Loading the plan&apos;s entitlements…</EmptyLine>
          ) : entitlements.length === 0 ? (
            <EmptyLine>This plan includes no entitlements.</EmptyLine>
          ) : (
            <SimpleTable columns={columns} rows={entitlements} />
          )}
        </Frame>
      </div>
      <EntitlementOverrideDialog
        key={editing?.id ?? 'closed'}
        entitlement={editing}
        override={editing ? overrideOf(editing.id) : undefined}
        onClose={() => setEditing(null)}
        onSave={(next) => {
          if (!editing) return
          const rest = overrides.filter((o) => o.entitlementId !== editing.id)
          onChange(next ? [...rest, next] : rest)
          setEditing(null)
        }}
      />
    </FormCard>
  )
}

/**
 * One entitlement, changed for this contract: a metered allowance with the
 * entitlement form's `GrantAllowanceFields`, a static value, or on/off. Saving
 * the plan's own values clears the change rather than sending them again.
 */
function EntitlementOverrideDialog({
  entitlement,
  override,
  onClose,
  onSave,
}: {
  entitlement: Entitlement | null
  override: EntitlementOverride | undefined
  onClose: () => void
  /** null: back to the plan's. */
  onSave: (next: EntitlementOverride | null) => void
}) {
  // Edited the way it was made, as the entitlement form does: a grant with the
  // grant fields, an older usage limit as a limit. The override takes no reset
  // period, so a limit keeps the plan's (monthly, never, …); turning it into a
  // grant would change how often it renews.
  const planGrant = entitlement ? entitlementGrant(entitlement) : null
  const [grant, setGrant] = useState<MeteredGrant | null>(override?.grant ?? planGrant)
  const planLimit = entitlement?.usageLimit == null ? '' : String(entitlement.usageLimit)
  const [limit, setLimit] = useState(
    override?.usageLimit !== undefined ? String(override.usageLimit) : planLimit,
  )
  const [staticValue, setStaticValue] = useState(
    override?.staticValue ?? entitlement?.staticValue ?? '',
  )
  const [enabled, setEnabled] = useState(override?.isEnabled ?? Boolean(entitlement?.isEnabled))
  const [error, setError] = useState<string | undefined>(undefined)
  if (!entitlement) return null
  const id = entitlement.id
  const name = entitlement.featureName ?? entitlement.featureId

  const save = () => {
    switch (entitlement.featureType) {
      case FeatureType.Metered: {
        if (!planGrant) {
          const value = limit.trim()
          // Unchanged (an unlimited plan limit left blank, too): back to the plan's.
          if (value === planLimit) return onSave(null)
          if (!/^\d+$/.test(value)) {
            setError('Enter a whole number')
            return
          }
          // The API keeps the limit as a 64-bit integer; past this it would not survive JSON.
          if (!Number.isSafeInteger(Number(value))) {
            setError('Enter a smaller number')
            return
          }
          return onSave({ entitlementId: id, usageLimit: Number(value) })
        }
        const parsed = meteredGrantSchema.safeParse(grant)
        if (!parsed.success || !grant) {
          setError(parsed.error?.issues[0]?.message ?? 'Enter a value above zero')
          return
        }
        const same = JSON.stringify(grant) === JSON.stringify(planGrant)
        // The API reads a missing usage limit as none, so an older limit is kept as it was.
        return onSave(
          same
            ? null
            : {
                entitlementId: id,
                grant,
                ...(entitlement.usageLimit != null ? { usageLimit: entitlement.usageLimit } : {}),
              },
        )
      }
      case FeatureType.Static: {
        const value = staticValue.trim()
        if (!value) {
          setError('Enter a value')
          return
        }
        return onSave(
          value === (entitlement.staticValue ?? '')
            ? null
            : { entitlementId: id, staticValue: value },
        )
      }
      default:
        return onSave(
          enabled === Boolean(entitlement.isEnabled)
            ? null
            : { entitlementId: id, isEnabled: enabled },
        )
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={`Edit entitlement · ${name}`}
      size={entitlement.featureType === FeatureType.Metered ? 'lg' : 'sm'}
    >
      <Composer submitLabel="Save entitlement" onCancel={onClose} onSubmit={save}>
        <p className="text-muted-foreground text-[13px]">
          For this contract only. The plan keeps its own: {planEntitlementValue(entitlement)}.
        </p>
        {entitlement.featureType === FeatureType.Metered && !planGrant ? (
          <Field
            label="Usage limit"
            hint={`The allowance for this contract. It resets as on the plan: ${resetsText(entitlement).toLowerCase()}.`}
            error={error}
          >
            {({ id: fieldId, ...field }) => (
              <Input
                id={fieldId}
                inputMode="numeric"
                placeholder={planLimit ? undefined : 'Unlimited on the plan'}
                {...field}
                value={limit}
                onChange={(event) => {
                  setLimit(event.target.value)
                  setError(undefined)
                }}
              />
            )}
          </Field>
        ) : null}
        {entitlement.featureType === FeatureType.Metered && planGrant && grant ? (
          <GrantAllowanceFields
            value={grant}
            onChange={(next) => {
              setGrant(next)
              setError(undefined)
            }}
            quotaError={error}
          />
        ) : null}
        {entitlement.featureType === FeatureType.Static ? (
          <Field label="Value" hint="How much of the feature this contract includes." error={error}>
            {({ id: fieldId, ...field }) => (
              <Input
                id={fieldId}
                {...field}
                value={staticValue}
                onChange={(event) => {
                  setStaticValue(event.target.value)
                  setError(undefined)
                }}
              />
            )}
          </Field>
        ) : null}
        {entitlement.featureType === FeatureType.Boolean ? (
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            Enabled on this contract
          </label>
        ) : null}
      </Composer>
    </FormDialog>
  )
}

/**
 * The contract's credit grants, as a table. They open as the plan's own, and
 * each can be edited or removed for this contract alone, or new ones added.
 * The API uses a changed list *instead of* the plan's, so the card says when
 * that happens and offers the way back.
 */
function CreditsSection({
  grants,
  changed,
  fromPlan,
  onChange,
  onReset,
}: {
  grants: CreateCreditGrant[]
  changed: boolean
  fromPlan: boolean
  onChange: (next: CreateCreditGrant[]) => void
  onReset: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  type Row = { grant: CreateCreditGrant; index: number }
  const columns: SimpleColumn<Row>[] = [
    {
      key: 'grant',
      header: 'Grant',
      cell: ({ grant }) => <span className="font-medium">{grant.name}</span>,
    },
    {
      key: 'credits',
      header: 'Credits',
      cell: ({ grant }) => (
        <span className="tabular-nums">{Number(grant.credits || 0).toLocaleString('en-US')}</span>
      ),
    },
    { key: 'granted', header: 'Granted', cell: ({ grant }) => grantCadenceText(grant) },
    { key: 'expires', header: 'Expires', cell: ({ grant }) => grantExpiryText(grant) },
    { key: 'priority', header: 'Priority', cell: ({ grant }) => grant.priority },
    {
      key: 'actions',
      header: '',
      className: 'w-0 text-right',
      cell: ({ grant, index }) => (
        <RowActionsMenu
          label={grant.name}
          onEdit={() => setEditing(index)}
          onRemove={() => {
            setEditing(null)
            onChange(grants.filter((_, i) => i !== index))
          }}
          removeLabel={`Remove ${grant.name}`}
        />
      ),
    },
  ]
  const editingGrant = editing === null ? undefined : grants[editing]

  return (
    <>
      <FormCard
        title="Credit grants"
        status="optional"
        icon={<CoinsIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />}
        adornment={
          <>
            {fromPlan && changed ? (
              <Button type="button" variant="ghost" size="sm" onClick={onReset}>
                Use the plan&apos;s grants
              </Button>
            ) : null}
            <AddButton onClick={() => setAdding(true)} disabled={adding}>
              Add credit grant
            </AddButton>
          </>
        }
        {...(fromPlan && changed
          ? { description: "These grants replace the plan's on this contract." }
          : {})}
      >
        <div className="flex flex-col gap-3 px-5 py-4 sm:px-6">
          <Frame>
            {grants.length > 0 ? (
              <SimpleTable
                columns={columns}
                rows={grants.map((grant, index) => ({ grant, index }))}
                getRowId={(row) => `${row.grant.name}-${row.index}`}
              />
            ) : (
              <EmptyLine>
                {fromPlan
                  ? "All of the plan's grants are removed from this contract."
                  : 'No credit grants.'}
              </EmptyLine>
            )}
          </Frame>
        </div>
      </FormCard>
      {/* Outside the card, which draws a row per child. Add and edit open in a dialog, as on a contract's own page, not as a panel
          that pushes the rest of the step down. */}
      <FormDialog
        open={editingGrant !== undefined}
        onOpenChange={(next) => (next ? undefined : setEditing(null))}
        title={editingGrant ? `Edit ${editingGrant.name}` : 'Edit credit grant'}
      >
        {editingGrant ? (
          <CreditGrantCreateForm
            key={editing}
            defaultValue={editingGrant}
            submitLabel="Save grant"
            onSubmit={(next) => {
              onChange(grants.map((g, i) => (i === editing ? next : g)))
              setEditing(null)
            }}
          />
        ) : null}
      </FormDialog>
      <FormDialog
        open={adding}
        onOpenChange={(next) => (next ? undefined : setAdding(false))}
        title="Add credit grant"
      >
        <CreditGrantCreateForm
          submitLabel="Add grant"
          onSubmit={(grant) => {
            onChange([...grants, grant])
            setAdding(false)
          }}
        />
      </FormDialog>
    </>
  )
}

/** The contract's tax rates: the customer's to start with, removable, and addable. */
function TaxesSection({
  taxes,
  taxRates,
  createTaxRateHref,
  onChange,
}: {
  taxes: CreateSubscription['taxes']
  taxRates: readonly SubscriptionTaxRateOption[]
  createTaxRateHref?: string | undefined
  onChange: (next: CreateSubscription['taxes']) => void
}) {
  const available = taxRates.filter((rate) => !taxes.some((tax) => tax.taxRateCode === rate.code))
  type Tax = CreateSubscription['taxes'][number]
  const columns: SimpleColumn<Tax>[] = [
    {
      key: 'name',
      header: 'Tax rate',
      cell: (tax) => <span className="font-medium">{tax.name || tax.taxRateCode}</span>,
    },
    {
      key: 'code',
      header: 'Code',
      cell: (tax) => (
        <span className="text-muted-foreground font-mono text-xs">{tax.taxRateCode}</span>
      ),
    },
    {
      key: 'rate',
      header: 'Rate',
      className: 'text-right tabular-nums',
      cell: (tax) => (tax.percentage ? `${tax.percentage}%` : '—'),
    },
    {
      key: 'remove',
      header: '',
      className: 'w-10 text-right',
      cell: (tax) => (
        <RemoveButton
          label={`Remove ${tax.name || tax.taxRateCode}`}
          onClick={() => onChange(taxes.filter((t) => t.taxRateCode !== tax.taxRateCode))}
        />
      ),
    },
  ]
  return (
    <FormCard
      title="Taxes"
      status="optional"
      icon={<ReceiptIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />}
      // The card's action, in its header in every state (design rules §2):
      // opened in a new tab so this draft survives.
      {...(createTaxRateHref
        ? {
            adornment: (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<a href={createTaxRateHref} target="_blank" rel="noreferrer" />}
              >
                <ExternalLinkIcon aria-hidden />
                Create a tax rate
              </Button>
            ),
          }
        : {})}
    >
      {taxes.length > 0 ? (
        <div className="px-5 pt-4 sm:px-6">
          <Frame>
            <SimpleTable columns={columns} rows={taxes} getRowId={(tax) => tax.taxRateCode} />
          </Frame>
        </div>
      ) : null}
      <FormRow
        label={taxes.length > 0 ? 'Add another' : 'Tax rate'}
        hint="Taxes added to every invoice of this contract."
      >
        {({ id, ...field }) =>
          taxRates.length === 0 ? (
            <p className="text-muted-foreground text-sm">No tax rates exist yet.</p>
          ) : (
            <OptionSelect
              // A fresh picker after each pick, so it reads empty again.
              key={taxes.length}
              id={id}
              {...field}
              value={undefined}
              placeholder={taxes.length > 0 ? 'Add another tax rate…' : 'Choose a tax rate…'}
              options={available.map((rate) => ({
                value: rate.code,
                label: `${rate.name}${rate.percentage ? ` (${rate.percentage}%)` : ''}`,
              }))}
              onValueChange={(code) => {
                const rate = available.find((r) => r.code === code)
                if (!rate) return
                onChange([
                  ...taxes,
                  {
                    taxRateCode: rate.code,
                    name: rate.name,
                    percentage: rate.percentage,
                    taxBehavior: 'exclusive',
                    priority: taxes.length + 1,
                    autoApply: true,
                  },
                ])
              }}
            />
          )
        }
      </FormRow>
    </FormCard>
  )
}

/* ------------------------------------------------------------------------- */
/* Billing                                                                   */
/* ------------------------------------------------------------------------- */

/** How and when the contract invoices, and who pays. */
const ISO_CURRENCIES = new Set(currencyCodes().map((code) => code.toLowerCase()))
/** An ISO 4217 code, as the browser knows them; a custom currency is never one. */
function isoCurrency(code: string): boolean {
  return ISO_CURRENCIES.has(code.toLowerCase())
}

/** A contract billed in one currency and invoiced in another. */
interface FxConversion {
  /** Lower-case codes: the contract's currency, and the invoicing customer's. */
  from: string
  to: string
  /** The global rate for the pair, when one is known. */
  globalRate: string | undefined
  /**
   * Set when the contract's currency is a custom one: its factor to the
   * billing currency (empty when it has none). It converts at that, and takes
   * no rate of its own.
   */
  customFactor: string | undefined
  /** Known to have no conversion for the pair: the API would refuse the contract. */
  missing: boolean
  /** Not known either way (the currency settings did not load): said, never blocking. */
  warning: string | undefined
}

/**
 * The exchange rate this contract converts at, when its invoices go out in the
 * invoicing customer's billing currency: the global rate unless the contract
 * sets its own (`fx_rates`), for a window if it likes, as FxRatesSection's
 * override dialog has it.
 */
function CurrencyConversionCard({
  fx,
  value,
  onChange,
  error,
  rateError,
  endError,
  isSubmitting,
}: {
  fx: FxConversion
  value: CreateSubscription['fxRates'][number]
  onChange: (next: CreateSubscription['fxRates'][number]) => void
  error: string | undefined
  rateError: string | undefined
  endError: string | undefined
  isSubmitting: boolean
}) {
  const from = fx.from.toUpperCase()
  const to = fx.to.toUpperCase()
  const set = (patch: Partial<CreateSubscription['fxRates'][number]>) =>
    onChange({ ...value, ...patch })
  return (
    <FormCard
      title="Currency conversion"
      icon={<CoinsIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />}
      description={`This contract bills in ${from}; its invoices go out in ${to}, the billing customer's currency.`}
    >
      {error ? (
        <div className="px-5 pt-4 sm:px-6">
          <Alert variant="destructive">
            <InfoIcon aria-hidden />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      ) : null}
      {fx.warning && !error ? (
        <div className="px-5 pt-4 sm:px-6">
          <Alert variant="warning">
            <InfoIcon aria-hidden />
            <AlertDescription>{fx.warning}</AlertDescription>
          </Alert>
        </div>
      ) : null}
      {fx.customFactor !== undefined ? (
        <FormRow
          label="Conversion"
          hint="A custom currency converts at its own factor, set in the custom currency settings."
        >
          <p className="text-sm tabular-nums">
            {fx.customFactor ? `1 ${from} = ${fx.customFactor} ${to}` : 'No factor set'}
          </p>
        </FormRow>
      ) : (
        <FormRow
          label="Exchange rate"
          hint={`One ${from} in ${to}. Leave empty to convert at the global rate.`}
          error={rateError}
        >
          {({ id, ...field }) => (
            <InputGroup className="h-9">
              <InputGroupAddon align="inline-start">{`1 ${from} =`}</InputGroupAddon>
              <InputGroupInput
                id={id}
                {...field}
                inputMode="decimal"
                placeholder={fx.globalRate ? `${fx.globalRate} (global rate)` : 'Global rate'}
                value={value.rate}
                onChange={(event) => set({ rate: event.target.value })}
                disabled={isSubmitting}
              />
              <InputGroupAddon align="inline-end">{to}</InputGroupAddon>
            </InputGroup>
          )}
        </FormRow>
      )}
      {fx.customFactor === undefined && value.rate ? (
        <FormRow
          label="Valid"
          hint="When this rate applies. Open-ended on either side when left empty."
          error={endError}
          align="start"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Valid from">
              {({ id, ...field }) => (
                <DateInput
                  id={id}
                  {...field}
                  withTime
                  value={value.startDate}
                  onValueChange={(startDate) => set({ startDate })}
                  placeholder="Always"
                  clearable
                  clearLabel="Clear start"
                  disabled={isSubmitting}
                />
              )}
            </Field>
            <Field label="Valid until">
              {({ id, ...field }) => (
                <DateInput
                  id={id}
                  {...field}
                  withTime
                  value={value.endDate}
                  onValueChange={(endDate) => set({ endDate })}
                  placeholder="No end"
                  clearable
                  clearLabel="Clear end"
                  disabled={isSubmitting}
                />
              )}
            </Field>
          </div>
        </FormRow>
      ) : null}
    </FormCard>
  )
}

function BillingStep({
  values,
  errors,
  register,
  isSubmitting,
  customers,
  inheritanceBlocks,
  onChange,
  whoPays,
  onWhoPays,
  hasFixedCharges,
  fx,
}: {
  values: CreateSubscription
  errors: FieldErrors<CreateSubscription>
  register: UseFormRegister<CreateSubscription>
  isSubmitting: boolean
  customers: readonly SubscriptionCustomerOption[]
  inheritanceBlocks: Readonly<Record<string, InheritanceBlock>>
  onChange: <K extends keyof CreateSubscription>(name: K, value: CreateSubscription[K]) => void
  whoPays: WhoPays
  onWhoPays: (next: WhoPays) => void
  /** Fixed charges bill each period, so there is no early invoice to trigger. */
  hasFixedCharges: boolean
  /** Set when invoices go out in another currency than the contract's. */
  fx?: FxConversion | undefined
}) {
  // Another customer is chosen by external id, which is what the API takes.
  const others = customers.filter((c) => c.externalId && c.value !== values.customerId)
  const payerOptions = others.map((c) => ({ value: c.externalId!, label: c.label }))
  // A customer the API would refuse is listed, greyed, with the reason.
  const inheritable = others
    .filter((c) => !values.inheritedCustomerExternalIds.includes(c.externalId!))
    .map((c) => {
      const block = inheritanceBlocks[c.value]
      return block
        ? {
            value: c.externalId!,
            label: c.label,
            hint: INHERITANCE_BLOCK_LABEL[block],
            disabled: true,
          }
        : { value: c.externalId!, label: c.label }
    })
  const nameOf = (externalId: string) =>
    payerOptions.find((o) => o.value === externalId)?.label ?? externalId
  const [pickerKey, setPickerKey] = useState(0)

  return (
    <>
      <FormCard
        title="Payment"
        icon={<WalletIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />}
      >
        <FormRow label="Payment terms" hint="How long the customer has to pay each invoice.">
          {({ id, ...field }) => (
            <OptionSelect
              id={id}
              {...field}
              value={values.paymentTerms || 'none'}
              onValueChange={(value) =>
                onChange(
                  'paymentTerms',
                  (value === 'none' ? '' : value) as CreateSubscription['paymentTerms'],
                )
              }
              options={[
                { value: 'none', label: 'Due on receipt' },
                ...Object.values(PaymentTerms).map((terms) => ({
                  value: terms,
                  label: PAYMENT_TERMS_LABEL[terms],
                })),
              ]}
              disabled={isSubmitting}
            />
          )}
        </FormRow>
      </FormCard>
      <FormCard
        title="Customer hierarchy"
        icon={<UsersIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />}
      >
        <FormRow
          label="Billing customer"
          hint="Invoices for this contract go to this customer."
          align="start"
        >
          <ChoiceCards
            label="Billing customer"
            value={whoPays}
            onChange={(next) => {
              onWhoPays(next)
              if (next === WhoPays.Same) onChange('invoicingCustomerExternalId', '')
            }}
            choices={[
              {
                value: WhoPays.Same,
                title: 'Same customer',
                description: 'Invoices go to the customer on this contract.',
              },
              {
                value: WhoPays.Another,
                title: 'Another customer',
                description: 'A parent account pays, e.g. a holding company.',
              },
            ]}
          />
        </FormRow>
        {whoPays === WhoPays.Another ? (
          <FormRow
            label="Invoiced to"
            hint="The customer that receives and pays the invoices."
            error={errors.invoicingCustomerExternalId?.message}
          >
            {({ id, ...field }) => (
              <OptionCombobox
                id={id}
                {...field}
                value={values.invoicingCustomerExternalId}
                onValueChange={(value) => onChange('invoicingCustomerExternalId', value)}
                options={payerOptions}
                placeholder="Search the paying customer…"
                emptyText="No other customer has an external ID."
                disabled={isSubmitting}
              />
            )}
          </FormRow>
        ) : null}
        <FormRow
          label="Inherited customers"
          hint="Customers that share this contract's charges, entitlements and credits. Their usage is invoiced to this contract's customer, so the billing customer stays the same."
          align="start"
          error={errors.inheritedCustomerExternalIds?.message}
        >
          {({ id, ...field }) => (
            <div className="flex flex-col gap-2">
              {values.inheritedCustomerExternalIds.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  {values.inheritedCustomerExternalIds.map((externalId) => (
                    <li key={externalId}>
                      <Badge variant="secondary" className="gap-1 pr-1">
                        {nameOf(externalId)}
                        <button
                          type="button"
                          aria-label={`Remove ${nameOf(externalId)}`}
                          className="hover:text-foreground rounded-sm"
                          onClick={() =>
                            onChange(
                              'inheritedCustomerExternalIds',
                              values.inheritedCustomerExternalIds.filter((e) => e !== externalId),
                            )
                          }
                        >
                          <XIcon aria-hidden className="size-3" />
                        </button>
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : null}
              <OptionCombobox
                key={pickerKey}
                id={id}
                {...field}
                value=""
                onValueChange={(value) => {
                  if (!value) return
                  onChange('inheritedCustomerExternalIds', [
                    ...values.inheritedCustomerExternalIds,
                    value,
                  ])
                  setPickerKey((n) => n + 1)
                }}
                options={inheritable}
                placeholder={
                  values.inheritedCustomerExternalIds.length > 0
                    ? 'Add another customer…'
                    : 'Add customers to inherit…'
                }
                emptyText="No other customer has an external ID."
                disabled={isSubmitting}
              />
            </div>
          )}
        </FormRow>
      </FormCard>
      {fx ? (
        <CurrencyConversionCard
          fx={fx}
          value={values.fxRates[0] ?? { rate: '', startDate: '', endDate: '' }}
          onChange={(next) => onChange('fxRates', [next])}
          error={(errors.fxRates as { message?: string } | undefined)?.message}
          rateError={errors.fxRates?.[0]?.rate?.message}
          endError={errors.fxRates?.[0]?.endDate?.message}
          isSubmitting={isSubmitting}
        />
      ) : null}
      <FormCard
        title="Other settings"
        icon={<Settings2Icon aria-hidden className="text-muted-foreground size-4 shrink-0" />}
      >
        <FormRow
          label="Auto-invoice threshold"
          hint="Invoice early once unbilled usage reaches this amount. Leave empty to invoice each period."
          error={errors.autoInvoiceThreshold?.message}
        >
          {({ id, ...field }) =>
            hasFixedCharges ? (
              // No currency addon here: a disabled addon reads too faint to pass contrast.
              <Input
                id={id}
                {...field}
                className="h-9"
                placeholder="Not available: the plan has fixed charges"
                disabled
              />
            ) : (
              <InputGroup className="h-9">
                <InputGroupAddon align="inline-start">
                  {values.currency.toUpperCase() || '—'}
                </InputGroupAddon>
                <InputGroupInput
                  id={id}
                  inputMode="decimal"
                  placeholder="Each period"
                  disabled={isSubmitting}
                  {...field}
                  {...register('autoInvoiceThreshold')}
                />
              </InputGroup>
            )
          }
        </FormRow>
      </FormCard>
    </>
  )
}

/* ------------------------------------------------------------------------- */
/* Review                                                                    */
/* ------------------------------------------------------------------------- */

/**
 * Everything the contract will be, one card per step, each with its Edit.
 * A row names what was chosen and how many: the step itself holds the
 * detail: except the charges this deal changes, which are listed one by one
 * (the first eight, then how many more) so a long plan still says exactly
 * what differs from it.
 */
function ReviewStep({
  values,
  customerLabel,
  planLabel,
  charges,
  entitlements,
  coupons,
  addons,
  repricedOf,
  customers,
  showCustomer,
  today,
  onEdit,
  whoPays,
  hasFixedCharges,
}: {
  values: CreateSubscription
  /** How many of an add-on's charges are repriced, counting only what is sent. */
  repricedOf: (addon: CreateSubscription['addons'][number]) => number
  customerLabel: string | undefined
  planLabel: string | undefined
  charges: Charge[]
  entitlements: Entitlement[]
  coupons: readonly SubscriptionCouponOption[]
  addons: readonly Option[]
  customers: readonly SubscriptionCustomerOption[]
  showCustomer: boolean
  today: string
  onEdit: (stepId: string) => void
  whoPays: WhoPays
  hasFixedCharges: boolean
}) {
  const starts = phaseStarts(values)
  const couponOf = (id: string) => coupons.find((c) => c.value === id)
  const couponName = (id: string) => couponOf(id)?.label ?? id
  const customerByExternalId = (externalId: string) =>
    customers.find((c) => c.externalId === externalId)?.label ?? externalId
  // Labels as written ("Monthly", "Every 3 months"), not the lowercased enum.
  const period = BILLING_PERIOD_LABEL[values.billingPeriod]
  const every = everyPeriod(values.billingPeriod, values.billingPeriodCount)
  const billing =
    values.billingPeriodCount > 1
      ? `${values.currency.toUpperCase()} · ${every.charAt(0).toUpperCase()}${every.slice(1)}`
      : `${values.currency.toUpperCase()} · ${period}`
  const changedEntitlements = values.entitlementOverrides.length
  const end = values.phases[values.phases.length - 1]?.endDate ?? ''
  const single = values.phases.length === 1
  const phase = values.phases[0]!
  const allDiscounts = values.phases.flatMap((p) => p.discounts)
  const wholeDiscounts = allDiscounts.filter((d) => !d.priceId)
  const chargeDiscounts = allDiscounts.length - wholeDiscounts.length

  // What this contract changes, charge by charge: added ones first, as the table lists them.
  const changed: { key: string; name: string; parts: string[] }[] = [
    ...phase.extraCharges.map((extra, index) => ({
      key: `extra-${index}`,
      name: extra.charge.displayName || 'Contract charge',
      parts: [`added at ${extraPriceText(extra)}`],
    })),
    ...charges.flatMap((charge) => {
      const override = phase.priceOverrides.find((o) => o.priceId === charge.id)
      const quantity = phase.quantities.find((q) => q.priceId === charge.id)
      const commitment = values.chargeCommitments.find((c) => c.priceId === charge.id)
      const discount = phase.discounts.find((d) => d.priceId === charge.id)
      const coupon = discount ? couponOf(discount.couponId) : undefined
      const parts = [
        override ? `${priceText(charge, override)} (was ${priceText(charge, undefined)})` : null,
        quantity ? `quantity ${quantity.quantity}` : null,
        commitment
          ? commitmentText(commitment, values.currency).replace(/^Commits/, 'commits')
          : null,
        discount
          ? coupon?.discount
            ? `${coupon.discount} off${coupon.code ? ` (${coupon.code})` : ''}`
            : `coupon ${coupon?.label ?? discount.couponId}`
          : null,
      ].filter((part): part is string => part !== null)
      return parts.length > 0 ? [{ key: charge.id, name: chargeName(charge), parts }] : []
    }),
  ]
  const billed = charges.length + phase.extraCharges.length

  return (
    <div className="flex flex-col gap-5">
      <ReviewCard title="Contract" step="plan" onEdit={onEdit}>
        {showCustomer ? <ReviewRow label="Customer" value={customerLabel ?? '—'} /> : null}
        <ReviewRow label="Plan" value={planLabel ?? '—'} />
        <ReviewRow label="Billing" value={billing} />
        <ReviewRow
          label="Runs"
          value={`${formatDay(values.startDate || today)} → ${end ? formatDay(end) : 'until cancelled'}`}
        />
        <ReviewRow
          label="Bill on"
          value={
            values.billingAnchor
              ? `On ${formatDay(values.billingAnchor)}`
              : values.billingCycle === BillingCycle.Calendar
                ? calendarTitle(values.billingPeriod)
                : 'The contract start date'
          }
        />
        <ReviewRow
          label="Free trial"
          value={values.trialPeriodDays ? `${values.trialPeriodDays} days` : 'None'}
        />
        <ReviewRow label="Proration" value={values.prorate ? 'Prorates changes' : 'No proration'} />
      </ReviewCard>

      <ReviewCard title="Charges & add-ons" step="phases" onEdit={onEdit}>
        {single ? (
          <>
            <ReviewRow
              label="Charges"
              value={`${chargeCountText(billed)} · ${
                changed.length > 0
                  ? `${changed.length} changed from the plan`
                  : "all at the plan's prices"
              }${phase.extraCharges.length > 0 ? ` · ${phase.extraCharges.length} added` : ''}`}
            />
          </>
        ) : (
          values.phases.map((p, index) => {
            const count = charges.length + p.extraCharges.length
            const detail = [
              `${formatDay(starts[index] || (index === 0 ? today : ''))} → ${
                p.endDate ? formatDay(p.endDate) : 'until cancelled'
              }`,
              chargeCountText(count),
              p.priceOverrides.length > 0 ? `${p.priceOverrides.length} repriced` : null,
              p.extraCharges.length > 0 ? `${p.extraCharges.length} added` : null,
            ]
              .filter(Boolean)
              .join(' · ')
            return (
              <div key={index}>
                <ReviewRow label={`Phase ${index + 1}`} value={detail} />
                {p.priceOverrides.map((override) => {
                  const charge = charges.find((c) => c.id === override.priceId)
                  return charge ? (
                    <ReviewRow
                      key={override.priceId}
                      label={chargeName(charge)}
                      value={`${priceText(charge, override)} (was ${priceText(charge, undefined)})`}
                      nested
                    />
                  ) : null
                })}
              </div>
            )
          })
        )}
        <ReviewRow
          label="Discount"
          value={
            [
              wholeDiscounts.length > 0
                ? wholeDiscounts
                    .map((d) => {
                      const coupon = couponOf(d.couponId)
                      return coupon?.discount
                        ? `${coupon.label} (${coupon.discount} off)`
                        : couponName(d.couponId)
                    })
                    .join(', ')
                : null,
              chargeDiscounts > 0 ? `${chargeDiscounts} on single charges` : null,
            ]
              .filter(Boolean)
              .join(' · ') || 'None'
          }
        />
        <ReviewRow
          label="Add-ons"
          value={
            values.addons.length === 0
              ? 'None'
              : `${values.addons.length}: ${values.addons
                  .map(
                    (addon) =>
                      `${
                        addon.name ||
                        addons.find((a) => a.value === addon.addonId)?.label ||
                        addon.addonId
                      }${repricedOf(addon) > 0 ? ` (${repricedOf(addon)} repriced)` : ''}`,
                  )
                  .join(', ')}`
          }
        />
      </ReviewCard>

      <ReviewCard title="Commitments & benefits" step="commitments" onEdit={onEdit}>
        <ReviewRow
          label="Contract commitment"
          value={
            values.commitmentAmount
              ? `${money(values.commitmentAmount, values.currency)} minimum per ${
                  values.commitmentDuration
                    ? periodNoun(values.commitmentDuration)
                    : periodNoun(values.billingPeriod)
                }${values.enableTrueUp ? ', with true-up' : ''}`
              : 'None'
          }
        />
        <ReviewRow
          label="Entitlements"
          value={
            entitlements.length === 0
              ? 'None'
              : `${entitlements.length}, from the plan${
                  changedEntitlements > 0 ? ` · ${changedEntitlements} changed` : ''
                }`
          }
        />
        <ReviewRow
          label="Credit grants"
          value={
            values.creditGrants.length === 0
              ? 'None'
              : // A count and where they came from; the grants step lists each one.
                `${values.creditGrants.length}${
                  values.creditGrantsChanged
                    ? ' · changed from the plan'
                    : planLabel
                      ? ` · from ${planLabel}`
                      : ''
                }`
          }
        />
        <ReviewRow
          label="Taxes"
          value={
            values.taxes.length === 0
              ? 'None'
              : values.taxes
                  .map(
                    (tax) =>
                      `${tax.name || tax.taxRateCode}${tax.percentage ? ` ${tax.percentage}%` : ''}`,
                  )
                  .join(', ')
          }
        />
      </ReviewCard>

      <ReviewCard title="Billing" step="billing" onEdit={onEdit}>
        <ReviewRow
          label="Payment terms"
          value={values.paymentTerms ? PAYMENT_TERMS_LABEL[values.paymentTerms] : 'Due on receipt'}
        />
        <ReviewRow
          label="Billing customer"
          value={
            whoPays === WhoPays.Same
              ? 'Same customer'
              : values.invoicingCustomerExternalId
                ? customerByExternalId(values.invoicingCustomerExternalId)
                : 'Not chosen'
          }
        />
        <ReviewRow
          label="Inherited customers"
          value={
            values.inheritedCustomerExternalIds.length === 0
              ? 'None'
              : values.inheritedCustomerExternalIds.map(customerByExternalId).join(', ')
          }
        />
        <ReviewRow
          label="Auto-invoice threshold"
          value={
            values.autoInvoiceThreshold && !hasFixedCharges
              ? `${values.currency.toUpperCase()} ${values.autoInvoiceThreshold}`
              : 'Each period'
          }
        />
      </ReviewCard>
    </div>
  )
}

/** What the plan grants, in words. */
function planEntitlementValue(entitlement: Entitlement): string {
  switch (entitlement.featureType) {
    case FeatureType.Metered:
      // The grant's value when it has grant config, else its usage limit.
      return meteredAllowanceLabel(entitlement)
    case FeatureType.Static:
      return entitlement.staticValue || '—'
    default:
      return entitlement.isEnabled ? 'On' : 'Off'
  }
}

/** "Every month", "Every 3 × month", or "Once". */
function grantCadenceText(grant: CreateSubscription['creditGrants'][number]): string {
  if (grant.cadence !== CreditGrantCadence.Recurring || !grant.period) {
    return CREDIT_GRANT_CADENCE_LABEL[grant.cadence]
  }
  const period = CREDIT_GRANT_PERIOD_LABEL[grant.period]
  return grant.periodCount && grant.periodCount > 1
    ? `Every ${grant.periodCount} × ${period.toLowerCase()}`
    : `Every ${period.toLowerCase()}`
}

/** "Never expires", "Expires with the billing cycle", or "Expires after 30 days". */
function grantExpiryText(grant: CreateSubscription['creditGrants'][number]): string {
  if (
    grant.expirationType === CreditGrantExpiryType.Duration &&
    grant.expirationDuration &&
    grant.expirationDurationUnit
  ) {
    const unit = CREDIT_GRANT_EXPIRY_DURATION_UNIT_LABEL[grant.expirationDurationUnit].toLowerCase()
    return `Expires after ${grant.expirationDuration} ${unit}${grant.expirationDuration === 1 ? '' : 's'}`
  }
  return CREDIT_GRANT_EXPIRY_TYPE_LABEL[grant.expirationType]
}

function ReviewCard({
  title,
  step,
  onEdit,
  count,
  children,
}: {
  title: string
  step: string
  onEdit: (stepId: string) => void
  /** How many rows the card holds, beside its title. */
  count?: number
  children: ReactNode
}) {
  return (
    <FormCard
      title={count === undefined ? title : `${title} (${count})`}
      adornment={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          aria-label={`Edit ${title.toLowerCase()}`}
          onClick={() => onEdit(step)}
        >
          <PencilIcon data-icon="inline-start" aria-hidden />
          Edit
        </Button>
      }
    >
      {children}
    </FormCard>
  )
}

/** A label and its value, side by side and left-aligned, as the reference review reads. */
function ReviewRow({
  label,
  value,
  nested = false,
  strong = false,
}: {
  label: string
  value: ReactNode
  /** A detail under the row before it, e.g. a repriced charge under its phase. */
  nested?: boolean
  strong?: boolean
}) {
  return (
    <div
      className={
        'grid gap-1 px-5 py-3 text-sm sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:gap-4 sm:px-6' +
        (nested ? ' pt-0' : '')
      }
    >
      <span className={nested ? 'text-muted-foreground pl-4 text-xs' : 'text-muted-foreground'}>
        {label}
      </span>
      <div
        className={
          nested
            ? 'text-muted-foreground text-xs'
            : strong
              ? 'text-base font-medium tabular-nums'
              : 'text-foreground'
        }
      >
        {value}
      </div>
    </div>
  )
}
