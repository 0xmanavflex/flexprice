import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { type Flexprice, call } from '@fp/api'
import {
  type AggregationType,
  type CreateFeature,
  type Feature,
  type FeatureQuery,
  FeatureType,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

/**
 * Features: the translation between product vocabulary and the API.
 *
 * Two things worth knowing before reading further.
 *
 * **There is no `getFeature` in the SDK.** `GetFeature` and `ListFeatures` are
 * live routes that carry no swagger annotation, so they are absent from the
 * OpenAPI document and from every generated client. Both are reachable through
 * the documented `POST /features/search`, whose filter carries `featureIds`,
 * `lookupKey`, `nameContains`, `limit`/`offset` and `sort` — strictly more
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
  id?: string | undefined
  name?: string | undefined
  lookupKey?: string | undefined
  description?: string | undefined
  type?: string | undefined
  unitSingular?: string | undefined
  unitPlural?: string | undefined
  createdAt?: Date | undefined
  meter?:
    | { eventName?: string | undefined; aggregation?: { type?: string | undefined } | undefined }
    | undefined
}

const FEATURE_TYPES = new Set<string>(Object.values(FeatureType))

export function toFeature(wire: FeatureWire): Feature {
  const type = FEATURE_TYPES.has(wire.type ?? '')
    ? (wire.type as FeatureType)
    : // An unknown type is the API ahead of this client. Rendering it as boolean
      // is wrong but harmless; dropping the row would hide it entirely.
      FeatureType.Boolean

  return {
    id: wire.id ?? '',
    name: wire.name ?? 'Untitled feature',
    lookupKey: wire.lookupKey ?? '',
    description: wire.description ?? '',
    type,
    eventName: wire.meter?.eventName ?? null,
    aggregationType: (wire.meter?.aggregation?.type as AggregationType | undefined) ?? null,
    unitSingular: wire.unitSingular ?? '',
    unitPlural: wire.unitPlural ?? '',
    createdAt: wire.createdAt ?? null,
  }
}

/** Domain query out, `FeatureFilter` in. Page numbers are 1-based; offsets are not. */
export function toFeatureFilter(query: FeatureQuery): Record<string, unknown> {
  return {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    sort: [{ field: 'name', direction: 'asc' }],
    ...(query.search ? { nameContains: query.search } : {}),
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
      },
    },
  }
}

export interface FeaturePage {
  features: Feature[]
  total: number
}

export async function fetchFeatures(
  client: Flexprice,
  query: FeatureQuery,
): Promise<FeaturePage> {
  const response = await call(() =>
    client.features.queryFeature(toFeatureFilter(query) as never),
  )
  const features = (response.items ?? []).map((item) => toFeature(item as FeatureWire))

  return {
    // Type is not a server-side filter on FeatureFilter, so it is applied here.
    // Stated rather than hidden: it narrows the current page, not the whole set,
    // which is why the count below reports what is actually shown.
    features: query.types.length > 0
      ? features.filter((f) => query.types.includes(f.type))
      : features,
    total: response.pagination?.total ?? 0,
  }
}

export function useFeatures(query: FeatureQuery) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.features.list({ ...query, types: [...query.types].sort() }),
    queryFn: () => fetchFeatures(client, query),
    placeholderData: (previous) => previous,
  })
}

/** One feature, fetched through search because `GET /features/{id}` is undocumented. */
export function useFeature(id: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.features.detail(id),
    queryFn: async () => {
      const response = await call(() =>
        client.features.queryFeature({ featureIds: [id], limit: 1 } as never),
      )
      const first = (response.items ?? [])[0]
      return first ? toFeature(first as FeatureWire) : null
    },
    enabled: id.length > 0,
  })
}

export function useCreateFeature() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (draft: CreateFeature) =>
      call(() => client.features.createFeature(toCreateFeatureRequest(draft) as never)),
    onSuccess: () => {
      // Invalidating the prefix covers every list and filter combination.
      void queryClient.invalidateQueries({ queryKey: queryKeys.features.all() })
    },
  })
}
