// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
export type FilterOption<T extends string> = {
  value: T
  label: string
}

export const MEMBER_ROLE_OPTIONS = [
  { value: "Admin", label: "Admin" },
  { value: "Finance", label: "Finance" },
  { value: "Support", label: "Support" },
  { value: "Operations", label: "Operations" },
  { value: "Product", label: "Product" },
  { value: "Security", label: "Security" },
  { value: "Growth", label: "Growth" },
] as const satisfies readonly FilterOption<string>[]

export const MEMBER_BILLING_STATUS_OPTIONS = [
  { value: "Active", label: "Active" },
  { value: "Pending invoice", label: "Pending invoice" },
  { value: "Manual review", label: "Manual review" },
  { value: "Past due", label: "Past due" },
] as const satisfies readonly FilterOption<string>[]

export const MEMBER_AUTH_PROVIDER_OPTIONS = [
  { value: "Google", label: "Google" },
  { value: "GitHub", label: "GitHub" },
  { value: "Okta SSO", label: "Okta SSO" },
  { value: "Passwordless", label: "Passwordless" },
] as const satisfies readonly FilterOption<string>[]

export type MemberRole = (typeof MEMBER_ROLE_OPTIONS)[number]["value"]
export type MemberBillingStatus =
  (typeof MEMBER_BILLING_STATUS_OPTIONS)[number]["value"]
export type MemberAuthProvider =
  (typeof MEMBER_AUTH_PROVIDER_OPTIONS)[number]["value"]

export type MemberRecord = {
  id: string
  fullName: string
  displayName: string
  email: string
  role: MemberRole
  billingStatus: MemberBillingStatus
  authProvider: MemberAuthProvider
  joinedAt: string
  avatarSrc: string
  initials: string
}

export const MEMBER_RECORDS: MemberRecord[] = [
  {
    id: "lena-torres",
    fullName: "Lena Torres",
    displayName: "lena.torres",
    email: "lena@northline.app",
    role: "Admin",
    billingStatus: "Active",
    authProvider: "Google",
    joinedAt: "Apr 17, 2026",
    avatarSrc:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&dpr=2&q=80",
    initials: "LT",
  },
  {
    id: "marcus-hale",
    fullName: "Marcus Hale",
    displayName: "marcus.hale",
    email: "marcus@northline.app",
    role: "Finance",
    billingStatus: "Pending invoice",
    authProvider: "Okta SSO",
    joinedAt: "Apr 12, 2026",
    avatarSrc:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&dpr=2&q=80",
    initials: "MH",
  },
  {
    id: "imani-brooks",
    fullName: "Imani Brooks",
    displayName: "imani.brooks",
    email: "imani@northline.app",
    role: "Support",
    billingStatus: "Active",
    authProvider: "Passwordless",
    joinedAt: "Mar 29, 2026",
    avatarSrc:
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=80&h=80&dpr=2&q=80",
    initials: "IB",
  },
  {
    id: "theo-mercer",
    fullName: "Theo Mercer",
    displayName: "theo.mercer",
    email: "theo@northline.app",
    role: "Operations",
    billingStatus: "Manual review",
    authProvider: "GitHub",
    joinedAt: "Mar 18, 2026",
    avatarSrc:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=80&h=80&dpr=2&q=80",
    initials: "TM",
  },
  {
    id: "noor-hadid",
    fullName: "Noor Hadid",
    displayName: "noor.hadid",
    email: "noor@northline.app",
    role: "Product",
    billingStatus: "Active",
    authProvider: "Google",
    joinedAt: "Feb 27, 2026",
    avatarSrc:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&dpr=2&q=80",
    initials: "NH",
  },
  {
    id: "avery-quinn",
    fullName: "Avery Quinn",
    displayName: "avery.quinn",
    email: "avery@northline.app",
    role: "Security",
    billingStatus: "Past due",
    authProvider: "Okta SSO",
    joinedAt: "Feb 10, 2026",
    avatarSrc:
      "https://images.unsplash.com/photo-1504593811423-6dd665756598?w=80&h=80&dpr=2&q=80",
    initials: "AQ",
  },
  {
    id: "sofia-lane",
    fullName: "Sofia Lane",
    displayName: "sofia.lane",
    email: "sofia@northline.app",
    role: "Finance",
    billingStatus: "Active",
    authProvider: "Google",
    joinedAt: "Jan 23, 2026",
    avatarSrc:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&dpr=2&q=80",
    initials: "SL",
  },
  {
    id: "dev-rana",
    fullName: "Dev Rana",
    displayName: "dev.rana",
    email: "dev@northline.app",
    role: "Growth",
    billingStatus: "Pending invoice",
    authProvider: "GitHub",
    joinedAt: "Jan 11, 2026",
    avatarSrc:
      "https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=80&h=80&dpr=2&q=80",
    initials: "DR",
  },
]