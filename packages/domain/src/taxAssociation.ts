import { z } from 'zod'

/** Whether the tax is already inside the listed price or added on top of it. */
export const TaxBehavior = {
  Exclusive: 'exclusive',
  Inclusive: 'inclusive',
} as const
export type TaxBehavior = (typeof TaxBehavior)[keyof typeof TaxBehavior]

export const TAX_BEHAVIOR_LABEL: Record<TaxBehavior, string> = {
  [TaxBehavior.Exclusive]: 'Added on top of the price',
  [TaxBehavior.Inclusive]: 'Included in the price',
}

/** A tax rate attached to an entity (today: a customer). */
export interface TaxAssociation {
  id: string
  taxRateId: string
  taxRateName: string
  taxRateCode: string
  /** The rate's percentage as the API sends it, or empty. */
  percentage: string
  taxBehavior: TaxBehavior
  priority: number
  autoApply: boolean
}

const priority = z.string().trim().regex(/^\d+$/, 'Priority is a whole number')

export const createTaxAssociationSchema = z.object({
  taxRateCode: z.string().trim().min(1, 'Choose a tax rate'),
  taxBehavior: z.enum([TaxBehavior.Exclusive, TaxBehavior.Inclusive]),
  priority,
  autoApply: z.boolean(),
})
export type CreateTaxAssociation = z.infer<typeof createTaxAssociationSchema>

export const editTaxAssociationSchema = createTaxAssociationSchema.omit({ taxRateCode: true })
export type EditTaxAssociation = z.infer<typeof editTaxAssociationSchema>

export function emptyTaxAssociation(): CreateTaxAssociation {
  return { taxRateCode: '', taxBehavior: TaxBehavior.Exclusive, priority: '100', autoApply: true }
}
