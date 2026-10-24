import { useState } from 'react'
import {
  ALERT_CONDITION_LABEL,
  ALERT_SEVERITY_LABEL,
  ALERT_SEVERITY_ORDER,
  ALERT_THRESHOLD_TYPE_LABEL,
  AlertCondition,
  AlertThresholdType,
  alertSettingConfigSchema,
  type AlertSettingConfig,
  type AlertSeverity,
} from '@fp/domain'
import { Composer } from '@ui/compositions/detail/DetailKit'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Switch } from '@ui/components/primitives/switch'
import { provenance } from '@ui/provenance'

export const ChargeAlertFormProvenance = provenance({
  source: 'composition',
  composes: ['compositions/detail/DetailKit', 'ui/button', 'ui/input', 'ui/switch'],
  note: 'Edit the thresholds of one charge alert setting. The watched line cannot be changed.',
})

const TYPES = [AlertThresholdType.Absolute, AlertThresholdType.Percentage].map((value) => ({
  value,
  label: ALERT_THRESHOLD_TYPE_LABEL[value],
}))

const CONDITIONS = [AlertCondition.Below, AlertCondition.Above].map((value) => ({
  value,
  label: ALERT_CONDITION_LABEL[value],
}))

/**
 * The thresholds of one alert setting.
 *
 * By default only the severities the setting already has are shown: an update
 * omits the rest, and the API keeps a severity it is not sent. With
 * `chooseSeverities` (a new setting, or one edited from an entity's menu)
 * every severity is listed with a switch, so info, warning and critical can
 * each be added or left off.
 */
export function ChargeAlertForm({
  initial,
  pending,
  error,
  onSubmit,
  onCancel,
  chooseSeverities = false,
  submitLabel = 'Save alerts',
}: {
  initial: AlertSettingConfig
  pending: boolean
  error: string | null
  onSubmit: (config: AlertSettingConfig) => void
  onCancel: () => void
  chooseSeverities?: boolean
  submitLabel?: string
}) {
  const [config, setConfig] = useState(initial)
  const [problem, setProblem] = useState<string | null>(null)
  // With alerts off, nothing below the switch applies; the values are kept.
  const off = pending || !config.alertEnabled
  const percentage = config.thresholdType === AlertThresholdType.Percentage
  const severities = chooseSeverities
    ? ALERT_SEVERITY_ORDER
    : ALERT_SEVERITY_ORDER.filter((severity) => initial[severity])

  const toggleSeverity = (severity: AlertSeverity, on: boolean) => {
    setConfig((current) => {
      if (!on) {
        const { [severity]: _removed, ...rest } = current
        return rest
      }
      return { ...current, [severity]: { condition: AlertCondition.Above, threshold: '' } }
    })
  }

  const setSeverity = (
    severity: AlertSeverity,
    patch: Partial<NonNullable<AlertSettingConfig[AlertSeverity]>>,
  ) => {
    setConfig((current) => {
      const value = current[severity]
      if (!value) return current
      return { ...current, [severity]: { ...value, ...patch } }
    })
  }

  return (
    <Composer
      submitLabel={submitLabel}
      onCancel={onCancel}
      submitting={pending}
      onSubmit={() => {
        // Turning alerts off saves the thresholds as they were loaded, not the
        // disabled draft: a half-typed value no one can now edit must not block it.
        const draft = config.alertEnabled ? config : { ...initial, alertEnabled: false }
        const parsed = alertSettingConfigSchema.safeParse(draft)
        if (!parsed.success) {
          setProblem(parsed.error.issues[0]?.message ?? 'Check the thresholds')
          return
        }
        setProblem(null)
        onSubmit(parsed.data)
      }}
    >
      <label className="flex items-center justify-between gap-3 text-sm">
        Alerts on
        <Switch
          checked={config.alertEnabled}
          disabled={pending}
          onCheckedChange={(alertEnabled) => setConfig({ ...config, alertEnabled })}
        />
      </label>
      {/* A two-way choice reads better as a switcher than a dropdown (as in Settings → Wallet alerts). */}
      <div className="flex flex-col gap-1.5">
        <span id="charge-alert-type" className="text-sm">
          Measured as
        </span>
        <div role="group" aria-labelledby="charge-alert-type" className="flex gap-1.5">
          {TYPES.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={config.thresholdType === option.value ? 'secondary' : 'outline'}
              aria-pressed={config.thresholdType === option.value}
              disabled={off}
              onClick={() => setConfig({ ...config, thresholdType: option.value })}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {severities.map((severity) => {
          const value = config[severity]
          const name = ALERT_SEVERITY_LABEL[severity]
          return (
            <div key={severity} className="flex flex-col gap-2">
              {/* The severity is named once: on its switch, or as the row's label. */}
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>{name}</span>
                {chooseSeverities ? (
                  <Switch
                    aria-label={`${name} alert`}
                    checked={Boolean(value)}
                    disabled={off}
                    onCheckedChange={(on) => toggleSeverity(severity, on)}
                  />
                ) : null}
              </div>
              {value ? (
                <div className="flex flex-wrap items-center gap-2">
                  <div role="group" aria-label={`${name} condition`} className="flex gap-1.5">
                    {CONDITIONS.map((condition) => (
                      <Button
                        key={condition.value}
                        type="button"
                        size="sm"
                        variant={value.condition === condition.value ? 'secondary' : 'outline'}
                        aria-pressed={value.condition === condition.value}
                        disabled={off}
                        onClick={() => setSeverity(severity, { condition: condition.value })}
                      >
                        {condition.label}
                      </Button>
                    ))}
                  </div>
                  <Input
                    id={`charge-alert-${severity}-value`}
                    aria-label={`${name} threshold${percentage ? ' (%)' : ''}`}
                    className="w-32"
                    inputMode="decimal"
                    placeholder={percentage ? '80' : '1000'}
                    value={value.threshold}
                    disabled={off}
                    onChange={(event) => setSeverity(severity, { threshold: event.target.value })}
                  />
                  {percentage ? <span className="text-muted-foreground text-sm">%</span> : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
      {problem || error ? (
        <p role="alert" className="text-destructive text-sm">
          {problem ?? error}
        </p>
      ) : null}
    </Composer>
  )
}
