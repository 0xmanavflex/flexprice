import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, ErrorKind, call, deleteTaxAssociation } from '@fp/api'
import {
  type CreateTaxAssociation,
  type EditTaxAssociation,
  type TaxAssociation,
  TaxBehavior,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice, useFlexpriceAuth, useFlexpriceServerURL } from './provider'

/**
 * Tax associations: a tax rate attached to a customer, so invoices raised for
 * them carry it. Reached through `/taxes/associations`; the list is filtered
 * server-side by entity.
 */

export interface TaxAssociationWire {
  id?: string | undefined
  taxRateId?: string | undefined
  taxBehavior?: string | undefined
  priority?: number | undefined
  autoApply?: boolean | undefined
  taxRate?:
    | { name?: string | undefined; code?: string | undefined; percentageValue?: string | undefined }
    | undefined
}

/** The part of a tax rate an association row shows. */
export type AssociatedTaxRate = NonNullable<TaxAssociationWire['taxRate']>

/**
 * Fills in the tax rate each association points at.
 *
 * The list answers with `tax_rate_id` alone unless asked for `expand=tax_rate`,
 * and the SDK's `listTaxAssociations` has no way to ask. Without this a row
 * showed the internal rate id, no code and no rate, and the edit picker opened
 * on "Select…" because it is keyed by code. Each distinct rate is read once; a
 * rate that cannot be read (deleted since) leaves its row as the API sent it.
 */
export async function withTaxRates<T extends TaxAssociationWire>(
  wires: readonly T[],
  readRate: (taxRateId: string) => Promise<AssociatedTaxRate>,
): Promise<T[]> {
  const missing = [
    ...new Set(wires.filter((w) => !w.taxRate && w.taxRateId).map((w) => w.taxRateId as string)),
  ]
  if (missing.length === 0) return [...wires]
  const rates = new Map<string, AssociatedTaxRate>()
  await Promise.all(
    missing.map(async (id) => {
      try {
        rates.set(id, await readRate(id))
      } catch {
        // Shown by id, as before: one unreadable rate should not hide the rest.
      }
    }),
  )
  return wires.map((w) => {
    const rate = !w.taxRate && w.taxRateId ? rates.get(w.taxRateId) : undefined
    return rate ? { ...w, taxRate: rate } : w
  })
}

export function toTaxAssociation(wire: TaxAssociationWire): TaxAssociation {
  return {
    id: wire.id ?? '',
    taxRateId: wire.taxRateId ?? '',
    taxRateName: wire.taxRate?.name ?? '',
    taxRateCode: wire.taxRate?.code ?? '',
    percentage: wire.taxRate?.percentageValue ?? '',
    taxBehavior:
      wire.taxBehavior === TaxBehavior.Inclusive ? TaxBehavior.Inclusive : TaxBehavior.Exclusive,
    priority: wire.priority ?? 0,
    autoApply: wire.autoApply ?? false,
  }
}

/** What a tax association can be attached to, on the wire. */
export type TaxAssociationEntityType = 'customer' | 'subscription' | 'billing_entity'

export function toCreateTaxAssociationRequest(
  entityId: string,
  draft: CreateTaxAssociation,
  entityType: TaxAssociationEntityType = 'customer',
): Record<string, unknown> {
  return {
    entityType,
    entityId,
    taxRateCode: draft.taxRateCode,
    taxBehavior: draft.taxBehavior,
    priority: Number(draft.priority),
    autoApply: draft.autoApply,
  }
}

export function toUpdateTaxAssociationRequest(draft: EditTaxAssociation): Record<string, unknown> {
  return {
    taxBehavior: draft.taxBehavior,
    priority: Number(draft.priority),
    autoApply: draft.autoApply,
  }
}

export function useEntityTaxAssociations(entityType: TaxAssociationEntityType, entityId: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.taxAssociations.forEntity(entityType, entityId),
    queryFn: async () => {
      const response = await call(() =>
        client.taxAssociations.listTaxAssociations(entityType, entityId),
      )
      const wires = await withTaxRates(response.items ?? [], (id) =>
        call(() => client.taxRates.getTaxRate(id)),
      )
      return wires.map((item) => toTaxAssociation(item as TaxAssociationWire))
    },
    // No customer chosen yet (a new invoice) means nothing to ask for.
    enabled: entityId.length > 0,
  })
}

export function useCustomerTaxAssociations(customerId: string) {
  return useEntityTaxAssociations('customer', customerId)
}

export function useCreateTaxAssociation(
  entityId: string,
  entityType: TaxAssociationEntityType = 'customer',
) {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (draft: CreateTaxAssociation) =>
      call(() =>
        client.taxAssociations.createTaxAssociation(
          toCreateTaxAssociationRequest(entityId, draft, entityType) as never,
        ),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.taxAssociations.all() })
    },
  })
}

export function useUpdateTaxAssociation() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: EditTaxAssociation }) =>
      call(() =>
        client.taxAssociations.updateTaxAssociation(
          id,
          toUpdateTaxAssociationRequest(draft) as never,
        ),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.taxAssociations.all() })
    },
  })
}

/**
 * `DELETE /taxes/associations/{id}`, around the SDK: the API answers 200 with
 * an empty body, which the SDK rejects as a failure (see `deleteTaxAssociation`
 * in `@fp/api`).
 */
export function useRemoveTaxAssociationRequest() {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()

  return async (associationId: string): Promise<void> => {
    const [token, environmentId] = await Promise.all([auth.getToken(), auth.getEnvironmentId()])
    if (!token) throw new ApiError(ErrorKind.Unauthorized, 'Sign in to remove a tax rate.')
    if (!environmentId) throw new ApiError(ErrorKind.Forbidden, 'Choose an environment first.')
    await deleteTaxAssociation(serverURL, token, environmentId, associationId)
  }
}

export function useDeleteTaxAssociation() {
  const remove = useRemoveTaxAssociationRequest()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: remove,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.taxAssociations.all() })
    },
  })
}
