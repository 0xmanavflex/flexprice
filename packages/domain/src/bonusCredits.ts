/**
 * Bonus credits on a purchased wallet top-up: `bonus_credits_topup_config`.
 *
 * One environment-wide setting: a list of slabs, each "a top-up of at least
 * this many credits earns this bonus". The backend evaluates them highest
 * threshold first and the first match wins, so the highest bracket a purchase
 * clears is the one that applies. It refuses slabs that are not stored in
 * strictly descending threshold order; the console sorts them on save, so the
 * person can type them in any order.
 *
 * A slab can make its bonus expire some time after the top-up. An expiry date
 * on the top-up itself overrides it. Free credit grants never earn a bonus:
 * only purchased top-ups (paid directly or invoiced) do.
 *
 * Docs: `DOCS.bonusCredits`.
 */
import { z } from 'zod'

export const BonusType = { Flat: 'flat', Percentage: 'percentage' } as const
export type BonusType = (typeof BonusType)[keyof typeof BonusType]

export const BonusExpiryUnit = {
  Day: 'DAY',
  Week: 'WEEK',
  Month: 'MONTH',
  Year: 'YEAR',
} as const
export type BonusExpiryUnit = (typeof BonusExpiryUnit)[keyof typeof BonusExpiryUnit]

export const BONUS_EXPIRY_UNIT_LABEL: Record<BonusExpiryUnit, string> = {
  DAY: 'Days',
  WEEK: 'Weeks',
  MONTH: 'Months',
  YEAR: 'Years',
}

const DECIMAL = /^\d+(\.\d+)?$/

export const bonusSlabSchema = z
  .object({
    /** The smallest top-up, in credits, that earns this bonus. A decimal string. */
    threshold: z.string().trim().regex(DECIMAL, 'Enter a number of credits, 0 or more'),
    bonusType: z.enum([BonusType.Flat, BonusType.Percentage]),
    /** Credits for a flat bonus, a percentage of the top-up for a percentage one. */
    bonusValue: z.string().trim().regex(DECIMAL, 'Enter a bonus, 0 or more'),
    /** How long the bonus lasts, in `expiryUnit`s; blank for a bonus that never expires. */
    expiryDuration: z
      .string()
      .trim()
      .refine(
        (value) => value === '' || (/^\d+$/.test(value) && Number(value) > 0),
        'A whole number, 1 or more, or blank for never',
      ),
    expiryUnit: z.enum([
      BonusExpiryUnit.Day,
      BonusExpiryUnit.Week,
      BonusExpiryUnit.Month,
      BonusExpiryUnit.Year,
    ]),
  })
  .refine((slab) => slab.bonusType !== BonusType.Percentage || Number(slab.bonusValue) <= 1000, {
    message: 'Keep a percentage bonus at 1000% or less',
    path: ['bonusValue'],
  })
export type BonusSlab = z.infer<typeof bonusSlabSchema>

export const bonusCreditsConfigSchema = z
  .object({
    enabled: z.boolean(),
    slabs: z.array(bonusSlabSchema),
  })
  .superRefine((config, ctx) => {
    if (config.enabled && config.slabs.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'Add at least one slab, or turn bonus credits off',
        path: ['slabs'],
      })
    }
    const seen = new Map<number, number>()
    config.slabs.forEach((slab, index) => {
      const threshold = Number(slab.threshold)
      if (!DECIMAL.test(slab.threshold.trim())) return
      if (seen.has(threshold)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Two slabs start at the same top-up',
          path: ['slabs', index, 'threshold'],
        })
      }
      seen.set(threshold, index)
    })
  })
export type BonusCreditsConfig = z.infer<typeof bonusCreditsConfigSchema>

export const DEFAULT_BONUS_CREDITS_CONFIG: BonusCreditsConfig = { enabled: false, slabs: [] }

/** A new slab for the editor: blank threshold, a 10% bonus that never expires. */
export function emptyBonusSlab(): BonusSlab {
  return {
    threshold: '',
    bonusType: BonusType.Percentage,
    bonusValue: '10',
    expiryDuration: '',
    expiryUnit: BonusExpiryUnit.Month,
  }
}

/** Highest threshold first: the order the backend evaluates and insists on. */
export function sortBonusSlabs(slabs: readonly BonusSlab[]): BonusSlab[] {
  return [...slabs].sort((a, b) => Number(b.threshold) - Number(a.threshold))
}

/** Up to six decimals, trailing zeros dropped: credits are decimal strings. */
function decimalText(value: number): string {
  return String(Math.round(value * 1_000_000) / 1_000_000)
}

/**
 * The bonus a purchased top-up of `credits` earns, as the backend resolves it:
 * the first slab, highest threshold first, whose threshold the top-up meets.
 * Null when bonus credits are off, nothing matches, or the bonus is zero.
 */
export function resolveBonus(
  config: BonusCreditsConfig | null | undefined,
  credits: string,
): { credits: string; slab: BonusSlab } | null {
  if (!config?.enabled) return null
  const amount = Number(credits)
  if (!Number.isFinite(amount) || amount <= 0) return null
  const slab = sortBonusSlabs(config.slabs).find((s) => amount >= Number(s.threshold))
  if (!slab) return null
  const value = Number(slab.bonusValue)
  const bonus = slab.bonusType === BonusType.Percentage ? (amount * value) / 100 : value
  if (!(bonus > 0)) return null
  return { credits: decimalText(bonus), slab }
}

/** "10% of the top-up", "50 credits". */
export function bonusText(slab: Pick<BonusSlab, 'bonusType' | 'bonusValue'>): string {
  return slab.bonusType === BonusType.Percentage
    ? `${slab.bonusValue}% of the top-up`
    : `${slab.bonusValue} ${Number(slab.bonusValue) === 1 ? 'credit' : 'credits'}`
}

/** "expires 3 months after the top-up", or "never expires". */
export function bonusExpiryText(slab: Pick<BonusSlab, 'expiryDuration' | 'expiryUnit'>): string {
  if (!slab.expiryDuration) return 'never expires'
  const n = Number(slab.expiryDuration)
  const unit = BONUS_EXPIRY_UNIT_LABEL[slab.expiryUnit].toLowerCase()
  return `expires ${n} ${n === 1 ? unit.replace(/s$/, '') : unit} after the top-up`
}
