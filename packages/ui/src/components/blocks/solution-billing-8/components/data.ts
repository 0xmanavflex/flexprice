// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
export type PlanChangeStepId = "plan" | "timing" | "confirm"
export type PlanTierId = "starter" | "growth" | "scale" | "enterprise"
export type ChangeTiming = "now" | "renewal"

export interface PlanChangeStep {
  id: PlanChangeStepId
  step: number
  title: string
  description: string
}

export interface PlanOption {
  id: PlanTierId
  code: string
  label: string
  description: string
  price: number
  badge?: string
}

export interface TimingOption {
  value: ChangeTiming
  label: string
  description: string
}

export interface PlanChangeValues {
  plan: PlanTierId
  timing: ChangeTiming
}

// The subscription being changed. Cedar Labs is the Enterprise account from the
// Beacon world; here it sits on Growth and the operator moves it to a new tier.
export const SUBSCRIPTION = {
  customerName: "Cedar Labs",
  accountId: "ACC-3104",
  subscriptionId: "SUB-4821",
  currentPlan: "growth" as PlanTierId,
  seats: 20,
  renewalDate: "2026-07-04",
  renewalLabel: "Jul 4, 2026",
  daysRemaining: 18,
  cycleDays: 30,
  resultingInvoice: "INV-20461",
  requestedBy: {
    name: "Mara Whitfield",
    role: "Billing operations lead",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&dpr=2&q=80",
  },
}

export const WIZARD_STEPS: PlanChangeStep[] = [
  { id: "plan", step: 1, title: "New plan", description: "Pick a tier" },
  { id: "timing", step: 2, title: "Timing", description: "When to apply" },
  { id: "confirm", step: 3, title: "Confirm", description: "Review change" },
]

// Beacon plan catalog, monthly per seat. Growth is the current tier.
export const PLAN_OPTIONS: PlanOption[] = [
  {
    id: "starter",
    code: "PLAN-Starter",
    label: "Starter",
    description: "Core billing for small teams getting started.",
    price: 29,
  },
  {
    id: "growth",
    code: "PLAN-Growth",
    label: "Growth",
    description: "Usage analytics and seat management.",
    price: 89,
  },
  {
    id: "scale",
    code: "PLAN-Scale",
    label: "Scale",
    description: "SSO, audit exports, and priority support.",
    price: 249,
    badge: "Most popular",
  },
  {
    id: "enterprise",
    code: "PLAN-Enterprise",
    label: "Enterprise",
    description: "Procurement review and account governance.",
    price: 399,
  },
]

export const TIMING_OPTIONS: TimingOption[] = [
  {
    value: "now",
    label: "Apply now",
    description: "Prorate the change against the current cycle.",
  },
  {
    value: "renewal",
    label: "At next renewal",
    description: "New price starts Jul 4, nothing due today.",
  },
]

export const DEFAULT_PLAN_CHANGE_VALUES: PlanChangeValues = {
  plan: "scale",
  timing: "now",
}

export function getPlan(id: PlanTierId): PlanOption {
  return PLAN_OPTIONS.find((plan) => plan.id === id) ?? PLAN_OPTIONS[0]
}

export interface ProrationResult {
  currentCredit: number
  newCharge: number
  dueToday: number
  creditToNextInvoice: number
  direction: "upgrade" | "downgrade" | "same"
}

// Proration derives from price x seats x (days remaining / cycle), so the rail
// figures always reconcile with the chosen plan and timing.
export function getProration(values: PlanChangeValues): ProrationResult {
  const currentPlan = getPlan(SUBSCRIPTION.currentPlan)
  const newPlan = getPlan(values.plan)
  const factor = SUBSCRIPTION.daysRemaining / SUBSCRIPTION.cycleDays

  const direction =
    newPlan.price > currentPlan.price
      ? "upgrade"
      : newPlan.price < currentPlan.price
        ? "downgrade"
        : "same"

  if (values.timing === "renewal") {
    return {
      currentCredit: 0,
      newCharge: 0,
      dueToday: 0,
      creditToNextInvoice: 0,
      direction,
    }
  }

  const currentCredit = Math.round(
    currentPlan.price * SUBSCRIPTION.seats * factor
  )
  const newCharge = Math.round(newPlan.price * SUBSCRIPTION.seats * factor)
  const delta = newCharge - currentCredit

  return {
    currentCredit,
    newCharge,
    dueToday: Math.max(0, delta),
    creditToNextInvoice: Math.max(0, -delta),
    direction,
  }
}