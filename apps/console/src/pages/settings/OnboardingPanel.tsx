import {
  CREDIT_GRANT_EXPIRY_DURATION_UNIT_LABEL,
  type CreateCustomerAction,
  type CreateFeatureAndPriceAction,
  type CreateSubscriptionAction,
  type CreateWalletAction,
  CreditGrantExpiryDurationUnit,
  DEFAULT_PLAN_QUERY,
  type CustomerOnboarding,
  FEATURE_TYPE_LABEL,
  FeatureType,
  ONBOARDING_ACTION_LABEL,
  ONBOARDING_WALLET_TYPE_LABEL,
  OnboardingAction,
  type OnboardingActionConfig,
  OnboardingBillingCycle,
  OnboardingWalletType,
  type RolloutToSubscriptionsAction,
  customerOnboardingSchema,
  emptyOnboardingAction,
} from '@fp/domain'
import {
  ApiError,
  ErrorKind,
  useCustomerOnboarding,
  useResetCustomerOnboarding,
  useUpdateCustomerOnboarding,
  usePlans,
} from '@fp/query'
import { EmptyState, Field, OptionCombobox } from '@fp/ui/compositions'
import { Button, Input } from '@fp/ui/primitives'
import { useSession } from '@/app/session'
import {
  ActionError,
  ActionNote,
  DelayedHint,
  Fact,
  Panel,
  PanelError,
  mutationMessage,
  toFailure,
  PanelLoading,
  PanelUnavailable,
  queryPhase,
  SettingsBlock,
} from './panelKit'
import { useDraft } from './useDraft'

/**
 * What runs by itself the first time Flexprice sees a new customer.
 *
 * `GET/PUT/DELETE /settings/customer_onboarding`. The value is a workflow: a
 * `workflowType` and an ordered list of steps the backend runs in order. An
 * empty list: the default: means nothing happens, which is a valid and very
 * common answer, so the empty state here is not an error.
 *
 * ## One unknown step fails the whole save
 *
 * `actions` is a **closed discriminated union of five types**, unmarshalled by
 * hand on the backend. A step whose `action` it does not recognise is not
 * ignored: it rejects the entire `PUT`, with a message about JSON, at the
 * moment the user thinks they edited a wallet.
 *
 * So the mapper in `@fp/query` refuses to guess: reading a workflow that
 * contains a step this console cannot name throws a named `ApiError` rather
 * than dropping the step (a silent deletion of somebody's workflow on the next
 * save) or carrying it blindly (a save that fails on a field nobody touched).
 * This panel surfaces that as a full-panel failure with the mapper's own
 * sentence and **no editor at all**, because the honest thing for a console
 * that is older than the workflow it is looking at is to refuse to edit it.
 * The one thing it must never do is show a form and let a save look like it
 * worked.
 *
 * ## Saving
 *
 * The whole workflow goes back on every save. `PUT` merges the top level and
 * replaces arrays wholesale, so a partially-sent `actions` list is a deletion
 * of the steps it leaves out: the value written is the value that was loaded,
 * mutated in place.
 *
 * Nothing is validated as you type; the schema runs on submit. Its messages
 * are addressed by path (`actions.0.currency`), which is how a message about
 * step one lands on step one's field.
 */
export function OnboardingPanel() {
  const { environmentId } = useSession()
  const onboarding = useCustomerOnboarding(environmentId)

  const failure = toFailure(onboarding.error, 'your onboarding workflow')

  if (failure) {
    // `ErrorKind.Unknown` from this read is the mapper refusing to name a step
    //: worth spelling out, because it is the one failure here that is about
    // this console's age rather than about the request.
    const unrecognised =
      onboarding.error instanceof ApiError && onboarding.error.kind === ErrorKind.Unknown

    return (
      <Panel>
        <PanelError failure={failure} onRetry={() => void onboarding.refetch()} />
        {unrecognised ? (
          <p className="text-muted-foreground text-sm">
            The workflow is untouched and still runs. Editing it here is blocked on purpose: the API
            accepts this list only as a whole, and a console that cannot name every step would
            either drop the one it does not understand or have the whole save rejected.
          </p>
        ) : null}
      </Panel>
    )
  }

  if (!environmentId) {
    return (
      <PanelUnavailable reason="setup" description="Choose an environment to see these settings." />
    )
  }

  const phase = queryPhase(onboarding)
  if (phase === 'idle') return <PanelUnavailable reason="unavailable" />
  if (phase === 'loading' || !onboarding.data) return <PanelLoading rows={5} />

  return (
    <OnboardingForm key={environmentId} environmentId={environmentId} config={onboarding.data} />
  )
}

/**
 * What a new customer can be set up with: a wallet and a contract, as V1's
 * onboarding offered. Creating the customer, adding a feature and price, and
 * rolling out to existing contracts are not onboarding steps for one customer;
 * a saved step of those kinds still shows and can be removed, but none is added.
 */
const ADDABLE: OnboardingAction[] = [
  OnboardingAction.CreateWallet,
  OnboardingAction.CreateSubscription,
]

function OnboardingForm({
  environmentId,
  config,
}: {
  environmentId: string
  config: CustomerOnboarding
}) {
  const update = useUpdateCustomerOnboarding(environmentId)
  const reset = useResetCustomerOnboarding(environmentId)
  const draft = useDraft<CustomerOnboarding>(customerOnboardingSchema, config)

  const busy = update.isPending || reset.isPending
  const saveError =
    mutationMessage(update.error, 'The onboarding workflow could not be saved.') ??
    mutationMessage(reset.error, 'The onboarding workflow could not be reset.')

  const actions = draft.value.actions

  function setActions(next: (current: OnboardingActionConfig[]) => OnboardingActionConfig[]) {
    draft.update((current) => ({ ...current, actions: next(current.actions) }))
  }

  function setAction(index: number, next: OnboardingActionConfig) {
    setActions((current) => current.map((action, at) => (at === index ? next : action)))
  }

  function move(index: number, delta: number) {
    setActions((current) => {
      const to = index + delta
      if (to < 0 || to >= current.length) return current
      const copy = [...current]
      const [moved] = copy.splice(index, 1)
      if (moved === undefined) return current
      copy.splice(to, 0, moved)
      return copy
    })
  }

  return (
    <form
      className="contents"
      noValidate
      onSubmit={draft.handleSubmit((value) => {
        // The workflow as loaded and mutated, whole.
        update.mutate(value, { onSuccess: (saved) => draft.reset(saved) })
      })}
    >
      <Panel>
        <SettingsBlock
          label="Customer onboarding"
          actions={
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => {
                update.reset()
                reset.mutate(undefined, { onSuccess: (defaults) => draft.reset(defaults) })
              }}
            >
              {reset.isPending ? 'Resetting…' : 'Reset to defaults'}
            </Button>
          }
        >
          <dl className="grid gap-4 sm:grid-cols-2">
            <Fact label="Steps">{actions.length === 0 ? 'None' : String(actions.length)}</Fact>
          </dl>
        </SettingsBlock>

        {actions.length === 0 ? (
          <SettingsBlock label="Steps">
            <EmptyState
              size="inline"
              title="No onboarding steps"
              description="Steps run in order the first time Flexprice sees a new customer. Add one below to open a wallet, start a contract or roll out a price automatically."
            />
          </SettingsBlock>
        ) : (
          actions.map((action, index) => (
            <SettingsBlock
              key={`${action.action}-${String(index)}`}
              label={`${String(index + 1)}. ${ONBOARDING_ACTION_LABEL[action.action]}`}
              actions={
                <>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    aria-label={`Move step ${String(index + 1)} up`}
                    disabled={busy || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    aria-label={`Move step ${String(index + 1)} down`}
                    disabled={busy || index === actions.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    disabled={busy}
                    onClick={() => setActions((current) => current.filter((_, at) => at !== index))}
                  >
                    Remove
                  </Button>
                </>
              }
            >
              <p className="flex items-center gap-1.5 text-sm font-medium">
                {`${String(index + 1)}. ${ONBOARDING_ACTION_LABEL[action.action]}`}
                <DelayedHint text={STEP_DESCRIPTION[action.action]} />
              </p>
              <StepFields
                action={action}
                busy={busy}
                error={(field) => draft.error(`actions.${String(index)}.${field}`)}
                onChange={(next) => setAction(index, next)}
              />
            </SettingsBlock>
          ))
        )}

        <SettingsBlock
          label="Add a step"
          actions={
            <div className="flex w-full flex-wrap items-center justify-end gap-3">
              <ActionError message={saveError} />
              {!saveError && update.isSuccess ? <ActionNote message="Saved." /> : null}
              {!saveError && reset.isSuccess ? (
                <ActionNote message="Back to the defaults." />
              ) : null}
              <Button type="submit" variant="outline" disabled={busy}>
                {update.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          }
        >
          <div role="group" aria-label="Add a step" className="flex flex-wrap gap-1.5">
            {ADDABLE.map((type) => (
              <Button
                key={type}
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setActions((current) => [...current, emptyOnboardingAction(type)])}
              >
                {ONBOARDING_ACTION_LABEL[type]}
              </Button>
            ))}
          </div>
        </SettingsBlock>
      </Panel>
    </form>
  )
}

const STEP_DESCRIPTION: Record<OnboardingAction, string> = {
  [OnboardingAction.CreateCustomer]: 'Records the customer itself.',
  [OnboardingAction.CreateWallet]: 'Opens a wallet and, optionally, puts credits in it.',
  [OnboardingAction.CreateSubscription]: 'Puts the customer on a plan.',
  [OnboardingAction.CreateFeatureAndPrice]: 'Adds a feature to a plan and prices it.',
  [OnboardingAction.RolloutToSubscriptions]:
    'Applies the plan’s prices to contracts that already exist.',
}

type ErrorAt = (field: string) => string | undefined

/** The editor for whichever of the five steps this is. */
function StepFields({
  action,
  busy,
  error,
  onChange,
}: {
  action: OnboardingActionConfig
  busy: boolean
  error: ErrorAt
  onChange: (next: OnboardingActionConfig) => void
}) {
  switch (action.action) {
    case OnboardingAction.CreateCustomer:
      return <CustomerFields action={action} busy={busy} error={error} onChange={onChange} />
    case OnboardingAction.CreateWallet:
      return <WalletFields action={action} busy={busy} error={error} onChange={onChange} />
    case OnboardingAction.CreateSubscription:
      return <SubscriptionFields action={action} busy={busy} error={error} onChange={onChange} />
    case OnboardingAction.CreateFeatureAndPrice:
      return <FeaturePriceFields action={action} busy={busy} error={error} onChange={onChange} />
    case OnboardingAction.RolloutToSubscriptions:
      return <RolloutFields action={action} busy={busy} error={error} onChange={onChange} />
  }
}

function CustomerFields({
  action,
  busy,
  error,
  onChange,
}: {
  action: CreateCustomerAction
  busy: boolean
  error: ErrorAt
  onChange: (next: CreateCustomerAction) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextRow
        label="Attribute to user"
        hint="A user id the created customer is credited to. Leave it blank for none."
        value={action.defaultUserId ?? ''}
        busy={busy}
        error={error('defaultUserId')}
        onChange={(value) => onChange({ ...action, defaultUserId: blankToNull(value) })}
      />
    </div>
  )
}

function WalletFields({
  action,
  busy,
  error,
  onChange,
}: {
  action: CreateWalletAction
  busy: boolean
  error: ErrorAt
  onChange: (next: CreateWalletAction) => void
}) {
  const expires = action.initialCreditsExpirationDuration !== null

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextRow
          label="Currency"
          required
          hint="The wallet's currency, for example USD."
          value={action.currency}
          busy={busy}
          error={error('currency')}
          onChange={(currency) => onChange({ ...action, currency })}
        />
        <TextRow
          label="Conversion rate"
          required
          hint="How much one credit is worth. 1 means one credit is one unit of currency."
          value={action.conversionRate}
          busy={busy}
          error={error('conversionRate')}
          inputMode="decimal"
          onChange={(conversionRate) => onChange({ ...action, conversionRate })}
        />
        <TextRow
          label="Credits to load"
          required
          hint="Put in when the wallet is opened. 0 for an empty wallet."
          value={action.initialCreditsToLoad}
          busy={busy}
          error={error('initialCreditsToLoad')}
          inputMode="decimal"
          onChange={(initialCreditsToLoad) => onChange({ ...action, initialCreditsToLoad })}
        />
      </div>

      <Choices
        label="Wallet type"
        options={[OnboardingWalletType.PrePaid, OnboardingWalletType.PostPaid]}
        selected={action.walletType}
        labelOf={(option) => ONBOARDING_WALLET_TYPE_LABEL[option]}
        busy={busy}
        onSelect={(walletType) => onChange({ ...action, walletType })}
      />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Those credits</span>
        <div role="group" aria-label="Credit expiry" className="flex gap-1.5">
          <Button
            type="button"
            size="xs"
            variant={expires ? 'outline' : 'default'}
            aria-pressed={!expires}
            disabled={busy}
            onClick={() =>
              onChange({
                ...action,
                initialCreditsExpirationDuration: null,
                // Both or neither: a duration without a unit is not a shorter
                // expiry, it is a validation error.
                initialCreditsExpirationDurationUnit: null,
              })
            }
          >
            Never expire
          </Button>
          <Button
            type="button"
            size="xs"
            variant={expires ? 'default' : 'outline'}
            aria-pressed={expires}
            disabled={busy}
            onClick={() =>
              onChange({
                ...action,
                initialCreditsExpirationDuration: 1,
                initialCreditsExpirationDurationUnit:
                  action.initialCreditsExpirationDurationUnit ??
                  CreditGrantExpiryDurationUnit.Month,
              })
            }
          >
            Expire after
          </Button>
        </div>

        {expires ? (
          <div className="flex flex-col gap-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextRow
                label="Expires after"
                value={
                  action.initialCreditsExpirationDuration === null
                    ? ''
                    : String(action.initialCreditsExpirationDuration)
                }
                busy={busy}
                error={error('initialCreditsExpirationDuration')}
                inputMode="numeric"
                onChange={(value) => {
                  const trimmed = value.trim()
                  if (trimmed === '') {
                    onChange({
                      ...action,
                      initialCreditsExpirationDuration: null,
                      initialCreditsExpirationDurationUnit: null,
                    })
                    return
                  }
                  const parsed = Number.parseInt(trimmed, 10)
                  if (Number.isNaN(parsed)) return
                  onChange({ ...action, initialCreditsExpirationDuration: parsed })
                }}
              />
            </div>

            <Choices
              label="Counted in"
              options={[
                CreditGrantExpiryDurationUnit.Day,
                CreditGrantExpiryDurationUnit.Week,
                CreditGrantExpiryDurationUnit.Month,
                CreditGrantExpiryDurationUnit.Year,
              ]}
              selected={action.initialCreditsExpirationDurationUnit}
              labelOf={(option) => CREDIT_GRANT_EXPIRY_DURATION_UNIT_LABEL[option]}
              busy={busy}
              error={error('initialCreditsExpirationDurationUnit')}
              onSelect={(initialCreditsExpirationDurationUnit) =>
                onChange({ ...action, initialCreditsExpirationDurationUnit })
              }
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function SubscriptionFields({
  action,
  busy,
  error,
  onChange,
}: {
  action: CreateSubscriptionAction
  busy: boolean
  error: ErrorAt
  onChange: (next: CreateSubscriptionAction) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <PlanRow
          value={action.planId}
          busy={busy}
          error={error('planId')}
          onChange={(planId) => onChange({ ...action, planId })}
        />
        <TextRow
          label="Starts"
          hint="An ISO timestamp, for example 2026-09-29T00:00:00Z. Blank means when the customer is created."
          value={action.startDate ?? ''}
          busy={busy}
          error={error('startDate')}
          onChange={(value) => onChange({ ...action, startDate: blankToNull(value) })}
        />
      </div>

      <Choices
        label="Billing cycle"
        options={[OnboardingBillingCycle.Anniversary, OnboardingBillingCycle.Calendar]}
        selected={action.billingCycle}
        labelOf={(option) =>
          option === OnboardingBillingCycle.Anniversary ? 'Anniversary' : 'Calendar'
        }
        busy={busy}
        error={error('billingCycle')}
        clearable="Leave to the plan"
        onSelect={(billingCycle) => onChange({ ...action, billingCycle })}
        onClear={() => onChange({ ...action, billingCycle: null })}
      />
    </div>
  )
}

function FeaturePriceFields({
  action,
  busy,
  error,
  onChange,
}: {
  action: CreateFeatureAndPriceAction
  busy: boolean
  error: ErrorAt
  onChange: (next: CreateFeatureAndPriceAction) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextRow
          label="Plan"
          required
          hint="The plan the feature and its price are added to."
          value={action.planId}
          busy={busy}
          error={error('planId')}
          onChange={(planId) => onChange({ ...action, planId })}
        />
        <TextRow
          label="Price starts"
          hint="An ISO timestamp. Blank means straight away."
          value={action.priceStartDateTime ?? ''}
          busy={busy}
          error={error('priceStartDateTime')}
          onChange={(value) => onChange({ ...action, priceStartDateTime: blankToNull(value) })}
        />
      </div>

      <Choices
        label="Feature type"
        options={[FeatureType.Metered, FeatureType.Boolean, FeatureType.Static, FeatureType.Config]}
        selected={action.featureType}
        labelOf={(option) => FEATURE_TYPE_LABEL[option]}
        busy={busy}
        error={error('featureType')}
        clearable="Not set"
        onSelect={(featureType) => onChange({ ...action, featureType })}
        onClear={() => onChange({ ...action, featureType: null })}
      />
    </div>
  )
}

function RolloutFields({
  action,
  busy,
  error,
  onChange,
}: {
  action: RolloutToSubscriptionsAction
  busy: boolean
  error: ErrorAt
  onChange: (next: RolloutToSubscriptionsAction) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextRow
        label="Plan"
        required
        hint="Contracts already on this plan pick up its prices."
        value={action.planId}
        busy={busy}
        error={error('planId')}
        onChange={(planId) => onChange({ ...action, planId })}
      />
    </div>
  )
}

/** An empty box means "not set", which this model spells `null`. */
function blankToNull(value: string): string | null {
  return value.trim() === '' ? null : value
}

/** The plan a new customer's contract starts on, picked by name rather than typed as an id. */
function PlanRow({
  value,
  busy,
  error,
  onChange,
}: {
  value: string
  busy: boolean
  error: string | undefined
  onChange: (next: string) => void
}) {
  const plans = usePlans({ ...DEFAULT_PLAN_QUERY, page: 1, pageSize: 100 })
  const options = (plans.data?.plans ?? []).map((plan) => ({ value: plan.id, label: plan.name }))
  // A saved plan not in the first page still shows, by id.
  const withSaved =
    value && !options.some((option) => option.value === value)
      ? [{ value, label: value }, ...options]
      : options
  return (
    <Field
      label="Plan"
      required
      hint="The plan the customer's contract starts on."
      {...(error ? { error } : {})}
    >
      {({ id, ...field }) => (
        <OptionCombobox
          id={id}
          {...field}
          value={value}
          onValueChange={onChange}
          options={withSaved}
          searchable
          placeholder={plans.isPending ? 'Loading plans…' : 'Choose a plan'}
          disabled={busy}
        />
      )}
    </Field>
  )
}

function TextRow({
  label,
  hint,
  value,
  busy,
  error,
  required,
  inputMode,
  onChange,
}: {
  label: string
  hint?: string
  value: string
  busy: boolean
  error: string | undefined
  required?: boolean
  inputMode?: 'decimal' | 'numeric'
  onChange: (next: string) => void
}) {
  return (
    <Field
      label={label}
      {...(required ? { required: true } : {})}
      {...(hint ? { hint } : {})}
      {...(error ? { error } : {})}
    >
      {({ id, ...field }) => (
        <Input
          id={id}
          disabled={busy}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          {...(inputMode ? { inputMode } : {})}
          {...field}
        />
      )}
    </Field>
  )
}

/**
 * One choice out of a few, as `aria-pressed` buttons.
 *
 * `@fp/ui/primitives` does not re-export a select, and a radio group of three
 * options is what the other settings panels already draw this way.
 */
function Choices<T extends string>({
  label,
  options,
  selected,
  labelOf,
  busy,
  error,
  clearable,
  onSelect,
  onClear,
}: {
  label: string
  options: readonly T[]
  selected: T | null
  labelOf: (option: T) => string
  busy: boolean
  error?: string | undefined
  clearable?: string
  onSelect: (option: T) => void
  onClear?: () => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
        {clearable && onClear ? (
          <Button
            type="button"
            size="xs"
            variant={selected === null ? 'default' : 'outline'}
            aria-pressed={selected === null}
            disabled={busy}
            onClick={onClear}
          >
            {clearable}
          </Button>
        ) : null}
        {options.map((option) => (
          <Button
            key={option}
            type="button"
            size="xs"
            variant={selected === option ? 'default' : 'outline'}
            aria-pressed={selected === option}
            disabled={busy}
            onClick={() => onSelect(option)}
          >
            {labelOf(option)}
          </Button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  )
}
