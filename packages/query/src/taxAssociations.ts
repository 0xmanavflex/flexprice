import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { call, callWrite } from '@fp/api'
import {
  type CreateTaxAssociation,
  type EditTaxAssociation,
  type TaxAssociation,
  TaxBehavior,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

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
      return (response.items ?? []).map((item) => toTaxAssociation(item as TaxAssociationWire))
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
    // The list refetches after this; the response is not read. The API has
    // answered a successful create with a body the SDK cannot parse.
    mutationFn: (draft: CreateTaxAssociation) =>
      callWrite(() =>
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
      callWrite(() =>
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

export function useDeleteTaxAssociation() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => call(() => client.taxAssociations.deleteTaxAssociation(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.taxAssociations.all() })
    },
  })
}
