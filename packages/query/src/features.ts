import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { type Flexprice, call } from '@fp/api'
import {
  type AggregationType,
  type CloneFeature,
  type CreateFeature,
  type EditFeature,
  type Feature,
  type FeatureQuery,
  type ReportingUnitDraft,
  FeatureStatus,
  FeatureType,
  FeatureSortField,
  FEATURE_FILTERS,
} from '@fp/domain'
import { type AlertConfigWire, toAlertConfig, toAlertConfigRequest } from './alertSettings'
import { queryKeys } from './keys'
import { toFilterConditions } from './search'
import { useFlexprice } from './provider'
import { sortWithTieBreak } from './listSort'

/**
 * Features: the translation between product vocabulary and the API.
 *
 * Two things worth knowing before reading further.
 *
 * **There is no `getFeature` in the SDK.** `GetFeature` and `ListFeatures` are
 * live routes that carry no swagger annotation, so they are absent from the
 * OpenAPI document and from every generated client. Both are reachable through
 * the documented `POST /features/search`, whose filter carries `featureIds`,
 * `lookupKey`, `nameContains`, `limit`/`offset` and `sort`: strictly more
 * capable than the GET it replaces. That is a documented endpoint doing what it
 * was designed for, not a workaround, so this needs no shim. See
 * `docs/api-contract-gap.md`.
 *
 * **A meter is created inline.** `CreateFeatureRequest` carries an optional
 * `meter`, so a metered feature and its meter are one call. Nothing here
 * touches `MeterApi`, which is 0 of 6 annotated and would have blocked this
 * surface entirely.
 */

/** The wire shape this reads. Structural, so a fixture need not be complete. */
export interface FeatureWire {
  alertSettings?: AlertConfigWire | undefined
  id?: string | undefined
  name?: string | undefined
  lookupKey?: string | undefined
  description?: string | undefined
  type?: string | undefined
  status?: string | undefined
  unitSingular?: string | undefined
  unitPlural?: string | undefined
  createdAt?: Date | undefined
  updatedAt?: Date | undefined
  meterId?: string | undefined
  groupId?: string | undefined
  metadata?: Record<string, string> | null | undefined
  reportingUnit?:
    | {
        unitSingular?: string | undefined
        unitPlural?: string | undefined
        conversionRate?: number | string | undefined
      }
    | undefined
  meter?:
    | {
        id?: string | undefined
        eventName?: string | undefined
        aggregation?:
          | {
              type?: string | undefined
              field?: string | undefined
              expression?: string | undefined
              groupBy?: string | undefined
              /** The meter's own usage window, when it is bucketed at the meter level. */
              bucketSize?: string | undefined
            }
          | undefined
        filters?: { key?: string | undefined; values?: string[] | undefined }[] | undefined
      }
    | undefined
}

const FEATURE_TYPES = new Set<string>(Object.values(FeatureType))
const FEATURE_STATUSES = new Set<string>(Object.values(FeatureStatus))

function toReportingUnit(wire: FeatureWire['reportingUnit']): ReportingUnitDraft | null {
  if (!wire || !wire.unitSingular || !wire.unitPlural || wire.conversionRate === undefined) {
    return null
  }
  return {
    unitSingular: wire.unitSingular,
    unitPlural: wire.unitPlural,
    // Kept as the decimal text it is displayed as; the number the SDK parsed is
    // only stringified, never computed on.
    conversionRate: String(wire.conversionRate),
  }
}

export function toFeature(wire: FeatureWire): Feature {
  const type = FEATURE_TYPES.has(wire.type ?? '')
    ? (wire.type as FeatureType)
    : // An unknown type is the API ahead of this client. Rendering it as boolean
      // is wrong but harmless; dropping the row would hide it entirely.
      FeatureType.Boolean

  const status = FEATURE_STATUSES.has(wire.status ?? '')
    ? (wire.status as FeatureStatus)
    : FeatureStatus.Published

  return {
    alertSettings: toAlertConfig(wire.alertSettings),
    id: wire.id ?? '',
    name: wire.name ?? 'Untitled feature',
    lookupKey: wire.lookupKey ?? '',
    description: wire.description ?? '',
    type,
    status,
    eventName: wire.meter?.eventName ?? null,
    aggregationType: (wire.meter?.aggregation?.type as AggregationType | undefined) ?? null,
    meterId: wire.meterId ?? wire.meter?.id ?? null,
    unitSingular: wire.unitSingular ?? '',
    unitPlural: wire.unitPlural ?? '',
    groupId: wire.groupId ? wire.groupId : null,
    reportingUnit: toReportingUnit(wire.reportingUnit),
    meterFilters: (wire.meter?.filters ?? [])
      .filter((f) => typeof f.key === 'string' && f.key.length > 0)
      .map((f) => ({ key: f.key ?? '', values: f.values ?? [] })),
    meterBucketSize: wire.meter?.aggregation?.bucketSize ? wire.meter.aggregation.bucketSize : null,
    aggregationField: wire.meter?.aggregation?.field ? wire.meter.aggregation.field : null,
    aggregationExpression: wire.meter?.aggregation?.expression
      ? wire.meter.aggregation.expression
      : null,
    aggregationGroupBy: wire.meter?.aggregation?.groupBy ? wire.meter.aggregation.groupBy : null,
    metadata: wire.metadata ?? {},
    createdAt: wire.createdAt ?? null,
    updatedAt: wire.updatedAt ?? null,
  }
}

/** Product sort names to the wire's. The only place the two are related. */
const SORT_FIELD: Record<FeatureSortField, string> = {
  [FeatureSortField.Name]: 'name',
  [FeatureSortField.LookupKey]: 'lookup_key',
  [FeatureSortField.Type]: 'type',
  [FeatureSortField.CreatedAt]: 'created_at',
  [FeatureSortField.UpdatedAt]: 'updated_at',
}

/**
 * Domain query out, `FeatureFilter` in. Page numbers are 1-based; offsets are not.
 *
 * `expand: 'meters'` is load-bearing, not an optimisation. The API returns
 * `meter_id` but embeds the meter object **only** when asked: see
 * `internal/ee/service/feature.go`, which populates `response.Items[i].Meter`
 * behind `filter.GetExpand().Has(types.ExpandMeters)`.
 *
 * Without it every metered feature arrives with no event name and no
 * aggregation, and the grid's "Measured by" column: the entire reason a
 * metered row is interesting: renders an em dash. Unit tests did not catch
 * this because the fixture I wrote embedded a meter; the captured response
 * does not.
 */
export function toFeatureFilter(query: FeatureQuery): Record<string, unknown> {
  return {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    sort: sortWithTieBreak(SORT_FIELD[query.sortBy], query.sortDirection),
    expand: 'meters',
    ...(query.search ? { nameContains: query.search } : {}),
    ...((query.filters?.length ?? 0) > 0
      ? { filters: toFilterConditions(query.filters ?? [], FEATURE_FILTERS) }
      : {}),
  }
}

/**
 * Domain draft out, `CreateFeatureRequest` in.
 *
 * Every field the API accepts but the product does not offer stays absent
 * rather than being threaded through the form as an untouched `undefined`.
 */
export function toCreateFeatureRequest(draft: CreateFeature): Record<string, unknown> {
  const base: Record<string, unknown> = {
    name: draft.name,
    type: draft.type,
    ...(draft.lookupKey ? { lookupKey: draft.lookupKey } : {}),
    ...(draft.description ? { description: draft.description } : {}),
    ...(draft.unitSingular ? { unitSingular: draft.unitSingular } : {}),
    ...(draft.unitPlural ? { unitPlural: draft.unitPlural } : {}),
    ...(draft.groupId ? { groupId: draft.groupId } : {}),
    ...(draft.reportingUnit ? { reportingUnit: toReportingUnitRequest(draft.reportingUnit) } : {}),
    ...(draft.alertSettings ? { alertSettings: toAlertConfigRequest(draft.alertSettings) } : {}),
  }

  if (draft.type !== FeatureType.Metered) return base

  const { meter } = draft
  return {
    ...base,
    meter: {
      // The API takes a meter name; the feature's name is the honest default
      // rather than a second field nobody has an answer for.
      name: draft.name,
      eventName: meter.eventName,
      resetUsage: meter.resetUsage,
      aggregation: {
        type: meter.aggregationType,
        ...(meter.field ? { field: meter.field } : {}),
        ...(meter.expression ? { expression: meter.expression } : {}),
        ...(meter.multiplier ? { multiplier: meter.multiplier } : {}),
        ...(meter.groupBy ? { groupBy: meter.groupBy } : {}),
      },
      ...(meter.filters && meter.filters.length > 0
        ? { filters: meter.filters.map(toFilterRequest) }
        : {}),
    },
  }
}

/**
 * The SDK types `conversionRate` as a number, the domain holds it as decimal
 * text. This is a wire-format conversion of an input, not arithmetic.
 */
function toReportingUnitRequest(unit: {
  unitSingular: string
  unitPlural: string
  conversionRate: string
}): Record<string, unknown> {
  return {
    unitSingular: unit.unitSingular,
    unitPlural: unit.unitPlural,
    conversionRate: Number(unit.conversionRate),
  }
}

function toFilterRequest(filter: { key: string; values: string[] }): Record<string, unknown> {
  return { key: filter.key, values: filter.values }
}

/**
 * Domain edit out, `UpdateFeatureRequest` in. The API patches by pointer: a key
 * that is absent is left alone. Type, lookup key and meter are immutable and so
 * are not in this request. Blank optional text is omitted rather than sent as an
 * empty string, since the API would read that as "set to empty" only for some
 * fields; the SDK also cannot send null, so a reporting unit or group cannot be
 * cleared through this call.
 */
export function toUpdateFeatureRequest(draft: EditFeature): Record<string, unknown> {
  return {
    name: draft.name,
    ...(draft.description !== undefined ? { description: draft.description } : {}),
    ...(draft.unitSingular ? { unitSingular: draft.unitSingular } : {}),
    ...(draft.unitPlural ? { unitPlural: draft.unitPlural } : {}),
    ...(draft.reportingUnit ? { reportingUnit: toReportingUnitRequest(draft.reportingUnit) } : {}),
    ...(draft.groupId ? { groupId: draft.groupId } : {}),
    ...(draft.alertSettings ? { alertSettings: toAlertConfigRequest(draft.alertSettings) } : {}),
    ...(draft.metadata ? { metadata: draft.metadata } : {}),
    // The API rejects `filters: []` on update ("Filters cannot be empty") and
    // merges what it is given into the meter's existing filters, so an empty
    // list is "nothing to change" and is left out.
    ...(draft.filters && draft.filters.length > 0
      ? { filters: draft.filters.map(toFilterRequest) }
      : {}),
  }
}

/** Domain clone out, `CloneFeatureRequest` in. */
export function toCloneFeatureRequest(draft: CloneFeature): Record<string, unknown> {
  return {
    name: draft.name,
    lookupKey: draft.lookupKey,
    ...(draft.description ? { description: draft.description } : {}),
  }
}

export interface FeaturePage {
  features: Feature[]
  total: number
}

export async function fetchFeatures(
  client: Flexprice,
  query: FeatureQuery,
  signal?: AbortSignal,
): Promise<FeaturePage> {
  const response = await call(
    (options) => client.features.queryFeature(toFeatureFilter(query) as never, options),
    signal,
  )
  const features = (response.items ?? []).map((item) => toFeature(item as FeatureWire))

  // Type and status are not server-side filters on FeatureFilter, so they are
  // applied here. Stated rather than hidden: they narrow the current page, not
  // the whole set, which is why the count below reports what is actually shown.
  let rows = features
  if (query.types.length > 0) rows = rows.filter((f) => query.types.includes(f.type))
  if (query.statuses.length > 0) rows = rows.filter((f) => query.statuses.includes(f.status))

  return {
    features: rows,
    total: response.pagination?.total ?? 0,
  }
}

export function useFeatures(query: FeatureQuery, options: { enabled?: boolean } = {}) {
  const client = useFlexprice()

  // `view` is a layout, not a filter: it changes nothing about what is fetched,
  // so it stays out of the key: toggling table/cards must not miss the cache.
  const { view: _view, ...key } = query

  return useQuery({
    queryKey: queryKeys.features.list({
      ...key,
      types: [...query.types].sort(),
      statuses: [...query.statuses].sort(),
    }),
    queryFn: ({ signal }) => fetchFeatures(client, query, signal),
    enabled: options.enabled ?? true,
    placeholderData: (previous) => previous,
  })
}

/** One feature, fetched through search because `GET /features/{id}` is undocumented. */
export function useFeature(id: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.features.detail(id),
    queryFn: async ({ signal }) => {
      const response = await call(
        (options) =>
          client.features.queryFeature(
            { featureIds: [id], limit: 1, expand: 'meters' } as never,
            options,
          ),
        signal,
      )
      const first = (response.items ?? [])[0]
      return first ? toFeature(first as FeatureWire) : null
    },
    enabled: id.length > 0,
  })
}

const METER_FEATURE_PAGE = 100

/**
 * The features on a set of meters, whatever page of the catalogue they sit on:
 * searched by `meter_ids`, 100 at a time until the reported total. Empty
 * meters read nothing.
 */
export function useFeaturesByMeters(meterIds: readonly string[]) {
  const client = useFlexprice()
  const ids = [...new Set(meterIds)].sort()

  return useQuery({
    queryKey: queryKeys.features.list({ meterIds: ids }),
    queryFn: async ({ signal }) => {
      // Page by page to the reported total: several features can share a meter.
      const features: Feature[] = []
      for (let offset = 0; ; offset += METER_FEATURE_PAGE) {
        const response = await call(
          (options) =>
            client.features.queryFeature(
              {
                meterIds: ids,
                limit: METER_FEATURE_PAGE,
                offset,
                // A total order, so no feature moves across a page boundary.
                sort: sortWithTieBreak('name', 'asc'),
                expand: 'meters',
              },
              options,
            ),
          signal,
        )
        const items = response.items ?? []
        features.push(...items.map((item) => toFeature(item as FeatureWire)))
        const total = response.pagination?.total ?? 0
        if (items.length < METER_FEATURE_PAGE || features.length >= total) break
      }
      return features
    },
    enabled: ids.length > 0,
  })
}

export function useCreateFeature() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    meta: { notify: { success: 'Feature created', error: 'Could not create the feature.' } },
    mutationFn: (draft: CreateFeature) =>
      call(() => client.features.createFeature(toCreateFeatureRequest(draft) as never)),
    onSuccess: () => {
      // Invalidating the prefix covers every list and filter combination.
      void queryClient.invalidateQueries({ queryKey: queryKeys.features.all() })
    },
  })
}

export function useUpdateFeature() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: EditFeature }) =>
      call(() => client.features.updateFeature(id, toUpdateFeatureRequest(draft) as never)),
    onSuccess: (_result, { id }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.features.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.features.detail(id) })
    },
  })
}

/** Archive/delete a feature: `DELETE /features/{id}`. Takes the feature id. */
export function useDeleteFeature() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => call(() => client.features.deleteFeature(id)),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.features.all() })
      void queryClient.removeQueries({ queryKey: queryKeys.features.detail(id) })
    },
  })
}

/** Clone a feature, `POST /features/{id}/clone`. Resolves to the new feature's wire record. */
export function useCloneFeature() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: CloneFeature }) =>
      call(() => client.features.cloneFeature(id, toCloneFeatureRequest(draft) as never)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.features.all() })
    },
  })
}
