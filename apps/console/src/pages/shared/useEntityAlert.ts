import { useState } from 'react'
import {
  type AlertEntityType,
  type AlertSettingConfig,
  DEFAULT_ALERT_SETTING_QUERY,
  emptyAlertSettingConfig,
  toAlertSettingConfig,
} from '@fp/domain'
import { useAlertSettings, useCreateAlertSetting, useUpdateAlertSetting } from '@fp/query'
import type { EntityAlertDialogProps } from '@fp/ui/pages'

/**
 * V1's "Alert Settings" for one entity (a contract, feature or wallet): open,
 * read the setting that watches it, then create it or update its thresholds.
 *
 * The read runs only while the dialog is open, so a detail page does not pay
 * for it on every visit. An entity has at most one setting, so the first match
 * is the one edited.
 */
export function useEntityAlert(entityType: AlertEntityType, entityId: string, noun: string) {
  const [open, setOpen] = useState(false)
  const settings = useAlertSettings(
    { ...DEFAULT_ALERT_SETTING_QUERY, pageSize: 1, entityType, entityId },
    { enabled: open && entityId.length > 0 },
  )
  const create = useCreateAlertSetting()
  const update = useUpdateAlertSetting()

  const existing = settings.data?.settings[0] ?? null

  const dialog: EntityAlertDialogProps = {
    open,
    onOpenChange: setOpen,
    noun,
    isLoading: open && settings.isPending,
    loadFailed: settings.isError && !settings.data,
    onRetry: () => void settings.refetch(),
    isNew: existing === null,
    initial: existing ? toAlertSettingConfig(existing) : emptyAlertSettingConfig(),
    onSave: (config: AlertSettingConfig) =>
      existing
        ? update.mutateAsync({ id: existing.id, config })
        : create.mutateAsync({ entityType, entityId, config }),
  }

  return { openAlertSettings: () => setOpen(true), dialog }
}
