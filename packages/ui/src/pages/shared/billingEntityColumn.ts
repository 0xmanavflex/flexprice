import { type BillingEntity, effectiveEntityId } from '@fp/domain'
import { type EntityColumn, pillColumn } from './cells'

/** What a list needs of each entity for its column and filter. */
export type ListBillingEntity = Pick<BillingEntity, 'id' | 'name' | 'isDefault'>

/** The Billing entity column; a record without one (backfill may lag) reads as the default entity. */
export function billingEntityColumn<T extends { billingEntityId?: string | null | undefined }>(
  entities: readonly ListBillingEntity[],
): EntityColumn<T> {
  return pillColumn<T>('billingEntity', 'Billing entity', (row) => {
    const id = effectiveEntityId(row, entities)
    const name = entities.find((entity) => entity.id === id)?.name
    return name ? { label: name } : null
  })
}

/** The entity filter's choices. */
export function billingEntityChoices(
  entities: readonly ListBillingEntity[],
): { value: string; label: string }[] {
  return entities.map((entity) => ({ value: entity.id, label: entity.name }))
}
