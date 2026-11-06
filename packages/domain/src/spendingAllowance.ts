import { z } from 'zod'
import { meteredGrantSchema } from './entitlement'

/** A money allowance shared across every usage charge, independent of any feature. */
export const spendingAllowanceSchema = z
  .object({
    quota: z
      .string()
      .trim()
      .regex(/^\d+(\.\d+)?$/, 'Enter an amount above zero')
      .refine((value) => Number(value) > 0, 'Enter an amount above zero'),
    unit: meteredGrantSchema.shape.unit,
    every: z.number().int().positive(),
    allocation: meteredGrantSchema.shape.allocation,
    aggregation: meteredGrantSchema.shape.aggregation,
    startDate: z.union([z.literal(''), z.iso.date()]),
    endDate: z.union([z.literal(''), z.iso.date()]),
  })
  .superRefine((value, ctx) => {
    for (const key of ['startDate', 'endDate'] as const) {
      if (value[key] && Number.isNaN(Date.parse(value[key])))
        ctx.addIssue({ code: 'custom', path: [key], message: 'Enter a valid date' })
    }
    if (value.startDate && value.endDate && value.endDate <= value.startDate)
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'End date must be after start date',
      })
  })
export type SpendingAllowance = z.infer<typeof spendingAllowanceSchema>
export const emptySpendingAllowance = (): SpendingAllowance => ({
  quota: '',
  unit: 'subscription_period',
  every: 1,
  allocation: 'first_usage',
  aggregation: 'additive',
  startDate: '',
  endDate: '',
})
