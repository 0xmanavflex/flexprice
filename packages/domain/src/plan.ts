import type { ListFilter, ListFilterSpec } from './listFilter'
/**
 * A plan, as the list and detail pages read it. Narrow and total.
 *
 * V1 splits a plan across four containers: a drawer for name, a separate page
 * for charges, a drawer on a tab for entitlements, a modal for credit grants.
 * This is the *read* model the catalogue list needs plus the *details* an editor
 * writes; the charges, entitlements and credit grants that complete a plan are a
 * separate, later surface. Keeping the list model small is what lets the grid
 * stay the same shape as every other list here.
 */
import { z } from 'zod'

export const PlanStatus = {
  Published: 'published',
  Archived: 'archived',
} as const
export type PlanStatus = (typeof PlanStatus)[keyof typeof PlanStatus]

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  [PlanStatus.Published]: 'Published',
  [PlanStatus.Archived]: 'Archived',
}

/**
 * A representative price for the pricing-card view.
 *
 * A plan can carry many charges; the card shows one headline the way a pricing
 * page does: the recurring base where there is one, else the first charge. The
 * `amount` is the string the API already formatted (`$29`), never a float, and
 * `period` is the raw billing enum the card shortens for display.
 */
export interface PlanHeadline {
  amount: string
  period: string
}

/** The read model the list and detail pages render. */
export interface Plan {
  id: string
  name: string
  lookupKey: string
  description: string
  status: PlanStatus
  /** How many charges (prices) the plan carries. 0 means it bills nothing yet. */
  chargeCount: number
  /** Of those charges, how many are a fixed fee. */
  fixedChargeCount: number
  /** Of those charges, how many are metered usage. */
  usageChargeCount: number
  /** The pricing-card headline, or null when the plan prices nothing yet. */
  headline: PlanHeadline | null
  /**
   * What the plan's usage charges meter, as a customer reads them (each
   * charge's display name, else its meter's name), without repeats. Empty
   * when the list was read without meters.
   */
  usageNames: string[]
  /** Free-form key/value fields, empty when none. */
  metadata: Record<string, string>
  createdAt: Date | null
  updatedAt: Date | null
}

/**
 * What kind of plan this is, read off its charges rather than stored.
 *
 * Nothing on the plan says "hybrid": the shape is the mix of fixed fees and
 * metered usage underneath it, which is exactly what someone scanning the list
 * wants to know before opening anything. A plan with no charges is called that
 * rather than being lumped in with flat-rate: it bills nothing at all.
 */
export const PlanKind = {
  Empty: 'empty',
  Flat: 'flat',
  Usage: 'usage',
  Hybrid: 'hybrid',
} as const
export type PlanKind = (typeof PlanKind)[keyof typeof PlanKind]

export const PLAN_KIND_LABEL: Record<PlanKind, string> = {
  [PlanKind.Empty]: 'No charges yet',
  [PlanKind.Flat]: 'Flat-rate plan',
  [PlanKind.Usage]: 'Usage-based plan',
  [PlanKind.Hybrid]: 'Hybrid plan',
}

/**
 * The same label for something that is not a plan.
 *
 * Add-ons carry the same pill: the mix of fixed and usage charges is the
 * same question: but "Hybrid plan" on an add-on row is simply wrong. The
 * noun is a parameter, as it is in the prototype.
 */
export function planKindLabel(kind: PlanKind, noun = 'plan'): string {
  if (kind === PlanKind.Empty) return 'No charges yet'
  const shape =
    kind === PlanKind.Hybrid ? 'Hybrid' : kind === PlanKind.Usage ? 'Usage-based' : 'Flat-rate'
  return noun ? `${shape} ${noun}` : shape
}

/**
 * A usage-only plan's price, as a customer reads it: "Usage-based · API calls".
 *
 * A plan with no fixed fee has no flat price to show, and "plus usage" after
 * nothing reads as a blank. Two names at most, then a count.
 */
export function usageBasedLabel(names: readonly string[]): string {
  const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))]
  if (unique.length === 0) return 'Usage-based'
  const shown = unique.slice(0, 2).join(', ')
  const more = unique.length > 2 ? ` +${unique.length - 2} more` : ''
  return `Usage-based · ${shown}${more}`
}

export function planKind(plan: Pick<Plan, 'fixedChargeCount' | 'usageChargeCount'>): PlanKind {
  const { fixedChargeCount: fixed, usageChargeCount: usage } = plan
  if (fixed === 0 && usage === 0) return PlanKind.Empty
  if (fixed > 0 && usage > 0) return PlanKind.Hybrid
  return usage > 0 ? PlanKind.Usage : PlanKind.Flat
}

/**
 * What the list can be sorted by. The three the API's `sort` accepts and a
 * person would ask for: named in product terms, mapped to wire names in
 * `@fp/query`.
 */
export const PlanSortField = {
  Name: 'name',
  CreatedAt: 'createdAt',
  UpdatedAt: 'updatedAt',
} as const
export type PlanSortField = (typeof PlanSortField)[keyof typeof PlanSortField]

export const PLAN_SORT_LABEL: Record<PlanSortField, string> = {
  [PlanSortField.Name]: 'Name',
  [PlanSortField.CreatedAt]: 'Created',
  [PlanSortField.UpdatedAt]: 'Updated',
}

/** Table or cards. A layout, not a filter: kept out of the fetch key. */
export const PlanView = {
  Table: 'table',
  Cards: 'cards',
} as const
export type PlanView = (typeof PlanView)[keyof typeof PlanView]

/** What the list can ask for. Product vocabulary, not transport. */
export interface PlanQuery {
  page: number
  pageSize: number
  search: string
  statuses: PlanStatus[]
  sortBy: PlanSortField
  sortDirection: 'asc' | 'desc'
  view: PlanView
  /** Granular field filters, applied by the search endpoint. See `PLAN_FILTERS`. */
  filters?: ListFilter[]
}

export const DEFAULT_PLAN_QUERY: PlanQuery = {
  page: 1,
  pageSize: 25,
  search: '',
  statuses: [],
  // Alphabetical: a catalogue is looked *up* more often than scanned for change.
  sortBy: PlanSortField.UpdatedAt,
  sortDirection: 'desc',
  view: PlanView.Table,
  filters: [],
}

/**
 * Whether the list is narrowed: a search, the status facet or a filter chip. A
 * chip that matches nothing (Archived, say) is "no plans match", not an empty
 * catalogue.
 */
export function isPlanQueryFiltered(query: PlanQuery): boolean {
  return query.search.length > 0 || query.statuses.length > 0 || (query.filters?.length ?? 0) > 0
}
/** What the plan list can filter on: V1's fields, by their wire names. */
export const PLAN_FILTERS: readonly ListFilterSpec[] = [
  { field: 'name', label: 'Name', kind: 'text' },
  { field: 'lookup_key', label: 'Lookup key', kind: 'text' },
  {
    field: 'status',
    label: 'Status',
    kind: 'options',
    options: [
      { value: 'published', label: 'Published' },
      { value: 'archived', label: 'Archived' },
    ],
  },
  { field: 'created_at', label: 'Created', kind: 'date' },
]

/**
 * The rules for creating or editing a plan's details.
 *
 * The details step only: name, an optional lookup key, a description. What
 * turns a plan from a shell into something that bills: its charges,
 * entitlements and credit grants: is the larger surface added afterwards, the
 * way V1 creates the plan in a drawer and prices it on a separate page.
 *
 * Unlike an add-on, a plan's lookup key is optional (the create endpoint does
 * not require one) and stays editable: so it is a plain field in both modes.
 */
export const createPlanSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name'),
  lookupKey: z
    .string()
    .trim()
    .regex(/^[a-z0-9_-]*$/, 'Use lowercase letters, numbers, hyphens and underscores')
    .optional(),
  description: z.string().trim().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
})

export type CreatePlan = z.infer<typeof createPlanSchema>

/** A blank draft, so the create form starts on a valid, empty shape. */
export function emptyPlan(): CreatePlan {
  return { name: '', lookupKey: '', description: '' }
}
