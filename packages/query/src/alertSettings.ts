import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type Flexprice, call } from '@fp/api'
import {
  ALERT_SEVERITY_ORDER,
  AlertCondition,
  AlertEntityType,
  type AlertSetting,
  type AlertSettingConfig,
  type AlertSettingQuery,
  AlertThresholdType,
  type AlertThreshold,
  type CreateAlertSetting,
  toAlertSettingConfig,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

/**
 * Per-entity alert settings. Full CRUD.
 *
 * `POST /alerts/setting/search`, `POST /alerts/setting`,
 * `GET|PUT|DELETE /alerts/setting/{id}`.
 *
 * To say it once more where the code is: **this is not V1's wallet-balance
 * alert config.** That one lives behind `GET/PUT /settings/wallet_balance_alert_config`,
 * is tenant-wide, and has no SDK module at all. These are per-entity records
 * with their own ids. A screen that edits one believing it is editing the other
 * changes nothing the user expects and silently leaves the real setting alone.
 *
 * The update route takes **only** `config`: the watched entity is fixed at
 * creation, so `toUpdateAlertSettingRequest` has no `entityId` to send and an
 * editor must not offer to repoint an alert.
 */

interface ThresholdWire {
  condition?: string | undefined
  threshold?: string | undefined
}

export interface AlertConfigWire {
  alertEnabled?: boolean | undefined
  alertThresholdType?: string | undefined
  info?: ThresholdWire | undefined
  warning?: ThresholdWire | undefined
  critical?: ThresholdWire | undefined
}

/** The wire shape this reads, after the SDK camelCases the response. */
export interface AlertSettingWire {
  id?: string | undefined
  entityId?: string | undefined
  entityType?: string | undefined
  parentEntityId?: string | undefined
  parentEntityType?: string | undefined
  enabled?: boolean | undefined
  config?: AlertConfigWire | undefined
  createdAt?: Date | undefined
  updatedAt?: Date | undefined
}

const ALERT_ENTITY_TYPES = new Set<string>(Object.values(AlertEntityType))
const ALERT_CONDITIONS = new Set<string>(Object.values(AlertCondition))
const ALERT_THRESHOLD_TYPES = new Set<string>(Object.values(AlertThresholdType))

/**
 * One severity's threshold, or null when it is not configured.
 *
 * A threshold object with no number in it is not a threshold: the API can send
 * `{}` for a severity that was never set, and treating that as `"0"` would
 * render an alert that appears to fire at zero.
 */
function toThreshold(wire: ThresholdWire | undefined): AlertThreshold | null {
  if (!wire || typeof wire.threshold !== 'string' || wire.threshold.length === 0) return null

  return {
    condition: ALERT_CONDITIONS.has(wire.condition ?? '')
      ? (wire.condition as AlertCondition)
      : AlertCondition.Above,
    threshold: wire.threshold,
  }
}

/**
 * An `AlertSettings` object as an entity carries it inline (a feature's
 * `alert_settings`), back into the editor's config. Null when nothing is set,
 * so the editor can say "nothing watches this yet".
 */
export function toAlertConfig(wire: AlertConfigWire | undefined): AlertSettingConfig | null {
  if (!wire) return null
  const info = toThreshold(wire.info)
  const warning = toThreshold(wire.warning)
  const critical = toThreshold(wire.critical)
  if (!info && !warning && !critical) return null
  return {
    alertEnabled: wire.alertEnabled ?? true,
    // Unset means absolute to the API (flexprice `types.AlertThresholdType`:
    // "Empty value is treated as absolute"), as settings written before the
    // type existed are. Reading it as percentage turned "below 100 credits"
    // into "below 100%", and saving wrote that back.
    thresholdType: ALERT_THRESHOLD_TYPES.has(wire.alertThresholdType ?? '')
      ? (wire.alertThresholdType as AlertThresholdType)
      : AlertThresholdType.Absolute,
    ...(info ? { info } : {}),
    ...(warning ? { warning } : {}),
    ...(critical ? { critical } : {}),
  }
}

export function toAlertSetting(wire: AlertSettingWire): AlertSetting {
  const entityType = ALERT_ENTITY_TYPES.has(wire.entityType ?? '')
    ? (wire.entityType as AlertEntityType)
    : AlertEntityType.Subscription

  const thresholdType = ALERT_THRESHOLD_TYPES.has(wire.config?.alertThresholdType ?? '')
    ? (wire.config?.alertThresholdType as AlertThresholdType)
    : // Unset is absolute to the API, as in `toAlertConfig`.
      AlertThresholdType.Absolute

  return {
    id: wire.id ?? '',
    entityId: wire.entityId ?? '',
    entityType,
    parentEntityId: wire.parentEntityId ?? '',
    parentEntityType: wire.parentEntityType ?? '',
    // Two switches on the wire: `enabled` on the record and `alertEnabled` in
    // the config. The record's is the one the list toggles; the config's is
    // carried back out by `toAlertSettingConfig` for the editor.
    enabled: wire.enabled ?? wire.config?.alertEnabled ?? false,
    thresholdType,
    info: toThreshold(wire.config?.info),
    warning: toThreshold(wire.config?.warning),
    critical: toThreshold(wire.config?.critical),
    createdAt: wire.createdAt ?? null,
    updatedAt: wire.updatedAt ?? null,
  }
}

/**
 * Domain query out, `AlertSettingsFilter` in.
 *
 * `entityType`, `entityId` and `enabled` are declared on the filter model and
 * remapped to `entity_type`, `entity_id`, `enabled` by the SDK: so they are
 * written camelCase here. `enabled` is sent only when the query takes a side:
 * `false` is a real filter value, so the null check is `!== null`, not falsy.
 */
export function toAlertSettingFilter(query: AlertSettingQuery): Record<string, unknown> {
  return {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.entityId ? { entityId: query.entityId } : {}),
    ...(query.enabled !== null ? { enabled: query.enabled } : {}),
  }
}

export interface AlertSettingPage {
  settings: AlertSetting[]
  total: number
}

export async function fetchAlertSettings(
  client: Flexprice,
  query: AlertSettingQuery,
): Promise<AlertSettingPage> {
  const response = await call(() =>
    client.alertSettings.queryAlertSettings(toAlertSettingFilter(query) as never),
  )

  return {
    settings: (response.items ?? []).map((item) => toAlertSetting(item as AlertSettingWire)),
    total: response.pagination?.total ?? 0,
  }
}

export function useAlertSettings(query: AlertSettingQuery, options: { enabled?: boolean } = {}) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.alertSettings.list({ ...query }),
    queryFn: () => fetchAlertSettings(client, query),
    placeholderData: (previous) => previous,
    enabled: options.enabled ?? true,
  })
}

export function useAlertSetting(id: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.alertSettings.detail(id),
    queryFn: async () => {
      const wire = await call(() => client.alertSettings.getAlertSettings(id))
      return toAlertSetting(wire as AlertSettingWire)
    },
    enabled: id.length > 0,
  })
}

/**
 * The `config` block both writes share.
 *
 * A severity the draft leaves out is omitted rather than sent as null: the
 * SDK's zod schema rejects a null where it expects an object, and an omitted
 * severity is how the API is told that severity is not configured.
 */
export function toAlertConfigRequest(config: AlertSettingConfig): Record<string, unknown> {
  const thresholds: Record<string, unknown> = {}
  for (const severity of ALERT_SEVERITY_ORDER) {
    const value = config[severity]
    if (value) thresholds[severity] = { condition: value.condition, threshold: value.threshold }
  }

  return {
    alertEnabled: config.alertEnabled,
    alertThresholdType: config.thresholdType,
    ...thresholds,
  }
}

/**
 * The create request.
 *
 * `parentEntityId` is required when the watched entity is a line item or a
 * group: it names the subscription that owns it: and must be absent for a
 * subscription-level alert, so it is spread in rather than sent empty.
 */
export function toCreateAlertSettingRequest(draft: CreateAlertSetting): Record<string, unknown> {
  return {
    entityId: draft.entityId,
    entityType: draft.entityType,
    ...(draft.parentEntityId ? { parentEntityId: draft.parentEntityId } : {}),
    ...(draft.parentEntityType ? { parentEntityType: draft.parentEntityType } : {}),
    config: toAlertConfigRequest(draft.config),
  }
}

/** The update request. Only `config`: the watched entity cannot be changed. */
export function toUpdateAlertSettingRequest(config: AlertSettingConfig): Record<string, unknown> {
  return { config: toAlertConfigRequest(config) }
}

async function createSetting(client: Flexprice, draft: CreateAlertSetting) {
  const wire = await call(() =>
    client.alertSettings.createAlertSettings(toCreateAlertSettingRequest(draft) as never),
  )
  return toAlertSetting(wire as AlertSettingWire)
}

async function updateSetting(client: Flexprice, id: string, config: AlertSettingConfig) {
  const wire = await call(() =>
    client.alertSettings.updateAlertSettings(id, toUpdateAlertSettingRequest(config) as never),
  )
  return toAlertSetting(wire as AlertSettingWire)
}

export function useCreateAlertSetting() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (draft: CreateAlertSetting) => {
      return createSetting(client, draft)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.alertSettings.all() })
    },
  })
}

/**
 * Alerts on one contract line item. The contract's alert read lists only live
 * settings with thresholds, so a line that looks bare can still hold a
 * switched-off or empty setting: that one is updated rather than a second
 * created beside it.
 */
/**
 * The line's live setting (switched off or not), or undefined. Archived ones
 * are left out by the server, so the first page holds it however many were
 * archived before it.
 */
async function findLineItemSetting(client: Flexprice, subscriptionId: string, lineId: string) {
  const found = await call(() =>
    client.alertSettings.queryAlertSettings({
      entityType: AlertEntityType.SubscriptionLineItem,
      entityId: lineId,
      parentEntityId: subscriptionId,
      status: 'published',
      limit: 10,
    }),
  )
  return (found.items ?? []).find((item) => item.id && item.entityId === lineId)
}

/**
 * Reads a line's stored thresholds before alerts are added to it, so a
 * switched-off setting opens on what it held rather than being overwritten
 * unseen. Null when the line has none.
 */
export function useLineItemAlertLookup(subscriptionId: string) {
  const client = useFlexprice()
  return async (lineId: string): Promise<AlertSettingConfig | null> => {
    const existing = await findLineItemSetting(client, subscriptionId, lineId)
    return existing ? toAlertSettingConfig(toAlertSetting(existing as AlertSettingWire)) : null
  }
}

export function useAddLineItemAlert(subscriptionId: string) {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ lineId, config }: { lineId: string; config: AlertSettingConfig }) => {
      const existing = await findLineItemSetting(client, subscriptionId, lineId)
      return existing?.id
        ? updateSetting(client, existing.id, config)
        : createSetting(client, {
            entityType: AlertEntityType.SubscriptionLineItem,
            entityId: lineId,
            parentEntityId: subscriptionId,
            parentEntityType: AlertEntityType.Subscription,
            config,
          })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.alertSettings.all() })
    },
  })
}

export function useUpdateAlertSetting() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, config }: { id: string; config: AlertSettingConfig }) => {
      return updateSetting(client, id, config)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.alertSettings.all() })
    },
  })
}

export function useDeleteAlertSetting() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => call(() => client.alertSettings.deleteAlertSettings(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.alertSettings.all() })
    },
  })
}
