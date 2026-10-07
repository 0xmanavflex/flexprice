import { useState } from 'react'
import {
  ALERT_CONDITION_LABEL,
  ALERT_ENTITY_TYPE_LABEL,
  ALERT_SEVERITY_LABEL,
  ALERT_SEVERITY_ORDER,
  ALERT_THRESHOLD_TYPE_LABEL,
  type AlertSetting,
  type AlertSettingConfig,
  AlertCondition,
  type AlertSeverity,
  AlertThresholdType,
  DEFAULT_ALERT_SETTING_QUERY,
  type AlertSettingQuery,
  alertSettingConfigSchema,
  configuredSeverities,
  toAlertSettingConfig,
} from '@fp/domain'
import { useAlertSettings, useDeleteAlertSetting, useUpdateAlertSetting } from '@fp/query'
import { ConfirmDialog, EmptyState, Field, LoadingRows } from '@fp/ui/compositions'
import {
  Badge,
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@fp/ui/primitives'
import { BellIcon } from 'lucide-react'
import {
  ActionError,
  PanelError,
  WidePanel,
  mutationMessage,
  toFailure,
  SettingsBlock,
  TableBlock,
} from './panelKit'

/**
 * Alert rules — thresholds that watch one thing each.
 *
 * ## These are not V1's wallet alerts
 *
 * V1 has a tenant-wide "warn me when any wallet balance drops below X", stored
 * behind `/settings/:key`, which has no API contract — it is the unavailable
 * "Wallet alerts" tab beside this one. What *does* exist is
 * `/alerts/setting`: a rule attached to **one entity** — a wallet, a feature, a
 * subscription, a line item — with up to three severities. They answer
 * different questions and this screen does not conflate them.
 *
 * ## The editor cannot repoint a rule
 *
 * `PUT /alerts/setting/:id` takes `{ config }` and nothing else — no
 * `entity_id`, no `entity_type`. The watched entity is fixed when the rule is
 * created. So the editor here shows what is being watched as read-only text
 * and only offers the thresholds. Offering an entity picker that the save call
 * would discard is how a form ends up lying about what it did.
 *
 * ## Creating one is not offered here, and that is deliberate
 *
 * `POST /alerts/setting` exists and `useCreateAlertSetting` is wired, but
 * creating a rule requires naming the entity to watch, and an entity id is a
 * ULID nobody types from memory. The picker belongs where the entity already
 * is — a wallet, a subscription, a feature — not on a settings tab that would
 * have to ask for a raw id. This tab is where the rules across the account are
 * reviewed, edited and switched off.
 */
export function AlertRulesPanel() {
  const [query] = useState<AlertSettingQuery>({ ...DEFAULT_ALERT_SETTING_QUERY, pageSize: 100 })
  const [editing, setEditing] = useState<AlertSetting | null>(null)
  const [deleting, setDeleting] = useState<AlertSetting | null>(null)

  const alerts = useAlertSettings(query)
  const remove = useDeleteAlertSetting()

  const failure = toFailure(alerts.error, 'your alert rules')
  const rows = alerts.data?.settings ?? []

  if (failure) {
    return (
      <WidePanel>
        <PanelError failure={failure} onRetry={() => void alerts.refetch()} />
      </WidePanel>
    )
  }

  return (
    <WidePanel>
      <TableBlock
        title="Alert rules"
        description="Each rule watches one thing — a wallet, a feature, a subscription — and fires when it crosses a threshold."
      >
        {alerts.isPending ? (
          <LoadingRows rows={3} columns={4} />
        ) : rows.length === 0 ? (
          <EmptyState
            size="inline"
            icon={<BellIcon aria-hidden />}
            title="No alert rules yet"
            description="A rule is attached to the thing it watches, so it is created from that wallet, feature or subscription rather than from here."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Watching</TableHead>
                <TableHead>Measured in</TableHead>
                <TableHead>Thresholds</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="w-px text-right whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((setting) => (
                <TableRow key={setting.id}>
                  <TableCell>
                    <span className="flex flex-col">
                      <span className="font-medium">
                        {ALERT_ENTITY_TYPE_LABEL[setting.entityType] ?? setting.entityType}
                      </span>
                      <span className="text-muted-foreground font-mono text-xs">
                        {setting.entityId}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {ALERT_THRESHOLD_TYPE_LABEL[setting.thresholdType]}
                  </TableCell>
                  <TableCell>
                    <ThresholdSummary setting={setting} />
                  </TableCell>
                  <TableCell>
                    {setting.enabled ? (
                      <Badge variant="success-light">On</Badge>
                    ) : (
                      <Badge variant="secondary">Off</Badge>
                    )}
                  </TableCell>
                  <TableCell className="w-px text-right whitespace-nowrap">
                    <span className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(setting)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(setting)}>
                        Delete
                      </Button>
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableBlock>

      {editing ? (
        <EditAlertSection key={editing.id} setting={editing} onDone={() => setEditing(null)} />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null)
            remove.reset()
          }
        }}
        title="Delete this alert rule?"
        description={
          deleting
            ? `Nothing will warn you about ${
                ALERT_ENTITY_TYPE_LABEL[deleting.entityType]?.toLowerCase() ?? deleting.entityType
              } ${deleting.entityId} any more.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        isPending={remove.isPending}
        error={mutationMessage(remove.error, 'The rule could not be deleted.')}
        onConfirm={() => {
          if (!deleting) return
          remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }}
      />
    </WidePanel>
  )
}

function ThresholdSummary({ setting }: { setting: AlertSetting }) {
  const severities = configuredSeverities(setting)
  if (severities.length === 0) {
    return <span className="text-muted-foreground">None set</span>
  }

  const suffix = setting.thresholdType === AlertThresholdType.Percentage ? '%' : ''

  return (
    <span className="flex flex-wrap gap-1.5">
      {severities.map((severity) => {
        const threshold = setting[severity]
        if (!threshold) return null
        return (
          <Badge
            key={severity}
            variant={severity === 'critical' ? 'destructive-light' : 'secondary'}
          >
            {ALERT_SEVERITY_LABEL[severity]}{' '}
            {ALERT_CONDITION_LABEL[threshold.condition].toLowerCase()} {threshold.threshold}
            {suffix}
          </Badge>
        )
      })}
    </span>
  )
}

/**
 * The thresholds, and only the thresholds.
 *
 * Not built with react-hook-form: `alertSettingConfigSchema` is a refined
 * schema (its cross-field rules live in a `superRefine`), and three optional
 * sub-objects that appear and disappear as severities are switched on is a
 * shape plain state expresses more honestly than a resolver would. The schema
 * is still the authority — it is run on submit, and its issues are what the
 * screen shows.
 */
function EditAlertSection({ setting, onDone }: { setting: AlertSetting; onDone: () => void }) {
  const update = useUpdateAlertSetting()
  const [config, setConfig] = useState<AlertSettingConfig>(() => toAlertSettingConfig(setting))
  const [issues, setIssues] = useState<Record<string, string>>({})

  const suffix = config.thresholdType === AlertThresholdType.Percentage ? '%' : ''

  function setSeverity(severity: AlertSeverity, next: AlertSettingConfig[AlertSeverity]) {
    setConfig((current) =>
      // `exactOptionalPropertyTypes` is on, so clearing a severity means
      // removing the key rather than assigning `undefined` to it.
      next === undefined
        ? (Object.fromEntries(
            Object.entries(current).filter(([key]) => key !== severity),
          ) as AlertSettingConfig)
        : { ...current, [severity]: next },
    )
  }

  function submit() {
    const result = alertSettingConfigSchema.safeParse(config)
    if (!result.success) {
      const next: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? 'form')
        next[key] ??= issue.message
      }
      setIssues(next)
      return
    }
    setIssues({})
    update.mutate({ id: setting.id, config: result.data }, { onSuccess: onDone })
  }

  return (
    <SettingsBlock
      title="Edit alert rule"
      description={`Watching ${
        ALERT_ENTITY_TYPE_LABEL[setting.entityType]?.toLowerCase() ?? setting.entityType
      } ${setting.entityId}. What a rule watches is fixed when it is created — the update call takes the thresholds and nothing else.`}
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Rule</span>
        <div className="flex gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={config.alertEnabled ? 'default' : 'outline'}
            aria-pressed={config.alertEnabled}
            onClick={() => setConfig({ ...config, alertEnabled: true })}
          >
            On
          </Button>
          <Button
            type="button"
            size="sm"
            variant={config.alertEnabled ? 'outline' : 'default'}
            aria-pressed={!config.alertEnabled}
            onClick={() => setConfig({ ...config, alertEnabled: false })}
          >
            Off
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Thresholds are</span>
        <div role="group" aria-label="Threshold type" className="flex gap-1.5">
          {[AlertThresholdType.Percentage, AlertThresholdType.Absolute].map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={config.thresholdType === option ? 'default' : 'outline'}
              aria-pressed={config.thresholdType === option}
              onClick={() => setConfig({ ...config, thresholdType: option })}
            >
              {ALERT_THRESHOLD_TYPE_LABEL[option]}
            </Button>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          {config.thresholdType === AlertThresholdType.Percentage
            ? 'A share of the entitlement, from 0 to 100.'
            : 'A raw amount, in whatever the entity is measured in.'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {ALERT_SEVERITY_ORDER.map((severity) => {
          const value = config[severity]

          return (
            <div key={severity} className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{ALERT_SEVERITY_LABEL[severity]}</span>
                <Button
                  type="button"
                  size="xs"
                  variant={value ? 'secondary' : 'outline'}
                  aria-pressed={value !== undefined}
                  onClick={() =>
                    setSeverity(
                      severity,
                      value ? undefined : { condition: AlertCondition.Above, threshold: '80' },
                    )
                  }
                >
                  {value ? 'Remove' : 'Add'}
                </Button>
              </div>

              {value ? (
                <>
                  <div className="flex gap-1.5">
                    {[AlertCondition.Above, AlertCondition.Below].map((condition) => (
                      <Button
                        key={condition}
                        type="button"
                        size="xs"
                        variant={value.condition === condition ? 'default' : 'outline'}
                        aria-pressed={value.condition === condition}
                        onClick={() => setSeverity(severity, { ...value, condition })}
                      >
                        {ALERT_CONDITION_LABEL[condition]}
                      </Button>
                    ))}
                  </div>

                  <Field
                    label={`${ALERT_SEVERITY_LABEL[severity]} threshold${suffix ? ' (%)' : ''}`}
                    {...(issues[severity] ? { error: issues[severity] } : {})}
                  >
                    {({ id, ...field }) => (
                      <Input
                        id={id}
                        inputMode="decimal"
                        value={value.threshold}
                        disabled={update.isPending}
                        {...field}
                        onChange={(event) =>
                          setSeverity(severity, { ...value, threshold: event.target.value })
                        }
                      />
                    )}
                  </Field>
                </>
              ) : (
                <p className="text-muted-foreground text-xs">Not set.</p>
              )}
            </div>
          )
        })}
      </div>

      {issues['form'] ? <ActionError message={issues['form']} /> : null}
      <ActionError message={mutationMessage(update.error, 'The rule could not be saved.')} />

      <div className="flex items-center gap-3">
        <Button disabled={update.isPending} onClick={submit}>
          {update.isPending ? 'Saving…' : 'Save rule'}
        </Button>
        <Button variant="ghost" disabled={update.isPending} onClick={onDone}>
          Cancel
        </Button>
      </div>
    </SettingsBlock>
  )
}
