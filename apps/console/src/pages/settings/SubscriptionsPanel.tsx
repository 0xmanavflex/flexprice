import { useState } from 'react'
import { type SubscriptionConfig, subscriptionConfigSchema } from '@fp/domain'
import {
  useResetSubscriptionConfig,
  useSubscriptionConfig,
  useUpdateSubscriptionConfig,
} from '@fp/query'
import { ConfirmDialog, EmptyState, SettingRow, SettingsFieldGroup } from '@fp/ui/compositions'
import { Button, Input } from '@fp/ui/primitives'
import { useSession } from '@/app/session'
import {
  ActionError,
  ActionNote,
  DelayedHint,
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
 * What happens to a subscription that is not paid for.
 *
 * `GET/PUT/DELETE /settings/subscription_config`. Two fields that read as one
 * sentence: after `gracePeriodDays` of non-payment, cancel the subscription,
 * or do not: which is why the screen is built around a sentence rather than
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
 * which is never a deliberate setting: it is a cleared field that was saved.
 * So the floor is enforced here, at the point where somebody meant something,
 * and only while the rule is switched on.
 */
export function SubscriptionsPanel() {
  const { environmentId } = useSession()
  const config = useSubscriptionConfig(environmentId)

  const failure = toFailure(config.error, 'your contract settings')

  if (!environmentId) {
    return (
      <Panel>
        <SettingsBlock label="Unpaid contracts">
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

  const phase = queryPhase(config)
  if (phase === 'idle') return <PanelUnavailable reason="unavailable" />
  if (phase === 'loading' || !config.data) return <PanelLoading rows={3} />

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

  const saveError = mutationMessage(update.error, 'The contract settings could not be saved.')
  const resetError = mutationMessage(reset.error, 'The contract settings could not be reset.')
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
      // fail validation on a field nobody can see: an invisible failure, and
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
          <SettingsBlock
            label="Unpaid contracts"
            flush
            info={
              enabled
                ? `${Number.isFinite(days) && days > 0 ? `${days} ${days === 1 ? 'day' : 'days'}` : 'Some days'} after an invoice is overdue, the contract is cancelled and stops billing.`
                : 'Contracts keep running when an invoice is overdue; the invoice stays open in Collections.'
            }
            actions={
              <div className="flex w-full flex-wrap items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setResetting(true)}
                >
                  Reset to defaults
                </Button>
                <div className="flex items-center gap-3">
                  <ActionError message={saveError} />
                  {!saveError && update.isSuccess ? <ActionNote message="Saved." /> : null}
                  {!resetError && reset.isSuccess ? (
                    <ActionNote message="Back to the defaults." />
                  ) : null}
                  <Button type="submit" variant="outline" disabled={busy}>
                    {update.isPending ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              </div>
            }
          >
            <SettingsFieldGroup
              legend="Unpaid contracts"
              description="Whether Flexprice cancels a contract when its invoices go unpaid."
            >
              <SettingRow
                title="When an invoice stays unpaid"
                titleAddon={
                  <DelayedHint text="Keeping the contract active is the default. Cancelling a paying customer is something you opt into." />
                }
              >
                <div
                  role="group"
                  aria-label="When an invoice stays unpaid"
                  className="bg-muted flex gap-0.5 rounded-lg p-0.5"
                >
                  {[
                    { value: false, label: 'Keep it active' },
                    { value: true, label: 'Cancel it' },
                  ].map((option) => (
                    <Button
                      key={option.label}
                      type="button"
                      size="sm"
                      variant={enabled === option.value ? 'outline' : 'ghost'}
                      aria-pressed={enabled === option.value}
                      disabled={busy}
                      className={enabled === option.value ? '' : 'text-muted-foreground'}
                      onClick={() => setEnabled(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </SettingRow>
              <SettingRow
                title="Grace period"
                titleAddon={
                  <DelayedHint text="How long non-payment is tolerated before the contract is cancelled. At least one day." />
                }
                labelFor="subscription-grace-days"
                last
              >
                <div className="flex w-full flex-col gap-1">
                  <div
                    className={
                      enabled ? 'flex items-center gap-2' : 'flex items-center gap-2 opacity-50'
                    }
                  >
                    <Input
                      id="subscription-grace-days"
                      disabled={busy || !enabled}
                      inputMode="numeric"
                      aria-invalid={graceError ? true : undefined}
                      value={daysText}
                      onChange={(event) => setDays(event.target.value)}
                    />
                    <span className="text-muted-foreground text-sm">Days</span>
                  </div>
                  {graceError ? (
                    <p role="alert" className="text-destructive text-xs">
                      {graceError}
                    </p>
                  ) : null}
                </div>
              </SettingRow>
            </SettingsFieldGroup>
          </SettingsBlock>
        </Panel>
      </form>

      <ConfirmDialog
        open={resetting}
        onOpenChange={setResetting}
        title="Reset contract settings?"
        description="This environment goes back to the Flexprice defaults: automatic cancellation off, with the default grace period. Contracts already cancelled are not restored."
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
