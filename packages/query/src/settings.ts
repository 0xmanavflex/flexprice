import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import {
  ApiError,
  ErrorKind,
  SettingKey,
  type AuthSource,
  type WebhookDashboard,
  deleteSetting,
  fetchWebhookDashboard,
  getSetting,
  putSetting,
} from '@fp/api'
import {
  AlertCondition,
  AlertThresholdType,
  type CustomCurrencyConfig,
  type CustomCurrencyDefinition,
  type CustomerOnboarding,
  type CustomerPortalConfig,
  type InvoiceConfig,
  OnboardingAction,
  type OnboardingActionConfig,
  OnboardingWalletType,
  type PortalSection,
  type PortalTab,
  SAML_UNAVAILABLE,
  type SamlConfig,
  type SamlDefaultRole,
  type SamlSettings,
  type SubscriptionConfig,
  type WalletAlertConfig,
  type WalletAlertThreshold,
  defaultInvoiceConfig,
  defaultSamlConfig,
  defaultSubscriptionConfig,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexpriceAuth, useFlexpriceServerURL } from './provider'

/**
 * The Settings screens' data, which the SDK cannot fetch.
 *
 * `settings.go` has no swagger annotations, so `GET/PUT/DELETE
 * /settings/{key}` are absent from the OpenAPI document and from the generated
 * client. An earlier pass through this workspace read that absence as "these
 * screens have no backend contract" and left eight tabs rendering an
 * unavailable state. The routes were live the whole time; only SAML is
 * genuinely off. `@fp/api`'s `settings.ts` reaches them with `fetch`, and this
 * is the door the UI comes through.
 *
 * ## Every hook here takes an environment id
 *
 * These records are per environment, and the route refuses to answer without
 * `X-Environment-ID`: 403, not an empty result. The id is a parameter rather
 * than something read from context for two reasons. It is the same shape as
 * `useCurrentUser(token)`: the session holds it, and the hooks that need it
 * say so. And it is what the query key is built from, so passing it explicitly
 * makes the key and the request header provably the same value: a hook that
 * keyed on one environment and fetched another would file the new
 * environment's settings under the old one's key during a switch, which is a
 * cache poisoning nobody would find.
 *
 * `null` means "no environment yet" and disables the query. No request, no
 * error, no spinner: the state a console is in for the first moment after
 * sign-in.
 *
 * The **token** is not a parameter, because a token in a hook signature is a
 * token in a component. It is read per request from the same `AuthSource` the
 * SDK client uses, through `useFlexpriceAuth()`.
 *
 * ## Reads, writes and resets
 *
 * A read always succeeds with something renderable: a key that has never been
 * written answers 200 with the backend's defaults. A write sends the whole
 * value: `PUT` merges the top level and nothing below it, so a partial
 * `sections` array is a deletion, not an edit. A reset deletes the stored row
 * and reads back what the server then says the defaults are, which is the only
 * definition of "defaults" that cannot drift from the server's.
 */

/* --------------------------------- wire ---------------------------------- */

function record(value: unknown): Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function str(source: Record<string, unknown>, key: string, fallback = ''): string {
  const value = source[key]
  return typeof value === 'string' ? value : fallback
}

function bool(source: Record<string, unknown>, key: string, fallback = false): boolean {
  const value = source[key]
  return typeof value === 'boolean' ? value : fallback
}

function num(source: Record<string, unknown>, key: string, fallback: number): number {
  const value = source[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/**
 * A decimal, kept as the string it arrived as.
 *
 * The API sends conversion rates and alert thresholds as JSON strings, but a
 * hand-written or legacy value can arrive as a number. `String()` on the
 * number is as close to lossless as this layer can get; parsing to a float
 * and formatting would not be.
 */
function decimal(source: Record<string, unknown>, key: string, fallback: string): string {
  const value = source[key]
  if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/* ------------------------------ invoice ---------------------------------- */

export function toInvoiceConfig(value: unknown): InvoiceConfig {
  const wire = record(value)
  const fallback = defaultInvoiceConfig()

  return {
    prefix: str(wire, 'prefix', fallback.prefix),
    // Not `|| fallback`: an empty separator is a deliberate choice
    // (INV2026090001) and defaulting it back to "-" would undo it on save.
    separator: str(wire, 'separator', fallback.separator),
    format: str(wire, 'format', fallback.format),
    timezone: str(wire, 'timezone', fallback.timezone),
    startSequence: num(wire, 'start_sequence', fallback.startSequence),
    suffixLength: num(wire, 'suffix_length', fallback.suffixLength),
    dueDateDays: num(wire, 'due_date_days', fallback.dueDateDays),
    finalizationDelaySeconds: num(
      wire,
      'finalization_delay_seconds',
      fallback.finalizationDelaySeconds,
    ),
    // Omitted by the API while false, so its absence is information.
    autoCompletePurchasedCreditTransaction: bool(
      wire,
      'auto_complete_purchased_credit_transaction',
    ),
  }
}

export function toInvoiceConfigRequest(config: InvoiceConfig): Record<string, unknown> {
  return {
    prefix: config.prefix,
    separator: config.separator,
    format: config.format,
    timezone: config.timezone,
    start_sequence: config.startSequence,
    suffix_length: config.suffixLength,
    due_date_days: config.dueDateDays,
    finalization_delay_seconds: config.finalizationDelaySeconds,
    auto_complete_purchased_credit_transaction: config.autoCompletePurchasedCreditTransaction,
  }
}

/* ---------------------------- subscription ------------------------------- */

export function toSubscriptionConfig(value: unknown): SubscriptionConfig {
  const wire = record(value)
  const fallback = defaultSubscriptionConfig()

  return {
    autoCancellationEnabled: bool(wire, 'auto_cancellation_enabled'),
    gracePeriodDays: num(wire, 'grace_period_days', fallback.gracePeriodDays),
  }
}

export function toSubscriptionConfigRequest(config: SubscriptionConfig): Record<string, unknown> {
  return {
    auto_cancellation_enabled: config.autoCancellationEnabled,
    grace_period_days: config.gracePeriodDays,
  }
}

/* ------------------------------ currencies ------------------------------- */

export function toCustomCurrencyConfig(value: unknown): CustomCurrencyConfig {
  const wire = record(value)
  const currencies = record(wire['custom_currencies'])

  const customCurrencies: Record<string, CustomCurrencyDefinition> = {}
  for (const [code, raw] of Object.entries(currencies)) {
    const definition = record(raw)
    const factors = record(definition['fiat_conversion_factors'])

    customCurrencies[code] = {
      name: str(definition, 'name'),
      symbol: str(definition, 'symbol'),
      fiatConversionFactors: Object.fromEntries(
        Object.keys(factors).map((fiat) => [fiat, decimal(factors, fiat, '0')]),
      ),
    }
  }

  return {
    defaultFiatCurrency: str(wire, 'default_fiat_currency'),
    customCurrencies,
  }
}

export function toCustomCurrencyConfigRequest(
  config: CustomCurrencyConfig,
): Record<string, unknown> {
  return {
    default_fiat_currency: config.defaultFiatCurrency,
    custom_currencies: Object.fromEntries(
      Object.entries(config.customCurrencies).map(([code, definition]) => [
        code,
        {
          name: definition.name,
          symbol: definition.symbol,
          fiat_conversion_factors: { ...definition.fiatConversionFactors },
        },
      ]),
    ),
  }
}

/* -------------------------------- portal --------------------------------- */

function toPortalTab(value: unknown): PortalTab {
  const wire = record(value)
  const metricCards = wire['metric_cards']
  const usageGraph = wire['usage_graph']

  return {
    id: str(wire, 'id'),
    type: str(wire, 'type'),
    order: num(wire, 'order', 0),
    enabled: bool(wire, 'enabled'),
    // Present only on the tab type that owns them. `null` rather than a block
    // of `false`s, so a save cannot invent a payload the backend never sent.
    metricCards:
      metricCards === undefined || metricCards === null
        ? null
        : {
            showCostMetrics: bool(record(metricCards), 'show_cost_metrics'),
            showCustomMetrics: bool(record(metricCards), 'show_custom_metrics'),
            showRevenueMetric: bool(record(metricCards), 'show_revenue_metric'),
          },
    usageGraph:
      usageGraph === undefined || usageGraph === null
        ? null
        : {
            allowCustomDateRange: bool(record(usageGraph), 'allow_custom_date_range'),
            datePresets: list(record(usageGraph)['date_presets']).filter(
              (preset): preset is string => typeof preset === 'string',
            ),
            defaultPreset: str(record(usageGraph), 'default_preset'),
            featureFilterMode: str(record(usageGraph), 'feature_filter_mode'),
          },
  }
}

function toPortalSection(value: unknown): PortalSection {
  const wire = record(value)

  return {
    id: str(wire, 'id'),
    label: str(wire, 'label'),
    order: num(wire, 'order', 0),
    enabled: bool(wire, 'enabled'),
    tabs: list(wire['tabs']).map(toPortalTab),
  }
}

export function toCustomerPortalConfig(value: unknown): CustomerPortalConfig {
  const wire = record(value)
  const theme = record(wire['theme'])

  return {
    version: str(wire, 'version'),
    theme: {
      primaryColor: str(theme, 'primary_color'),
      secondaryColor: str(theme, 'secondary_color'),
      tertiaryColor: str(theme, 'tertiary_color'),
    },
    sections: list(wire['sections']).map(toPortalSection),
  }
}

export function toCustomerPortalConfigRequest(
  config: CustomerPortalConfig,
): Record<string, unknown> {
  return {
    version: config.version,
    theme: {
      primary_color: config.theme.primaryColor,
      secondary_color: config.theme.secondaryColor,
      tertiary_color: config.theme.tertiaryColor,
    },
    sections: config.sections.map((section) => ({
      id: section.id,
      label: section.label,
      order: section.order,
      enabled: section.enabled,
      tabs: section.tabs.map((tab) => ({
        id: tab.id,
        type: tab.type,
        order: tab.order,
        enabled: tab.enabled,
        // Omitted rather than sent as null: the backend's fields are pointers
        // with `omitempty`, and a tab that never had a payload should not
        // start carrying one because this console round-tripped it.
        ...(tab.metricCards
          ? {
              metric_cards: {
                show_cost_metrics: tab.metricCards.showCostMetrics,
                show_custom_metrics: tab.metricCards.showCustomMetrics,
                show_revenue_metric: tab.metricCards.showRevenueMetric,
              },
            }
          : {}),
        ...(tab.usageGraph
          ? {
              usage_graph: {
                allow_custom_date_range: tab.usageGraph.allowCustomDateRange,
                date_presets: [...tab.usageGraph.datePresets],
                default_preset: tab.usageGraph.defaultPreset,
                feature_filter_mode: tab.usageGraph.featureFilterMode,
              },
            }
          : {}),
      })),
    })),
  }
}

/* ------------------------------ onboarding ------------------------------- */

const ONBOARDING_ACTIONS = new Set<string>(Object.values(OnboardingAction))

/**
 * One onboarding action, or a refusal to guess.
 *
 * The backend unmarshals this list as a closed discriminated union: an action
 * whose `action` it does not recognise fails the entire PUT. So an action this
 * console cannot name is not something to drop (that is a silent deletion of
 * someone's workflow on the next save) and not something to carry blindly
 * (that is a save that fails on a field the user never touched). It is a
 * console that is older than the workflow it is looking at, and saying so is
 * the only honest option.
 */
function toOnboardingAction(value: unknown): OnboardingActionConfig {
  const wire = record(value)
  const action = str(wire, 'action')

  if (!ONBOARDING_ACTIONS.has(action)) {
    throw new ApiError(
      ErrorKind.Unknown,
      action.length > 0
        ? `This workflow uses an onboarding step this console does not know about (${action}). Update the console before editing it.`
        : 'This workflow has a step with no action, which the API will not accept.',
    )
  }

  switch (action as OnboardingAction) {
    case OnboardingAction.CreateCustomer:
      return {
        action: OnboardingAction.CreateCustomer,
        defaultUserId: typeof wire['default_user_id'] === 'string' ? wire['default_user_id'] : null,
      }

    case OnboardingAction.CreateWallet: {
      const unit = str(wire, 'initial_credits_expiration_duration_unit')
      const duration = wire['initial_credits_expiration_duration']

      return {
        action: OnboardingAction.CreateWallet,
        currency: str(wire, 'currency'),
        conversionRate: decimal(wire, 'conversion_rate', '1'),
        walletType:
          str(wire, 'wallet_type') === OnboardingWalletType.PostPaid
            ? OnboardingWalletType.PostPaid
            : OnboardingWalletType.PrePaid,
        initialCreditsToLoad: decimal(wire, 'initial_credits_to_load', '0'),
        initialCreditsExpirationDuration: typeof duration === 'number' ? duration : null,
        initialCreditsExpirationDurationUnit:
          unit === 'DAY' || unit === 'WEEK' || unit === 'MONTH' || unit === 'YEAR' ? unit : null,
      }
    }

    case OnboardingAction.CreateSubscription: {
      const cycle = str(wire, 'billing_cycle')
      return {
        action: OnboardingAction.CreateSubscription,
        planId: str(wire, 'plan_id'),
        billingCycle: cycle === 'anniversary' || cycle === 'calendar' ? cycle : null,
        // Kept as the string the API sent: see the note on `instant` in the
        // domain model. A `Date` round-trip would move a local midnight.
        startDate: typeof wire['start_date'] === 'string' ? wire['start_date'] : null,
      }
    }

    case OnboardingAction.CreateFeatureAndPrice: {
      const type = str(wire, 'feature_type')
      return {
        action: OnboardingAction.CreateFeatureAndPrice,
        planId: str(wire, 'plan_id'),
        featureType:
          type === 'metered' || type === 'boolean' || type === 'static' || type === 'config'
            ? type
            : null,
        priceStartDateTime:
          typeof wire['price_start_date_time'] === 'string' ? wire['price_start_date_time'] : null,
      }
    }

    case OnboardingAction.RolloutToSubscriptions:
      return { action: OnboardingAction.RolloutToSubscriptions, planId: str(wire, 'plan_id') }
  }
}

export function toCustomerOnboarding(value: unknown): CustomerOnboarding {
  const wire = record(value)

  return {
    workflowType: str(wire, 'workflow_type', 'customer_onboarding'),
    actions: list(wire['actions']).map(toOnboardingAction),
  }
}

function toOnboardingActionRequest(action: OnboardingActionConfig): Record<string, unknown> {
  switch (action.action) {
    case OnboardingAction.CreateCustomer:
      return {
        action: action.action,
        // Omitted when unset: the backend's field is a pointer with
        // `omitempty`, and an empty string is a user id that does not exist.
        ...(action.defaultUserId ? { default_user_id: action.defaultUserId } : {}),
      }

    case OnboardingAction.CreateWallet:
      return {
        action: action.action,
        currency: action.currency,
        conversion_rate: action.conversionRate,
        wallet_type: action.walletType,
        initial_credits_to_load: action.initialCreditsToLoad,
        ...(action.initialCreditsExpirationDuration !== null
          ? { initial_credits_expiration_duration: action.initialCreditsExpirationDuration }
          : {}),
        ...(action.initialCreditsExpirationDurationUnit !== null
          ? {
              initial_credits_expiration_duration_unit: action.initialCreditsExpirationDurationUnit,
            }
          : {}),
      }

    case OnboardingAction.CreateSubscription:
      return {
        action: action.action,
        plan_id: action.planId,
        ...(action.billingCycle ? { billing_cycle: action.billingCycle } : {}),
        ...(action.startDate ? { start_date: action.startDate } : {}),
      }

    case OnboardingAction.CreateFeatureAndPrice:
      return {
        action: action.action,
        plan_id: action.planId,
        ...(action.featureType ? { feature_type: action.featureType } : {}),
        ...(action.priceStartDateTime ? { price_start_date_time: action.priceStartDateTime } : {}),
      }

    case OnboardingAction.RolloutToSubscriptions:
      return { action: action.action, plan_id: action.planId }
  }
}

export function toCustomerOnboardingRequest(config: CustomerOnboarding): Record<string, unknown> {
  return {
    workflow_type: config.workflowType,
    actions: config.actions.map(toOnboardingActionRequest),
  }
}

/* ----------------------------- wallet alerts ----------------------------- */

function toWalletThreshold(value: unknown): WalletAlertThreshold {
  if (value === null || value === undefined) return null
  const wire = record(value)

  return {
    condition:
      str(wire, 'condition') === AlertCondition.Above ? AlertCondition.Above : AlertCondition.Below,
    threshold: decimal(wire, 'threshold', '0'),
  }
}

export function toWalletAlertConfig(value: unknown): WalletAlertConfig {
  const wire = record(value)

  return {
    alertEnabled: bool(wire, 'alert_enabled'),
    // The backend coerces an empty threshold type to absolute; matching that
    // here keeps a round-trip from looking like an edit.
    thresholdType:
      str(wire, 'alert_threshold_type') === AlertThresholdType.Percentage
        ? AlertThresholdType.Percentage
        : AlertThresholdType.Absolute,
    info: toWalletThreshold(wire['info']),
    warning: toWalletThreshold(wire['warning']),
    critical: toWalletThreshold(wire['critical']),
  }
}

export function toWalletAlertConfigRequest(config: WalletAlertConfig): Record<string, unknown> {
  return {
    alert_enabled: config.alertEnabled,
    alert_threshold_type: config.thresholdType,
    // Sent as explicit nulls rather than omitted: "no warning threshold" has
    // to be writable, and an omitted key would leave the stored one in place.
    info: config.info
      ? { condition: config.info.condition, threshold: config.info.threshold }
      : null,
    warning: config.warning
      ? { condition: config.warning.condition, threshold: config.warning.threshold }
      : null,
    critical: config.critical
      ? { condition: config.critical.condition, threshold: config.critical.threshold }
      : null,
  }
}

/* --------------------------------- SAML ---------------------------------- */

export function toSamlConfig(value: unknown): SamlConfig {
  const wire = record(value)
  const role = str(wire, 'default_role')
  const fallback = defaultSamlConfig()

  return {
    enabled: bool(wire, 'enabled'),
    idpEntityId: str(wire, 'idp_entity_id'),
    idpSsoUrl: str(wire, 'idp_sso_url'),
    idpCertificate: str(wire, 'idp_certificate'),
    emailAttribute: str(wire, 'email_attribute'),
    defaultRole:
      role === 'all_reader' || role === 'all_writer'
        ? (role as SamlDefaultRole)
        : fallback.defaultRole,
    active: bool(wire, 'active'),
    enforceSso: bool(wire, 'enforce_sso'),
  }
}

/* -------------------------------- plumbing ------------------------------- */

/** How one settings key is read and written. */
interface SettingCodec<T> {
  key: SettingKey
  read: (value: unknown) => T
  write: (config: T) => Record<string, unknown>
}

const invoiceCodec: SettingCodec<InvoiceConfig> = {
  key: SettingKey.InvoiceConfig,
  read: toInvoiceConfig,
  write: toInvoiceConfigRequest,
}

const subscriptionCodec: SettingCodec<SubscriptionConfig> = {
  key: SettingKey.SubscriptionConfig,
  read: toSubscriptionConfig,
  write: toSubscriptionConfigRequest,
}

const currencyCodec: SettingCodec<CustomCurrencyConfig> = {
  key: SettingKey.CustomCurrencyConfig,
  read: toCustomCurrencyConfig,
  write: toCustomCurrencyConfigRequest,
}

const portalCodec: SettingCodec<CustomerPortalConfig> = {
  key: SettingKey.CustomerPortalConfig,
  read: toCustomerPortalConfig,
  write: toCustomerPortalConfigRequest,
}

const onboardingCodec: SettingCodec<CustomerOnboarding> = {
  key: SettingKey.CustomerOnboarding,
  read: toCustomerOnboarding,
  write: toCustomerOnboardingRequest,
}

const walletAlertCodec: SettingCodec<WalletAlertConfig> = {
  key: SettingKey.WalletBalanceAlertConfig,
  read: toWalletAlertConfig,
  write: toWalletAlertConfigRequest,
}

/** A settings hook's guard: no environment, no request. */
function enabledFor(environmentId: string | null): boolean {
  return typeof environmentId === 'string' && environmentId.length > 0
}

async function requireToken(auth: AuthSource): Promise<string> {
  const token = await auth.getToken()
  if (!token) {
    // Reached only by a caller that renders a settings screen while signed
    // out. Failing here beats sending `Bearer null` and reading the 401 back
    // as though the setting were the problem.
    throw new ApiError(ErrorKind.Unauthorized, 'Sign in to read these settings.')
  }
  return token
}

function useSettingQuery<T>(
  codec: SettingCodec<T>,
  environmentId: string | null,
): UseQueryResult<T> {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()

  return useQuery({
    queryKey: queryKeys.settings.detail(environmentId ?? '', codec.key),
    queryFn: async () => {
      const token = await requireToken(auth)
      return codec.read(await getSetting(serverURL, token, environmentId as string, codec.key))
    },
    enabled: enabledFor(environmentId),
    // Settings change when someone on this screen changes them, which is what
    // the mutations' cache writes are for. Refetching them on every window
    // focus is a request per tab switch for a record that changes monthly.
    staleTime: 5 * 60_000,
  })
}

/**
 * Saves a setting, and makes the screen show what was saved.
 *
 * The mutation writes the API's own response into the cache and then marks the
 * entry stale **without refetching**. That is deliberate, and it is the
 * strangest thing in this file, so: a GET issued immediately after a PUT can
 * be served by a replica that has not seen the write. Verified live: a PUT
 * setting `grace_period_days` to 4 was followed by a GET answering 3, and the
 * next second by one answering 4. An invalidation that refetches at once
 * therefore has a real chance of replacing a correct value with the one the
 * user just changed, which reads as "my save did not take".
 *
 * So the response: which cannot be stale, it *is* the write: becomes the
 * cache contents, and `refetchType: 'none'` leaves the entry stale so the next
 * mount or manual refresh fetches it again, by which time the replicas agree.
 */
function useSettingUpdate<T>(
  codec: SettingCodec<T>,
  environmentId: string | null,
): UseMutationResult<T, Error, T> {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const queryClient = useQueryClient()
  const queryKey = queryKeys.settings.detail(environmentId ?? '', codec.key)

  return useMutation<T, Error, T>({
    mutationFn: async (config) => {
      if (!enabledFor(environmentId)) {
        throw new ApiError(ErrorKind.Forbidden, 'Choose an environment before saving settings.')
      }
      const token = await requireToken(auth)
      const saved = await putSetting(
        serverURL,
        token,
        environmentId as string,
        codec.key,
        codec.write(config),
      )
      return codec.read(saved)
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKey, saved)
      void queryClient.invalidateQueries({ queryKey, refetchType: 'none' })
    },
  })
}

/**
 * Puts a setting back to the backend's defaults.
 *
 * Delete, then read. Deleting removes the stored row; the read is what says
 * what the defaults now are: asking the server beats keeping a copy of its
 * defaults here, which would be a second source of truth that drifts the first
 * time a default changes.
 *
 * A 404 from the delete is success. It means there was no stored row to
 * remove, so this environment was already on the defaults, and the read that
 * follows returns exactly what the caller asked for. Every other failure is
 * reported.
 */
function useSettingReset<T>(
  codec: SettingCodec<T>,
  environmentId: string | null,
): UseMutationResult<T, Error, void> {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const queryClient = useQueryClient()
  const queryKey = queryKeys.settings.detail(environmentId ?? '', codec.key)

  return useMutation<T, Error, void>({
    mutationFn: async () => {
      if (!enabledFor(environmentId)) {
        throw new ApiError(ErrorKind.Forbidden, 'Choose an environment before resetting settings.')
      }
      const token = await requireToken(auth)

      try {
        await deleteSetting(serverURL, token, environmentId as string, codec.key)
      } catch (error) {
        if (!(error instanceof ApiError) || error.kind !== ErrorKind.NotFound) throw error
      }

      return codec.read(await getSetting(serverURL, token, environmentId as string, codec.key))
    },
    onSuccess: (defaults) => {
      queryClient.setQueryData(queryKey, defaults)
      void queryClient.invalidateQueries({ queryKey, refetchType: 'none' })
    },
  })
}

/* --------------------------------- hooks --------------------------------- */

/** How invoices are numbered, and when they fall due. */
export function useInvoiceConfig(environmentId: string | null): UseQueryResult<InvoiceConfig> {
  return useSettingQuery(invoiceCodec, environmentId)
}

export function useUpdateInvoiceConfig(
  environmentId: string | null,
): UseMutationResult<InvoiceConfig, Error, InvoiceConfig> {
  return useSettingUpdate(invoiceCodec, environmentId)
}

export function useResetInvoiceConfig(
  environmentId: string | null,
): UseMutationResult<InvoiceConfig, Error, void> {
  return useSettingReset(invoiceCodec, environmentId)
}

/** What happens to a subscription that is not paid for. */
export function useSubscriptionConfig(
  environmentId: string | null,
): UseQueryResult<SubscriptionConfig> {
  return useSettingQuery(subscriptionCodec, environmentId)
}

export function useUpdateSubscriptionConfig(
  environmentId: string | null,
): UseMutationResult<SubscriptionConfig, Error, SubscriptionConfig> {
  return useSettingUpdate(subscriptionCodec, environmentId)
}

export function useResetSubscriptionConfig(
  environmentId: string | null,
): UseMutationResult<SubscriptionConfig, Error, void> {
  return useSettingReset(subscriptionCodec, environmentId)
}

/** The tenant's own currencies, and what they convert to. */
export function useCustomCurrencyConfig(
  environmentId: string | null,
): UseQueryResult<CustomCurrencyConfig> {
  return useSettingQuery(currencyCodec, environmentId)
}

export function useUpdateCustomCurrencyConfig(
  environmentId: string | null,
): UseMutationResult<CustomCurrencyConfig, Error, CustomCurrencyConfig> {
  return useSettingUpdate(currencyCodec, environmentId)
}

export function useResetCustomCurrencyConfig(
  environmentId: string | null,
): UseMutationResult<CustomCurrencyConfig, Error, void> {
  return useSettingReset(currencyCodec, environmentId)
}

/**
 * What a customer sees in their own portal.
 *
 * The whole tree, not a projection of it. A panel edits it with the `with…`
 * helpers in `@fp/domain` and passes the result back whole: see the header of
 * `customerPortalConfig.ts` for what happens to a portal saved from a
 * partially-modelled copy.
 */
export function useCustomerPortalConfig(
  environmentId: string | null,
): UseQueryResult<CustomerPortalConfig> {
  return useSettingQuery(portalCodec, environmentId)
}

export function useUpdateCustomerPortalConfig(
  environmentId: string | null,
): UseMutationResult<CustomerPortalConfig, Error, CustomerPortalConfig> {
  return useSettingUpdate(portalCodec, environmentId)
}

export function useResetCustomerPortalConfig(
  environmentId: string | null,
): UseMutationResult<CustomerPortalConfig, Error, void> {
  return useSettingReset(portalCodec, environmentId)
}

/** What runs automatically when a customer is created. */
export function useCustomerOnboarding(
  environmentId: string | null,
): UseQueryResult<CustomerOnboarding> {
  return useSettingQuery(onboardingCodec, environmentId)
}

export function useUpdateCustomerOnboarding(
  environmentId: string | null,
): UseMutationResult<CustomerOnboarding, Error, CustomerOnboarding> {
  return useSettingUpdate(onboardingCodec, environmentId)
}

export function useResetCustomerOnboarding(
  environmentId: string | null,
): UseMutationResult<CustomerOnboarding, Error, void> {
  return useSettingReset(onboardingCodec, environmentId)
}

/**
 * When a low wallet balance raises an alarm, tenant-wide.
 *
 * Not `useAlertSettings`: that is `/alerts/setting`, which holds per-entity
 * records with their own ids. See the header of `walletAlertConfig.ts`.
 */
export function useWalletAlertConfig(
  environmentId: string | null,
): UseQueryResult<WalletAlertConfig> {
  return useSettingQuery(walletAlertCodec, environmentId)
}

export function useUpdateWalletAlertConfig(
  environmentId: string | null,
): UseMutationResult<WalletAlertConfig, Error, WalletAlertConfig> {
  return useSettingUpdate(walletAlertCodec, environmentId)
}

export function useResetWalletAlertConfig(
  environmentId: string | null,
): UseMutationResult<WalletAlertConfig, Error, void> {
  return useSettingReset(walletAlertCodec, environmentId)
}

/**
 * SAML single sign-on, and whether this deployment has any.
 *
 * **Any read failure means unavailable: not just a 404.** This is the one
 * rule in this file that looks like sloppiness and is not, so it is worth
 * stating plainly: a 500, a timeout, a CORS failure and a 403 all resolve to
 * `{available: false}`, exactly as a 404 does. The hosted deployment answers
 * `404 {"code":"not_found","message":"SAML single sign-on is not available on
 * this deployment"}` because the routes are only mounted when
 * `auth.saml.enabled` is set.
 *
 * The reason is what a failed read would otherwise let a user do. If a 500
 * rendered the SSO form with its defaults: SSO off, no IdP, no certificate:
 * the screen would be indistinguishable from a tenant that has never
 * configured SSO, and the obvious next action, pressing Save, would overwrite
 * a **live, working** SAML configuration with empty strings and lock every
 * user of that tenant out of their console. V1 made this choice deliberately
 * (`isAvailable: !isLoading && !isError`) and it is preserved here for the
 * same reason. "We could not read it" and "there is nothing to read" are
 * different facts, and this hook refuses to guess which one it is holding.
 *
 * That is also why there is no `useUpdateSamlConfig`. A console that cannot
 * reliably read this setting has no business writing it, and on every
 * deployment this workspace targets, it cannot read it at all.
 */
export function useSamlConfig(environmentId: string | null): UseQueryResult<SamlSettings> {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()

  return useQuery({
    queryKey: queryKeys.settings.detail(environmentId ?? '', SettingKey.SamlConfig),
    queryFn: async () => {
      try {
        const token = await requireToken(auth)
        const value = await getSetting(
          serverURL,
          token,
          environmentId as string,
          SettingKey.SamlConfig,
        )
        return { available: true, config: toSamlConfig(value) }
      } catch {
        // Every failure, on purpose. See above.
        return SAML_UNAVAILABLE
      }
    },
    enabled: enabledFor(environmentId),
    // Nothing to retry: a failure is already an answer, and retrying one that
    // resolves successfully would only delay the unavailable state.
    retry: false,
    staleTime: 5 * 60_000,
  })
}

/**
 * A way in to the tenant's Svix webhook portal.
 *
 * **The result carries live credentials.** `token` is a Svix app token and
 * `url` is a one-time sign-in link; neither may be logged, persisted,
 * screenshotted into a bug report or put in an error message. Hand them to an
 * iframe or an anchor and let them go.
 *
 * Which is also why this entry is not cached for long. `gcTime` drops it a
 * minute after the last screen using it unmounts, so a credential does not sit
 * in a query cache for the rest of the session, and `staleTime: 0` means a
 * screen that comes back asks for a fresh link rather than replaying a spent
 * one.
 */
export function useWebhookDashboard(
  environmentId: string | null,
): UseQueryResult<WebhookDashboard> {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()

  return useQuery({
    queryKey: queryKeys.settings.webhookDashboard(environmentId ?? ''),
    queryFn: async () => {
      const token = await requireToken(auth)
      return fetchWebhookDashboard(serverURL, token, environmentId as string)
    },
    enabled: enabledFor(environmentId),
    staleTime: 0,
    gcTime: 60_000,
  })
}

export type { WebhookDashboard } from '@fp/api'
