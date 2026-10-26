import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { call, type FlexpriceModels } from '@fp/api'
import { type FxRate, type FxRateDraft, FxRateScope } from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

/**
 * Forex rates (`/forex`): the global rate for each currency pair, and customer
 * or contract overrides of it. Lists show fixed rates only: the API stores
 * market rates but cannot resolve them yet, so V1 filters them out too.
 */

export interface FxRateWire {
  id?: string | undefined
  scope?: string | undefined
  scopeId?: string | undefined
  fromCurrency?: string | undefined
  toCurrency?: string | undefined
  rate?: string | undefined
  startDate?: Date | undefined
  endDate?: Date | undefined
  updatedAt?: Date | undefined
}

const SCOPES: readonly string[] = Object.values(FxRateScope)

export function toFxRate(wire: FxRateWire): FxRate {
  return {
    id: wire.id ?? '',
    scope: (SCOPES.includes(wire.scope ?? '') ? wire.scope : FxRateScope.Tenant) as FxRate['scope'],
    scopeId: wire.scopeId ?? '',
    fromCurrency: (wire.fromCurrency ?? '').toLowerCase(),
    toCurrency: (wire.toCurrency ?? '').toLowerCase(),
    rate: wire.rate ?? '',
    startDate: wire.startDate ? wire.startDate.toISOString() : null,
    endDate: wire.endDate ? wire.endDate.toISOString() : null,
    updatedAt: wire.updatedAt ?? null,
  }
}

/** Who owns a list: global rates, or one customer's or contract's overrides. */
export type FxRateOwner =
  | { scope: typeof FxRateScope.Tenant }
  | { scope: typeof FxRateScope.Customer | typeof FxRateScope.Subscription; scopeId: string }

const FIXED_ONLY: FlexpriceModels.FilterCondition = {
  field: 'source',
  operator: 'eq',
  dataType: 'string',
  value: { string: 'fixed' },
}

/** A draft as a `CreateFXRateRequest`; a global rate carries no window. */
export function toCreateFxRateRequest(
  owner: FxRateOwner,
  draft: FxRateDraft,
): FlexpriceModels.CreateFXRateRequest {
  const windowed = owner.scope !== FxRateScope.Tenant
  return {
    scope: owner.scope,
    ...(owner.scope !== FxRateScope.Tenant ? { scopeId: owner.scopeId } : {}),
    fromCurrency: draft.fromCurrency.toLowerCase(),
    toCurrency: draft.toCurrency.toLowerCase(),
    source: 'fixed',
    rate: draft.rate.trim(),
    ...(windowed && draft.startDate ? { startDate: new Date(draft.startDate) } : {}),
    ...(windowed && draft.endDate ? { endDate: new Date(draft.endDate) } : {}),
  }
}

const sameInstant = (a: string, b: string) =>
  a && b ? new Date(a).getTime() === new Date(b).getTime() : a === b

/**
 * Only what changed. The pair and scope cannot change, and a saved date cannot
 * be cleared (the API has no way to say so), so a cleared date is not sent.
 */
export function toUpdateFxRateRequest(
  original: FxRateDraft,
  next: FxRateDraft,
): FlexpriceModels.UpdateFXRateRequest {
  return {
    ...(next.rate.trim() !== original.rate ? { rate: next.rate.trim() } : {}),
    ...(next.startDate && !sameInstant(next.startDate, original.startDate)
      ? { startDate: new Date(next.startDate) }
      : {}),
    ...(next.endDate && !sameInstant(next.endDate, original.endDate)
      ? { endDate: new Date(next.endDate) }
      : {}),
  }
}

export function useFxRates(owner: FxRateOwner, page: { page: number; pageSize: number }) {
  const client = useFlexprice()
  const scopeId = owner.scope === FxRateScope.Tenant ? '' : owner.scopeId

  return useQuery({
    queryKey: queryKeys.fxRates.list({ scope: owner.scope, scopeId, ...page }),
    queryFn: async ({ signal }) => {
      const response = await call(
        (options) =>
          client.fxRates.queryFXRates(
            {
              scope: owner.scope,
              ...(scopeId ? { scopeId } : {}),
              limit: page.pageSize,
              offset: (page.page - 1) * page.pageSize,
              filters: [FIXED_ONLY],
            },
            options,
          ),
        signal,
      )
      return {
        rates: (response.items ?? []).map((item) => toFxRate(item)),
        total: response.pagination?.total ?? 0,
      }
    },
    enabled: owner.scope === FxRateScope.Tenant || scopeId.length > 0,
    placeholderData: keepPreviousData,
  })
}

export function useCreateFxRate(owner: FxRateOwner) {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (draft: FxRateDraft) =>
      call(() => client.fxRates.createFXRate(toCreateFxRateRequest(owner, draft))),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.fxRates.all() }),
  })
}

export function useUpdateFxRate() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      original,
      next,
    }: {
      id: string
      original: FxRateDraft
      next: FxRateDraft
    }) => call(() => client.fxRates.updateFXRate(id, toUpdateFxRateRequest(original, next))),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.fxRates.all() }),
  })
}

/** Overrides only: the API refuses to delete a global rate (it archives the row). */
export function useDeleteFxRate() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => call(() => client.fxRates.deleteFXRate(id)),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.fxRates.all() }),
  })
}
