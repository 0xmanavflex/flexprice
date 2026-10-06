// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import type { BadgeProps } from "@ui/components/reui/badge"

export type Invitee = {
  id: string
  name: string
  email: string
  department: string
}

export type RoleBadge = {
  label: string
  variant: BadgeProps["variant"]
}

export type RolePermission = {
  id: string
  label: string
  description: string
  badges?: RoleBadge[]
}

export type RoleGroup = {
  id: string
  label: string
  description: string
  defaultOpen?: boolean
  roles: RolePermission[]
}

export type WorkspaceOption = {
  value: string
  label: string
  description: string
}

export type InviteExpiryOption = {
  value: string
  label: string
  description: string
}

export type MemberTypeOption = {
  value: "employee" | "contractor" | "service_account"
  label: string
  description: string
}

export const INVITEES: Invitee[] = [
  {
    id: "iris",
    name: "Iris Kwon",
    email: "iris.kwon@atlaslane.dev",
    department: "Product Operations",
  },
  {
    id: "mateo",
    name: "Mateo Silva",
    email: "mateo.silva@atlaslane.dev",
    department: "Platform Engineering",
  },
  {
    id: "nina",
    name: "Nina Patel",
    email: "nina.patel@atlaslane.dev",
    department: "Finance Systems",
  },
  {
    id: "omar",
    name: "Omar Haddad",
    email: "omar.haddad@atlaslane.dev",
    department: "Customer Trust",
  },
  {
    id: "renee",
    name: "Renee Park",
    email: "renee.park@atlaslane.dev",
    department: "Identity Services",
  },
]

export const DEFAULT_INVITEES = [INVITEES[0]]

export const WORKSPACE_OPTIONS: WorkspaceOption[] = [
  {
    value: "global-operations",
    label: "Global Operations",
    description: "Customer data access.",
  },
  {
    value: "platform-control",
    label: "Platform Control",
    description: "Internal tools and releases.",
  },
  {
    value: "finance-ledger",
    label: "Finance Ledger",
    description: "Billing and reconciliation.",
  },
]

export const INVITE_EXPIRY_OPTIONS: InviteExpiryOption[] = [
  {
    value: "7_days",
    label: "7 days",
    description: "Recommended for sensitive workspaces.",
  },
  {
    value: "14_days",
    label: "14 days",
    description: "Standard enterprise invite window.",
  },
  {
    value: "30_days",
    label: "30 days",
    description: "Use for planned onboarding batches.",
  },
]

export const MEMBER_TYPE_OPTIONS: MemberTypeOption[] = [
  {
    value: "employee",
    label: "Employee",
    description: "SSO managed.",
  },
  {
    value: "contractor",
    label: "Contractor",
    description: "Time-bound access.",
  },
  {
    value: "service_account",
    label: "Service account",
    description: "Automation owner.",
  },
]

export const ROLE_GROUPS: RoleGroup[] = [
  {
    id: "admin",
    label: "Admin roles",
    description: "Workspace governance.",
    roles: [
      {
        id: "org-owner",
        label: "Organization owner",
        description: "Billing, security, audit exports.",
        badges: [{ label: "Privileged", variant: "destructive-light" }],
      },
      {
        id: "workspace-admin",
        label: "Workspace admin",
        description: "Members, roles, access reviews.",
      },
    ],
  },
  {
    id: "developer",
    label: "Developer roles",
    description: "Build and operate.",
    defaultOpen: true,
    roles: [
      {
        id: "developer",
        label: "Developer",
        description: "Integrations and logs.",
      },
      {
        id: "secret-manager",
        label: "Secret manager",
        description: "API keys, webhooks, secrets.",
        badges: [{ label: "MFA", variant: "warning-light" }],
      },
      {
        id: "release-engineer",
        label: "Release engineer",
        description: "Deployment approvals and retries.",
      },
    ],
  },
  {
    id: "finance",
    label: "Finance roles",
    description: "Billing operations.",
    defaultOpen: true,
    roles: [
      {
        id: "finance-analyst",
        label: "Finance analyst",
        description: "Payouts and billing events.",
        badges: [{ label: "Export", variant: "info-light" }],
      },
      {
        id: "refund-analyst",
        label: "Refund analyst",
        description: "Refunds, credits, invoices.",
      },
      {
        id: "dispute-analyst",
        label: "Dispute analyst",
        description: "Disputes and chargebacks.",
      },
    ],
  },
  {
    id: "support",
    label: "Support roles",
    description: "Case operations.",
    roles: [
      {
        id: "support-agent",
        label: "Support agent",
        description: "Account lookup and notes.",
      },
      {
        id: "support-lead",
        label: "Support lead",
        description: "Escalations and approvals.",
      },
    ],
  },
  {
    id: "view-only",
    label: "View only roles",
    description: "Read-only access.",
    roles: [
      {
        id: "workspace-viewer",
        label: "Workspace viewer",
        description: "Dashboards and activity.",
        badges: [{ label: "Read only", variant: "secondary" }],
      },
      {
        id: "audit-viewer",
        label: "Audit viewer",
        description: "Logs and evidence exports.",
      },
    ],
  },
  {
    id: "identity",
    label: "Identity roles",
    description: "Identity controls.",
    roles: [
      {
        id: "identity-admin",
        label: "Identity admin",
        description: "SSO, SCIM, login policy.",
        badges: [{ label: "MFA", variant: "warning-light" }],
      },
      {
        id: "access-reviewer",
        label: "Access reviewer",
        description: "Reviews and exceptions.",
      },
    ],
  },
  {
    id: "sandbox",
    label: "Sandbox roles",
    description: "Test environments.",
    roles: [
      {
        id: "sandbox-admin",
        label: "Sandbox admin",
        description: "Test tenants and integrations.",
      },
      {
        id: "sandbox-viewer",
        label: "Sandbox viewer",
        description: "Sandbox events and training data.",
        badges: [{ label: "Read only", variant: "secondary" }],
      },
    ],
  },
]

export const DEFAULT_SELECTED_ROLE_IDS = [
  "developer",
  "finance-analyst",
  "support-agent",
]