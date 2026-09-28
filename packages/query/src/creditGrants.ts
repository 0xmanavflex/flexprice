import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { call } from '@fp/api'
import {
  CreditGrantCadence,
  type CreditGrantExpiryDurationUnit,
  CreditGrantExpiryType,
  type CreditGrantPeriod,
  CreditGrantScope,
  type CreateCreditGrant,
  type CreditGrant,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

/**
 * Credit grants: a balance a plan hands its subscribers.
 *
 * There is no search endpoint for grants — the only ways to list them are
 * scoped, `GET /plans/{id}/creditgrants` and `GET /addons/{id}/creditgrants` —
 * so `useCreditGrants` branches on scope to reach the right one. Grants are
 * created one at a time (`POST /creditgrants`); there is no bulk.
 */

const CADENCES = new Set<string>(Object.values(CreditGrantCadence))
const SCOPES = new Set<string>(Object.values(CreditGrantScope))
const EXPIRY_TYPES = new Set<string>(Object.values(CreditGrantExpiryType))

/** The wire shape this reads, after the SDK camelCases the response. */
export interface CreditGrantWire {
  id?: string | undefined
  name?: string | undefined
  scope?: string | undefined
  credits?: string | undefined
  cadence?: string | undefined
  period?: string | undefined
  periodCount?: number | undefined
  expirationType?: string | undefined
  expirationDuration?: number | undefined
  expirationDurationUnit?: string | undefined
  conversionRate?: string | undefined
  priority?: number | undefined
  createdAt?: Date | undefined
}

export function toCreditGrant(wire: CreditGrantWire): CreditGrant {
  const cadence = CADENCES.has(wire.cadence ?? '')
    ? (wire.cadence as CreditGrantCadence)
    : CreditGrantCadence.OneTime
  const scope = SCOPES.has(wire.scope ?? '')
    ? (wire.scope as CreditGrantScope)
    : CreditGrantScope.Plan
  const expirationType = EXPIRY_TYPES.has(wire.expirationType ?? '')
    ? (wire.expirationType as CreditGrantExpiryType)
    : CreditGrantExpiryType.Never

  return {
    id: wire.id ?? '',
    name: wire.name ?? 'Credit grant',
    scope,
    credits: wire.credits ?? '0',
    cadence,
    period: (wire.period ?? null) as CreditGrantPeriod | null,
    periodCount: typeof wire.periodCount === 'number' ? wire.periodCount : null,
    expirationType,
    expirationDuration: typeof wire.expirationDuration === 'number' ? wire.expirationDuration : null,
    expirationDurationUnit: (wire.expirationDurationUnit ??
      null) as CreditGrantExpiryDurationUnit | null,
    conversionRate: wire.conversionRate ?? null,
    priority: typeof wire.priority === 'number' ? wire.priority : 0,
    createdAt: wire.createdAt ?? null,
  }
}

/**
 * A grant draft, as a `CreateCreditGrantRequest`.
 *
 * The scope's target id is set on the field the scope names (`planId` /
 * `addonId`); a period is sent only for a recurring grant, a duration only for a
 * duration expiry — so the request never carries a field the grant does not use.
 */
export function toCreditGrantRequest(
  draft: CreateCreditGrant,
  scope: CreditGrantScope,
  id: string,
): Record<string, unknown> {
  return {
    name: draft.name,
    credits: draft.credits,
    cadence: draft.cadence,
    scope,
    ...(scope === CreditGrantScope.Plan ? { planId: id } : { addonId: id }),
    ...(draft.cadence === CreditGrantCadence.Recurring && draft.period
      ? { period: draft.period, periodCount: draft.periodCount ?? 1 }
      : {}),
    expirationType: draft.expirationType,
    ...(draft.expirationType === CreditGrantExpiryType.Duration && draft.expirationDuration != null
      ? {
          expirationDuration: draft.expirationDuration,
          ...(draft.expirationDurationUnit
            ? { expirationDurationUnit: draft.expirationDurationUnit }
            : {}),
        }
      : {}),
    ...(draft.conversionRate ? { conversionRate: draft.conversionRate } : {}),
    priority: draft.priority,
  }
}

/** The credit grants a plan (or add-on) carries. Scoped, since there is no search. */
export function useCreditGrants(scope: CreditGrantScope, id: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.creditGrants.list({ scope, id }),
    queryFn: async () => {
      const response = await call(() =>
        scope === CreditGrantScope.Plan
          ? client.creditGrants.getPlanCreditGrants(id)
          : client.creditGrants.getAddonCreditGrants(id),
      )
      return (response.items ?? []).map((item) => toCreditGrant(item as CreditGrantWire))
    },
    enabled: id.length > 0,
  })
}

/** Create one credit grant. There is no bulk endpoint, so the dialog saves one. */
export function useCreateCreditGrant() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      scope,
      id,
      grant,
    }: {
      scope: CreditGrantScope
      id: string
      grant: CreateCreditGrant
    }) => call(() => client.creditGrants.createCreditGrant(toCreditGrantRequest(grant, scope, id) as never)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.creditGrants.all() })
    },
  })
}

/** Remove a credit grant. */
export function useDeleteCreditGrant() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => call(() => client.creditGrants.deleteCreditGrant(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.creditGrants.all() })
    },
  })
}
