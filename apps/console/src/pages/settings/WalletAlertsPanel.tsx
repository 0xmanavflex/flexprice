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
import { Field, LoadingRows } from '@fp/ui/compositions'
import { Button, Input } from '@fp/ui/primitives'
import { useSession } from '@/app/session'
import { ActionError, ActionNote, Panel, PanelError, mutationMessage, toFailure, SettingsBlock } from './panelKit'
import { useDraft } from './useDraft'

/**
 * When a low wallet balance should raise an alarm — for every wallet at once.
 *
 * `GET/PUT/DELETE /settings/wallet_balance_alert_config`.
 *
 * ## This is not the "Alert rules" tab, and the two must not be merged
 *
 * The Alert rules tab next door is `/alerts/setting`: **per-entity** records,
 * each with its own id, each watching exactly one wallet, feature or
 * subscription. This is **one environment-wide default** behind a settings
 * key, with no id and no entity. They are stored separately, edited
 * separately, and a change to one is invisible in the other — so a future pass
 * that notices the two screens look alike and folds them together would
 * produce the worst kind of bug: a save that appears to work and changes
 * nothing the user was looking at. The shared vocabulary (`AlertCondition`,
 * `AlertThresholdType`, the three severities) is shared on purpose, because
 * "falls below 80" should mean one thing across the product. That shared
 * vocabulary is the whole of what the two features have in common.
 *
 * ## Why no currency symbol
 *
 * An absolute threshold here has no currency beside it, and that is not an
 * omission. The setting is tenant-wide: it applies to wallets denominated in
 * any currency this account holds, so "below 100" means a hundred of whatever
 * that wallet is counted in. Printing a `$` would be a claim the data does not
 * make. The per-wallet rules that *can* name a currency are the other tab's.
 *
 * ## Saving
 *
 * The whole config goes back on every save — `PUT` merges the top level only,
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

  if (!environmentId || config.isPending || !config.data) {
    return (
      <Panel>
        <LoadingRows rows={5} columns={2} />
      </Panel>
    )
  }

  // Keyed on the environment so switching environments re-seeds the draft
  // rather than leaving the previous environment's thresholds on screen.
  return <WalletAlertsForm key={environmentId} environmentId={environmentId} config={config.data} />
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
    // `null`, never a removed key: the model has no "absent" — see the note on
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
        <SettingsBlock
          title="Wallet balance alerts"
          description="One setting for every wallet in this environment. These are not the per-wallet rules on the Alert rules tab — changing this does not change those."
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
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Alerting</span>
            <div role="group" aria-label="Alerting" className="flex gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={draft.value.alertEnabled ? 'default' : 'outline'}
                aria-pressed={draft.value.alertEnabled}
                disabled={busy}
                onClick={() => draft.update((current) => ({ ...current, alertEnabled: true }))}
              >
                On
              </Button>
              <Button
                type="button"
                size="sm"
                variant={draft.value.alertEnabled ? 'outline' : 'default'}
                aria-pressed={!draft.value.alertEnabled}
                disabled={busy}
                onClick={() => draft.update((current) => ({ ...current, alertEnabled: false }))}
              >
                Off
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              A threshold that is set while alerting is off is stored but never fires. Off is the
              backend&rsquo;s default, thresholds and all.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Thresholds are</span>
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
            <p className="text-muted-foreground text-xs">
              {percentage
                ? 'A share of the wallet’s starting balance, from 0 to 100.'
                : 'A raw balance. No currency is shown because this setting covers wallets in every currency you hold — 100 means a hundred of whatever that wallet is counted in.'}
            </p>
          </div>
        </SettingsBlock>

        <SettingsBlock
          title="Thresholds"
          description="Up to three, escalating. Each is independent — set only the ones you want to hear about."
          actions={
            <div className="flex w-full flex-wrap items-center justify-end gap-3">
              <ActionError message={saveError} />
              {!saveError && update.isSuccess ? <ActionNote message="Saved." /> : null}
              {!saveError && reset.isSuccess ? <ActionNote message="Back to the defaults." /> : null}
              <Button type="submit" disabled={busy}>
                {update.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          }
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {ALERT_SEVERITY_ORDER.map((severity) => {
              const value = draft.value[severity]
              const error = draft.error(severity) ?? draft.error(`${severity}.threshold`)

              return (
                <div key={severity} className="flex flex-col gap-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{ALERT_SEVERITY_LABEL[severity]}</span>
                    <Button
                      type="button"
                      size="xs"
                      variant={value ? 'secondary' : 'outline'}
                      aria-pressed={value !== null}
                      disabled={busy}
                      onClick={() =>
                        setSeverity(
                          severity,
                          value ? null : { condition: AlertCondition.Below, threshold: '0' },
                        )
                      }
                    >
                      {value ? 'Remove' : 'Add'}
                    </Button>
                  </div>

                  {value ? (
                    <>
                      <div
                        role="group"
                        aria-label={`${ALERT_SEVERITY_LABEL[severity]} condition`}
                        className="flex gap-1.5"
                      >
                        {[AlertCondition.Below, AlertCondition.Above].map((condition) => (
                          <Button
                            key={condition}
                            type="button"
                            size="xs"
                            variant={value.condition === condition ? 'default' : 'outline'}
                            aria-pressed={value.condition === condition}
                            disabled={busy}
                            onClick={() => setSeverity(severity, { ...value, condition })}
                          >
                            {ALERT_CONDITION_LABEL[condition]}
                          </Button>
                        ))}
                      </div>

                      <Field
                        label={`${ALERT_SEVERITY_LABEL[severity]} threshold${percentage ? ' (%)' : ''}`}
                        {...(error ? { error } : {})}
                      >
                        {({ id, ...field }) => (
                          <Input
                            id={id}
                            inputMode="decimal"
                            value={value.threshold}
                            disabled={busy}
                            {...field}
                            onChange={(event) =>
                              setSeverity(severity, { ...value, threshold: event.target.value })
                            }
                          />
                        )}
                      </Field>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-xs">Not set — nothing fires.</p>
                  )}
                </div>
              )
            })}
          </div>
        </SettingsBlock>
      </Panel>
    </form>
  )
}
