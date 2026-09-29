// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
"use client"

import { type ReactNode } from "react"
import { UserIcon, ShieldIcon, BellIcon, CreditCardIcon, MonitorIcon, SmartphoneIcon } from "lucide-react"

// ── Types ──

export type SelectOption = {
  value: string
  label: string
}

export type BillingPlan = {
  id: string
  name: string
  price: string
  period: string
  current: boolean
  features: string[]
}

export type Session = {
  id: string
  device: string
  browser: string
  location: string
  lastActive: string
  current: boolean
  icon: ReactNode
}

export type SettingsTabItem = {
  value: string
  label: string
  icon: ReactNode
}

// ── Data ──

export const SETTINGS_TAB_ITEMS: SettingsTabItem[] = [
  {
    value: "profile",
    label: "My Profile",
    icon: (
      <UserIcon aria-hidden="true" />
    ),
  },
  {
    value: "security",
    label: "Security",
    icon: (
      <ShieldIcon aria-hidden="true" />
    ),
  },
  {
    value: "notifications",
    label: "Notifications",
    icon: (
      <BellIcon aria-hidden="true" />
    ),
  },
  {
    value: "billing",
    label: "Billing",
    icon: (
      <CreditCardIcon aria-hidden="true" />
    ),
  },
]

export const TIMEZONES: SelectOption[] = [
  { value: "utc-8", label: "UTC-8 (Pacific Time)" },
  { value: "utc-5", label: "UTC-5 (Eastern Time)" },
  { value: "utc+0", label: "UTC+0 (London)" },
  { value: "utc+1", label: "UTC+1 (Berlin)" },
  { value: "utc+9", label: "UTC+9 (Tokyo)" },
]

export const ROLES: SelectOption[] = [
  { value: "engineering-lead", label: "Engineering Lead" },
  { value: "developer", label: "Developer" },
  { value: "designer", label: "Designer" },
  { value: "product-manager", label: "Product Manager" },
]

export const COUNTRIES: SelectOption[] = [
  { value: "us", label: "United States" },
  { value: "uk", label: "United Kingdom" },
  { value: "de", label: "Germany" },
  { value: "uz", label: "Uzbekistan" },
]

export const TIMEOUTS: SelectOption[] = [
  { value: "5", label: "5 minutes" },
  { value: "10", label: "10 minutes" },
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
]

export const QUIET_HOURS: SelectOption[] = [
  { value: "18:00", label: "6:00 PM" },
  { value: "20:00", label: "8:00 PM" },
  { value: "22:00", label: "10:00 PM" },
  { value: "23:00", label: "11:00 PM" },
]

export const QUIET_HOURS_END: SelectOption[] = [
  { value: "06:00", label: "6:00 AM" },
  { value: "08:00", label: "8:00 AM" },
  { value: "09:00", label: "9:00 AM" },
  { value: "10:00", label: "10:00 AM" },
]

export const DIGEST_CADENCE: SelectOption[] = [
  { value: "daily", label: "Daily summary" },
  { value: "weekly", label: "Weekly digest" },
  { value: "mentions", label: "Only mentions" },
]

export const RECOVERY_METHODS: SelectOption[] = [
  { value: "authenticator", label: "Authenticator first" },
  { value: "sms", label: "SMS fallback" },
  { value: "email", label: "Email fallback" },
]

export const BILLING_PLANS: BillingPlan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    current: false,
    features: ["1 workspace", "Basic exports", "Community support"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$29",
    period: "per month",
    current: true,
    features: ["Unlimited workspaces", "Automations", "Priority support"],
  },
  {
    id: "team",
    name: "Team",
    price: "$79",
    period: "per month",
    current: false,
    features: ["Everything in Pro", "SSO", "Shared billing"],
  },
]

export const SESSIONS: Session[] = [
  {
    id: "sess-1",
    device: "macOS",
    browser: "Chrome",
    location: "San Francisco, CA",
    lastActive: "Active now",
    current: true,
    icon: (
      <MonitorIcon aria-hidden="true" />
    ),
  },
  {
    id: "sess-2",
    device: "iPhone",
    browser: "Safari",
    location: "San Francisco, CA",
    lastActive: "2 hours ago",
    current: false,
    icon: (
      <SmartphoneIcon aria-hidden="true" />
    ),
  },
  {
    id: "sess-3",
    device: "Windows",
    browser: "Firefox",
    location: "New York, NY",
    lastActive: "3 days ago",
    current: false,
    icon: (
      <MonitorIcon aria-hidden="true" />
    ),
  },
]