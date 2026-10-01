import { useState } from 'react'
import { type SubscriptionConfig, subscriptionConfigSchema } from '@fp/domain'
import {
  useResetSubscriptionConfig,
  useSubscriptionConfig,
  useUpdateSubscriptionConfig,
} from '@fp/query'
import {
  ConfirmDialog,
  EmptyState,
  LoadingRows,
  SettingRow,
  SettingsCard,
  SettingsFieldGroup,
} from '@fp/ui/compositions'
import { Button, Input, Switch } from '@fp/ui/primitives'
import { useSession } from '@/app/session'
import { ActionError, ActionNote, Panel, PanelError, mutationMessage, toFailure, SettingsBlock } from './panelKit'
import { useDraft } from './useDraft'

/**
 * What happens to a subscription that is not paid for.
 *
 * `GET/PUT/DELETE /settings/subscription_config`. Two fields that read as one
 * sentence — after `gracePeriodDays` of non-payment, cancel the subscription,
 * or do not — which is why the screen is built around a sentence rather than
 * around two inputs.
 *
 * ## The grace period survives the switch
 *
 * Turning auto-cancellation off hides the number; it does not clear it. The
 * record keeps both fields and the backend keeps counting to the same day for
 * dunning, so a tenant who switches the rule off and on again gets the period
 * they set rather than the default. Hiding the input while the rule is off is
 * the honest version of that: the number is still stored, it just is not
 * acting on anything.
 *
 * ## One day is the floor, and it is not the schema's
 *
 * `subscriptionConfigSchema` accepts 0 because the backend does, but a
 * zero-day grace period is "cancel on the same day the invoice is raised",
 * which is never a deliberate setting — it is a cleared field that was saved.
 * So the floor is enforced here, at the point where somebody meant something,
 * and only while the rule is switched on.
 */
export function SubscriptionsPanel() {
  const { environmentId } = useSession()
  const config = useSubscriptionConfig(environmentId)

  const failure = toFailure(config.error, 'your subscription settings')

  if (!environmentId) {
    return (
      <Panel>
        <SettingsBlock
          title="Unpaid subscriptions"
          description="Stored per environment, so a sandbox experiment cannot cancel a real customer."
        >
          <EmptyState
            size="inline"
            title="No environment selected"
            description="Choose an environment from the switcher to see what happens to its unpaid subscriptions."
          />
        </SettingsBlock>
      </Panel>
    )
  }

  if (failure) {
    return (
      <Panel>
        <PanelError failure={failure} onRetry={() => void config.refetch()} />
      </Panel>
    )
  }

  if (config.isPending || !config.data) {
    return (
      <Panel>
        <LoadingRows rows={3} columns={2} />
      </Panel>
    )
  }

  return <SubscriptionForm key={environmentId} environmentId={environmentId} config={config.data} />
}

/** The smallest grace period that means anything. See the panel's header. */
const MINIMUM_GRACE_DAYS = 1

function SubscriptionForm({
  environmentId,
  config,
}: {
  environmentId: string
  config: SubscriptionConfig
}) {
  const update = useUpdateSubscriptionConfig(environmentId)
  const reset = useResetSubscriptionConfig(environmentId)
  const draft = useDraft<SubscriptionConfig>(subscriptionConfigSchema, config)

  // The draft holds a number, which cannot represent a field that has been
  // cleared and is about to be retyped. This shadows it while that is true.
  const [typedDays, setTypedDays] = useState<string | null>(null)
  const [floorIssue, setFloorIssue] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)

  const saveError = mutationMessage(update.error, 'The subscription settings could not be saved.')
  const resetError = mutationMessage(reset.error, 'The subscription settings could not be reset.')
  const busy = update.isPending || reset.isPending

  const enabled = draft.value.autoCancellationEnabled
  const days = draft.value.gracePeriodDays
  const daysText = typedDays ?? (Number.isFinite(days) ? String(days) : '')
  // The floor this panel adds wins over the schema's own message: it is the
  // more specific complaint about the same field.
  const graceError = floorIssue ?? draft.error('gracePeriodDays')

  function setDays(next: string) {
    setTypedDays(next)
    setFloorIssue(null)
    const trimmed = next.trim()
    const parsed = trimmed.length === 0 ? Number.NaN : Number(trimmed)
    draft.update((current) => ({
      ...current,
      gracePeriodDays: Number.isFinite(parsed) ? parsed : Number.NaN,
    }))
  }

  function setEnabled(next: boolean) {
    setFloorIssue(null)
    draft.update((current) => ({
      ...current,
      autoCancellationEnabled: next,
      // Switching the rule off hides the input, so a half-cleared number would
      // fail validation on a field nobody can see — an invisible failure, and
      // the save would simply do nothing. The stored value comes back instead.
      gracePeriodDays:
        !next && !Number.isFinite(current.gracePeriodDays)
          ? config.gracePeriodDays
          : current.gracePeriodDays,
    }))
    if (!next && !Number.isFinite(draft.value.gracePeriodDays)) setTypedDays(null)
  }

  function reseed(saved: SubscriptionConfig) {
    draft.reset(saved)
    setTypedDays(null)
    setFloorIssue(null)
  }

  return (
    <>
      <form
        className="contents"
        noValidate
        onSubmit={draft.handleSubmit((value) => {
          if (value.autoCancellationEnabled && value.gracePeriodDays < MINIMUM_GRACE_DAYS) {
            setFloorIssue('Give customers at least one day.')
            return
          }
          setFloorIssue(null)
          // Spread over what was loaded, so a field this form does not render
          // still makes the round trip intact.
          update.mutate({ ...config, ...value }, { onSuccess: reseed })
        })}
      >
        <Panel>
          <SettingsCard
            title="Unpaid subscriptions"
            description="Whether Flexprice cancels a subscription on your behalf when its invoices go unpaid, and how long it waits first."
            footer={
              <div className="flex w-full flex-wrap items-center justify-end gap-3">
                <ActionError message={saveError} />
                {!saveError && update.isSuccess ? <ActionNote message="Saved." /> : null}
                {!resetError && reset.isSuccess ? (
                  <ActionNote message="Back to the defaults." />
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setResetting(true)}
                >
                  Reset to defaults
                </Button>
                <Button type="submit" disabled={busy}>
                  {update.isPending ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            }
          >
            <SettingsFieldGroup
              legend="Unpaid subscriptions"
              description="Whether Flexprice cancels a subscription on your behalf when its invoices go unpaid."
            >
              <SettingRow
                title="Cancel automatically"
                description="Off by default — cancelling a paying customer is something you opt into."
                labelFor="subscription-auto-cancel"
                last={!enabled}
              >
                <Switch
                  id="subscription-auto-cancel"
                  checked={enabled}
                  disabled={busy}
                  onCheckedChange={(checked) => setEnabled(checked)}
                />
              </SettingRow>
              {enabled ? (
                <SettingRow
                  title="Grace period"
                  description="How long non-payment is tolerated before the subscription is cancelled. At least one day."
                  labelFor="subscription-grace-days"
                  last
                  titleAddon={<span className="text-destructive" aria-hidden="true">*</span>}
                >
                  <div className="flex w-full flex-col gap-1">
                    <Input
                      id="subscription-grace-days"
                      disabled={busy}
                      inputMode="numeric"
                      aria-invalid={graceError ? true : undefined}
                      value={daysText}
                      onChange={(event) => setDays(event.target.value)}
                    />
                    {graceError ? (
                      <p role="alert" className="text-destructive text-xs">
                        {graceError}
                      </p>
                    ) : null}
                  </div>
                </SettingRow>
              ) : null}
            </SettingsFieldGroup>
            <div className="px-5 pb-4">
              <CancellationPreview enabled={enabled} days={days} />
            </div>
          </SettingsCard>
        </Panel>
      </form>

      <ConfirmDialog
        open={resetting}
        onOpenChange={setResetting}
        title="Reset subscription settings?"
        description="This environment goes back to the Flexprice defaults: automatic cancellation off, with the default grace period. Subscriptions already cancelled are not restored."
        confirmLabel="Reset to defaults"
        destructive
        isPending={reset.isPending}
        error={resetError}
        onConfirm={() =>
          reset.mutate(undefined, {
            onSuccess: (defaults) => {
              reseed(defaults)
              setResetting(false)
            },
          })
        }
      />
    </>
  )
}

/**
 * The rule as a sentence: what starts the clock, how long it runs, what it does.
 *
 * Two numbers in two boxes do not say what they add up to. V1 renders the same
 * three beats for the same reason — the setting's effect has to be legible
 * without the reader reconstructing it from field names.
 */
function CancellationPreview({ enabled, days }: { enabled: boolean; days: number }) {
  const period = Number.isFinite(days) && days > 0 ? `${days} ${days === 1 ? 'day' : 'days'}` : '—'

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      <span className="text-muted-foreground text-xs">What happens</span>
      <ol className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <PreviewStep
          step="Trigger"
          headline="An invoice goes unpaid"
          detail="The subscription's invoice passes its due date without payment."
        />
        <PreviewArrow />
        <PreviewStep
          step="Grace"
          headline={enabled ? period : 'Not counted'}
          detail={
            enabled
              ? 'The customer keeps the service while the dunning schedule runs.'
              : 'Nothing is counting down while automatic cancellation is off.'
          }
        />
        <PreviewArrow />
        <PreviewStep
          step="Action"
          headline={enabled ? 'The subscription is cancelled' : 'The subscription keeps running'}
          detail={
            enabled
              ? 'Flexprice cancels it for you. Nobody has to remember to.'
              : 'Unpaid invoices stay unpaid until somebody acts on them.'
          }
        />
      </ol>
    </div>
  )
}

function PreviewStep({
  step,
  headline,
  detail,
}: {
  step: string
  headline: string
  detail: string
}) {
  return (
    <li className="bg-muted/40 flex flex-1 flex-col gap-1 rounded-md border p-3">
      <span className="text-muted-foreground text-[0.7rem] font-medium uppercase">{step}</span>
      <span className="text-sm font-medium">{headline}</span>
      <span className="text-muted-foreground text-xs">{detail}</span>
    </li>
  )
}

function PreviewArrow() {
  return (
    <li aria-hidden className="text-muted-foreground self-center text-sm">
      <span className="hidden sm:inline">→</span>
      <span className="sm:hidden">↓</span>
    </li>
  )
}
