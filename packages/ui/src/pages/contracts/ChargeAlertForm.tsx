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
import { OptionSelect } from '@ui/compositions/forms/OptionSelect'
import { Input } from '@ui/components/primitives/input'
import { Switch } from '@ui/components/primitives/switch'
import { provenance } from '@ui/provenance'

export const ChargeAlertFormProvenance = provenance({
  source: 'composition',
  composes: ['compositions/detail/DetailKit', 'compositions/option-select', 'ui/input', 'ui/switch'],
  note: 'Edit the thresholds of one charge alert setting. The watched line cannot be changed.',
})

const TYPES = Object.values(AlertThresholdType).map((value) => ({
  value,
  label: ALERT_THRESHOLD_TYPE_LABEL[value],
}))

const CONDITIONS = Object.values(AlertCondition).map((value) => ({
  value,
  label: ALERT_CONDITION_LABEL[value],
}))

/**
 * The alert settings already on one charge.
 *
 * Only the severities the setting already has are shown. An update omits the
 * rest, and the API keeps a severity it is not sent.
 */
export function ChargeAlertForm({
  initial,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  initial: AlertSettingConfig
  pending: boolean
  error: string | null
  onSubmit: (config: AlertSettingConfig) => void
  onCancel: () => void
}) {
  const [config, setConfig] = useState(initial)
  const [problem, setProblem] = useState<string | null>(null)
  const severities = ALERT_SEVERITY_ORDER.filter((severity) => initial[severity])

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
      submitLabel="Save alerts"
      onCancel={onCancel}
      submitting={pending}
      onSubmit={() => {
        const parsed = alertSettingConfigSchema.safeParse(config)
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
      <div className="flex flex-col gap-1.5">
        <label htmlFor="charge-alert-type" className="text-sm">
          Measured as
        </label>
        <OptionSelect
          id="charge-alert-type"
          value={config.thresholdType}
          disabled={pending}
          onValueChange={(thresholdType) =>
            setConfig({ ...config, thresholdType: thresholdType as AlertThresholdType })
          }
          options={TYPES}
        />
      </div>
      {severities.map((severity) => {
        const value = config[severity]
        if (!value) return null
        return (
          <div key={severity} className="grid gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`charge-alert-${severity}-when`} className="text-sm">
                {ALERT_SEVERITY_LABEL[severity]}
              </label>
              <OptionSelect
                id={`charge-alert-${severity}-when`}
                value={value.condition}
                disabled={pending}
                onValueChange={(condition) =>
                  setSeverity(severity, { condition: condition as AlertCondition })
                }
                options={CONDITIONS}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`charge-alert-${severity}-value`} className="text-sm">
                Threshold
              </label>
              <Input
                id={`charge-alert-${severity}-value`}
                inputMode="decimal"
                value={value.threshold}
                disabled={pending}
                onChange={(event) => setSeverity(severity, { threshold: event.target.value })}
              />
            </div>
          </div>
        )
      })}
      {problem || error ? (
        <p role="alert" className="text-destructive text-sm">
          {problem ?? error}
        </p>
      ) : null}
    </Composer>
  )
}
