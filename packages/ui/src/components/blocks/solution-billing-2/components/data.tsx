import { DatabaseIcon, LayersIcon, ShieldCheckIcon, SparklesIcon, UsersIcon, ZapIcon } from "lucide-react"
import type { ReactNode } from "react"
import type { BadgeProps } from "@ui/components/reui/badge"


// ── Types ──

export type PlanStatus = "active" | "draft" | "archived"
export type BillingInterval = "monthly" | "annual"

export interface Entitlement {
  id: string
  icon: ReactNode
  label: string
  value: string
}

export interface AddOn {
  id: string
  icon: ReactNode
  label: string
  price: string
}

export interface Plan {
  id: string
  name: string
  status: PlanStatus
  isPublic: boolean
  monthlyPrice: number
  annualPrice: number
  perSeat: boolean
  subscribers?: number
  entitlements: Entitlement[]
  addOns: AddOn[]
}

// ── Status maps ──

export const statusVariant: Record<PlanStatus, BadgeProps["variant"]> = {
  active: "success-light",
  draft: "warning-light",
  archived: "invert-light",
}

export const statusLabel: Record<PlanStatus, string> = {
  active: "Active",
  draft: "Draft",
  archived: "Archived",
}

// ── Icon nodes ──

const seatsIcon = (
  <UsersIcon
    className="text-muted-foreground size-3.5 shrink-0"
    aria-hidden="true"
  />
)

const apiIcon = (
  <ZapIcon
    className="text-muted-foreground size-3.5 shrink-0"
    aria-hidden="true"
  />
)

const storageIcon = (
  <DatabaseIcon
    className="text-muted-foreground size-3.5 shrink-0"
    aria-hidden="true"
  />
)

const envIcon = (
  <LayersIcon
    className="text-muted-foreground size-3.5 shrink-0"
    aria-hidden="true"
  />
)

const ssoAddOnIcon = (
  <ShieldCheckIcon
    className="text-muted-foreground size-3.5 shrink-0"
    aria-hidden="true"
  />
)

const insightsAddOnIcon = (
  <SparklesIcon
    className="text-muted-foreground size-3.5 shrink-0"
    aria-hidden="true"
  />
)

// ── Plan catalog (Beacon Cloud) ──

export const plans: Plan[] = [
  {
    id: "PLAN-Starter",
    name: "Starter",
    status: "active",
    isPublic: true,
    monthlyPrice: 29,
    annualPrice: 290,
    perSeat: true,
    subscribers: 1840,
    entitlements: [
      {
        id: "starter-seats",
        icon: seatsIcon,
        label: "Seats",
        value: "5 included",
      },
      {
        id: "starter-api",
        icon: apiIcon,
        label: "API calls",
        value: "50k / month",
      },
      {
        id: "starter-storage",
        icon: storageIcon,
        label: "Storage",
        value: "10 GB",
      },
      { id: "starter-env", icon: envIcon, label: "Environments", value: "1" },
    ],
    addOns: [],
  },
  {
    id: "PLAN-Growth",
    name: "Growth",
    status: "active",
    isPublic: true,
    monthlyPrice: 89,
    annualPrice: 890,
    perSeat: true,
    subscribers: 1120,
    entitlements: [
      {
        id: "growth-seats",
        icon: seatsIcon,
        label: "Seats",
        value: "20 included",
      },
      {
        id: "growth-api",
        icon: apiIcon,
        label: "API calls",
        value: "500k / month",
      },
      {
        id: "growth-storage",
        icon: storageIcon,
        label: "Storage",
        value: "100 GB",
      },
      { id: "growth-env", icon: envIcon, label: "Environments", value: "3" },
    ],
    addOns: [
      {
        id: "growth-insights",
        icon: insightsAddOnIcon,
        label: "Usage insights",
        price: "19 / month",
      },
    ],
  },
  {
    id: "PLAN-Scale",
    name: "Scale",
    status: "active",
    isPublic: true,
    monthlyPrice: 249,
    annualPrice: 2490,
    perSeat: true,
    subscribers: 214,
    entitlements: [
      {
        id: "scale-seats",
        icon: seatsIcon,
        label: "Seats",
        value: "100 included",
      },
      {
        id: "scale-api",
        icon: apiIcon,
        label: "API calls",
        value: "5M / month",
      },
      {
        id: "scale-storage",
        icon: storageIcon,
        label: "Storage",
        value: "1 TB",
      },
      { id: "scale-env", icon: envIcon, label: "Environments", value: "10" },
    ],
    addOns: [
      {
        id: "scale-sso",
        icon: ssoAddOnIcon,
        label: "SSO and SAML",
        price: "99 / month",
      },
      {
        id: "scale-insights",
        icon: insightsAddOnIcon,
        label: "Usage insights",
        price: "19 / month",
      },
    ],
  },
  {
    id: "PLAN-Enterprise",
    name: "Enterprise",
    status: "draft",
    isPublic: false,
    monthlyPrice: 1200,
    annualPrice: 12000,
    perSeat: false,
    subscribers: 0,
    entitlements: [
      { id: "ent-seats", icon: seatsIcon, label: "Seats", value: "Unlimited" },
      {
        id: "ent-api",
        icon: apiIcon,
        label: "API calls",
        value: "50M / month",
      },
      {
        id: "ent-storage",
        icon: storageIcon,
        label: "Storage",
        value: "10 TB",
      },
      {
        id: "ent-env",
        icon: envIcon,
        label: "Environments",
        value: "Unlimited",
      },
    ],
    addOns: [
      {
        id: "ent-sso",
        icon: ssoAddOnIcon,
        label: "SSO and SAML",
        price: "Included",
      },
    ],
  },
  {
    id: "PLAN-Team-Legacy",
    name: "Team Legacy",
    status: "archived",
    isPublic: false,
    monthlyPrice: 59,
    annualPrice: 590,
    perSeat: true,
    subscribers: 38,
    entitlements: [
      {
        id: "legacy-seats",
        icon: seatsIcon,
        label: "Seats",
        value: "10 included",
      },
      {
        id: "legacy-api",
        icon: apiIcon,
        label: "API calls",
        value: "250k / month",
      },
      {
        id: "legacy-storage",
        icon: storageIcon,
        label: "Storage",
        value: "50 GB",
      },
      { id: "legacy-env", icon: envIcon, label: "Environments", value: "2" },
    ],
    addOns: [],
  },
]

// ── Create-plan dialog options ──

export interface IntervalOption {
  id: BillingInterval
  label: string
}

export const intervalOptions: IntervalOption[] = [
  { id: "monthly", label: "Monthly" },
  { id: "annual", label: "Annual" },
]