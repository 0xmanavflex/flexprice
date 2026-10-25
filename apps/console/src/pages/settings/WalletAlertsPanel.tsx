import {
  ALERT_CONDITION_LABEL,
  ALERT_SEVERITY_LABEL,
  ALERT_SEVERITY_ORDER,
  ALERT_THRESHOLD_TYPE_LABEL,
  AlertCondition,
  type AlertSeverity,
  AlertThresholdType,
  type WalletAlertConfig,
  type WalletAlertThreshold,
  walletAlertConfigSchema,
} from '@fp/domain'
import {
  useResetWalletAlertConfig,
  useUpdateWalletAlertConfig,
  useWalletAlertConfig,
} from '@fp/query'
import { FormCard, FormRow } from '@fp/ui/compositions'
import { Button, Input, Switch } from '@fp/ui/primitives'
import { InfoIcon } from '@fp/ui/icons'
import { useSession } from '@/app/session'
import {
  ActionError,
  ActionNote,
  Panel,
  PanelError,
  PanelLoading,
  PanelUnavailable,
  mutationMessage,
  queryPhase,
  toFailure,
} from './panelKit'
import { useDraft } from './useDraft'

/**
 * When a low wallet balance should raise an alarm: for every wallet at once.
 *
 * `GET/PUT/DELETE /settings/wallet_balance_alert_config`.
 *
 * ## The layout is the create forms' (`FormCard`, ReUI form-9)
 *
 * One card, a label column on the left with each field's explanation behind
 * its (i), the control on the right, dashed rules between rows. The three
 * thresholds are rows of the same card rather than three boxes of their own,
 * so the whole setting reads top to bottom as one form.
 *
 * ## One environment-wide default, not per-entity rules
 *
 * This is one setting behind a settings key, with no id and no entity. The
 * per-entity alert records (`/alerts/setting`) are a different feature and are
 * no longer edited from Settings; the shared vocabulary (`AlertCondition`,
 * `AlertThresholdType`, the three severities) is shared on purpose, because
 * "falls below 80" should mean one thing across the product.
 *
 * ## Why no currency symbol
 *
 * An absolute threshold here has no currency beside it, and that is not an
 * omission. The setting is tenant-wide: it applies to wallets denominated in
 * any currency this account holds, so "below 100" means a hundred of whatever
 * that wallet is counted in. Printing a `$` would be a claim the data does not
 * make.
 *
 * ## Saving
 *
 * The whole config goes back on every save: `PUT` merges the top level only,
 * and a partially-sent object is a deletion of what it leaves out. A severity
 * that is switched off is sent as an explicit `null` rather than omitted, which
 * is what makes "stop warning me" writable at all.
 */
export function WalletAlertsPanel() {
  const { environmentId } = useSession()
  const config = useWalletAlertConfig(environmentId)

  const failure = toFailure(config.error, 'your wallet alert settings')

  if (failure) {
    return (
      <Panel>
        <PanelError failure={failure} onRetry={() => void config.refetch()} />
      </Panel>
    )
  }

  if (!environmentId) {
    return (
      <PanelUnavailable reason="setup" description="Choose an environment to see these settings." />
    )
  }

  const phase = queryPhase(config)
  if (phase === 'idle') return <PanelUnavailable reason="unavailable" />
  if (phase === 'loading' || !config.data) return <PanelLoading rows={5} />

  // Keyed on the environment so switching environments re-seeds the draft
  // rather than leaving the previous environment's thresholds on screen.
  return <WalletAlertsForm key={environmentId} environmentId={environmentId} config={config.data} />
}

/** What each severity row explains behind its (i). */
const SEVERITY_HINT: Record<AlertSeverity, string> = {
  info: 'The earliest, quietest warning. Leave it unset if you only want to hear about real trouble.',
  warning: 'The balance needs attention soon.',
  critical: 'The balance is about to run out. Usually the lowest threshold of the three.',
}

function WalletAlertsForm({
  environmentId,
  config,
}: {
  environmentId: string
  config: WalletAlertConfig
}) {
  const update = useUpdateWalletAlertConfig(environmentId)
  const reset = useResetWalletAlertConfig(environmentId)
  const draft = useDraft<WalletAlertConfig>(walletAlertConfigSchema, config)

  const busy = update.isPending || reset.isPending
  const saveError =
    mutationMessage(update.error, 'The wallet alert settings could not be saved.') ??
    mutationMessage(reset.error, 'The wallet alert settings could not be reset.')

  const percentage = draft.value.thresholdType === AlertThresholdType.Percentage

  function setSeverity(severity: AlertSeverity, next: WalletAlertThreshold) {
    // `null`, never a removed key: the model has no "absent": see the note on
    // `exactOptionalPropertyTypes` in `walletAlertConfig.ts`.
    draft.update((current) => ({ ...current, [severity]: next }))
  }

  return (
    <form
      className="contents"
      noValidate
      onSubmit={draft.handleSubmit((value) => {
        // The whole config, as loaded and mutated. Never a fresh object.
        update.mutate(value, { onSuccess: (saved) => draft.reset(saved) })
      })}
    >
      <Panel>
        <FormCard>
          <div className="text-muted-foreground flex items-start gap-2 px-5 py-4 text-[13px] sm:px-6">
            <InfoIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <p>
              One setting for every wallet in this environment, with up to three escalating
              thresholds. Each is independent: set only the ones you want to hear about.
            </p>
          </div>

          <FormRow
            label="Alerting"
            hint="A threshold that is set while alerting is off is stored but never fires. Off is the backend’s default."
          >
            {(props) => (
              <div className="flex items-center gap-2">
                <Switch
                  id={props.id}
                  aria-describedby={props['aria-describedby']}
                  checked={draft.value.alertEnabled}
                  disabled={busy}
                  onCheckedChange={(checked) =>
                    draft.update((current) => ({ ...current, alertEnabled: checked }))
                  }
                />
                <span className="text-muted-foreground text-sm">
                  {draft.value.alertEnabled ? 'On' : 'Off'}
                </span>
              </div>
            )}
          </FormRow>

          <FormRow
            label="Thresholds are"
            hint={
              percentage
                ? 'A share of the wallet’s starting balance, from 0 to 100.'
                : 'A raw balance. No currency is shown because this covers wallets in every currency you hold: 100 means a hundred of whatever that wallet is counted in.'
            }
          >
            <div role="group" aria-label="Threshold type" className="flex gap-1.5">
              {[AlertThresholdType.Absolute, AlertThresholdType.Percentage].map((option) => (
                <Button
                  key={option}
                  type="button"
                  size="sm"
                  variant={draft.value.thresholdType === option ? 'default' : 'outline'}
                  aria-pressed={draft.value.thresholdType === option}
                  disabled={busy}
                  onClick={() => draft.update((current) => ({ ...current, thresholdType: option }))}
                >
                  {ALERT_THRESHOLD_TYPE_LABEL[option]}
                </Button>
              ))}
            </div>
          </FormRow>

          {ALERT_SEVERITY_ORDER.map((severity) => {
            const value = draft.value[severity]
            const error = draft.error(severity) ?? draft.error(`${severity}.threshold`)
            const name = ALERT_SEVERITY_LABEL[severity]

            return (
              <FormRow
                key={severity}
                label={name}
                hint={SEVERITY_HINT[severity]}
                {...(error ? { error } : {})}
              >
                {value ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <div role="group" aria-label={`${name} condition`} className="flex gap-1.5">
                      {[AlertCondition.Below, AlertCondition.Above].map((condition) => (
                        <Button
                          key={condition}
                          type="button"
                          size="sm"
                          variant={value.condition === condition ? 'default' : 'outline'}
                          aria-pressed={value.condition === condition}
                          disabled={busy}
                          onClick={() => setSeverity(severity, { ...value, condition })}
                        >
                          {ALERT_CONDITION_LABEL[condition]}
                        </Button>
                      ))}
                    </div>
                    <Input
                      aria-label={`${name} threshold${percentage ? ' (%)' : ''}`}
                      aria-invalid={error ? true : undefined}
                      className="w-32"
                      inputMode="decimal"
                      value={value.threshold}
                      disabled={busy}
                      onChange={(event) =>
                        setSeverity(severity, { ...value, threshold: event.target.value })
                      }
                    />
                    {percentage ? <span className="text-muted-foreground text-sm">%</span> : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove the ${name.toLowerCase()} threshold`}
                      disabled={busy}
                      onClick={() => setSeverity(severity, null)}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      aria-label={`Add a ${name.toLowerCase()} threshold`}
                      disabled={busy}
                      onClick={() =>
                        setSeverity(severity, { condition: AlertCondition.Below, threshold: '0' })
                      }
                    >
                      Add
                    </Button>
                    <span className="text-muted-foreground text-sm">Not set: nothing fires.</span>
                  </div>
                )}
              </FormRow>
            )
          })}
        </FormCard>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <ActionError message={saveError} />
          {!saveError && update.isSuccess ? <ActionNote message="Saved." /> : null}
          {!saveError && reset.isSuccess ? <ActionNote message="Back to the defaults." /> : null}
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              update.reset()
              reset.mutate(undefined, { onSuccess: (defaults) => draft.reset(defaults) })
            }}
          >
            {reset.isPending ? 'Resetting…' : 'Reset to defaults'}
          </Button>
          <Button type="submit" disabled={busy}>
            {update.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </Panel>
    </form>
  )
}
