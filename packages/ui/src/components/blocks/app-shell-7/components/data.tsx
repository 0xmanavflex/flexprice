// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import { type ComponentType, type ReactNode } from "react"
import { GlobeIcon, ShieldIcon, SmartphoneIcon, RocketIcon, FlaskConicalIcon, CodeIcon, LayoutDashboardIcon, UsersIcon, Building2Icon, ShieldCheckIcon, WebhookIcon, KeyRoundIcon, CpuIcon, MonitorIcon, MemoryStickIcon, WifiIcon } from "lucide-react"

// ── Types ──

export type NavChild = {
  id: string
  label: string
  isActive?: boolean
}

export type NavItem = {
  id: string
  label: string
  icon: ReactNode
  badge?: string | number
  isActive?: boolean
  children?: NavChild[]
}

export type Workspace = {
  id: string
  name: string
  tier: string
  Logo: ComponentType<{ className?: string }>
}

export type App = {
  id: string
  name: string
  icon: ReactNode
  isActive?: boolean
}

export type Environment = {
  id: string
  name: string
  icon: ReactNode
  isActive?: boolean
}

export type NewsArticle = {
  href: string
  title: string
  summary: string
  image: string
}

export type ResourceMetric = {
  id: string
  label: string
  unit: string
  icon: ReactNode
  seedRange: [number, number]
  color: string
  spikeThreshold: number
}

export type Agent = {
  id: string
  name: string
  memoryMb: number
  color: string
}

// ── Logos ──

// Acme: indigo → violet → fuchsia diagonal sweep
function AcmeLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="ws-acme"
          x1="0"
          y1="0"
          x2="28"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="35%" stopColor="#7c3aed" />
          <stop offset="70%" stopColor="#a21caf" />
          <stop offset="100%" stopColor="#db2777" />
        </linearGradient>
      </defs>
      <circle cx="14" cy="14" r="14" fill="url(#ws-acme)" />
    </svg>
  )
}

// Starter: rose → orange → amber → lime horizontal sweep
function StarterLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="ws-starter"
          x1="0"
          y1="0"
          x2="28"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#f43f5e" />
          <stop offset="33%" stopColor="#f97316" />
          <stop offset="66%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#84cc16" />
        </linearGradient>
      </defs>
      <circle cx="14" cy="14" r="14" fill="url(#ws-starter)" />
    </svg>
  )
}

// Enterprise: sky → blue → indigo vertical sweep
function EnterpriseLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="ws-enterprise"
          x1="0"
          y1="0"
          x2="28"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="35%" stopColor="#3b82f6" />
          <stop offset="70%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
      <circle cx="14" cy="14" r="14" fill="url(#ws-enterprise)" />
    </svg>
  )
}

// ── Data ──

export const USER = {
  name: "Nick Bold",
  email: "nick@reui.io",
  initials: "NB",
  avatar:
    "https://images.unsplash.com/photo-1543299750-19d1d6297053?w=96&h=96&dpr=2&q=80",
} as const

export const WORKSPACES: Workspace[] = [
  { id: "acme", name: "Acme Inc", tier: "Pro", Logo: AcmeLogo },
  { id: "starter", name: "Starter Kit", tier: "Free", Logo: StarterLogo },
  {
    id: "enterprise",
    name: "Enterprise",
    tier: "Enterprise",
    Logo: EnterpriseLogo,
  },
]

export const APPS: App[] = [
  {
    id: "web-app",
    name: "Web App",
    isActive: true,
    icon: (
      <GlobeIcon className="size-4" aria-hidden="true" />
    ),
  },
  {
    id: "admin",
    name: "Admin Panel",
    icon: (
      <ShieldIcon className="size-4" aria-hidden="true" />
    ),
  },
  {
    id: "mobile",
    name: "Mobile App",
    icon: (
      <SmartphoneIcon className="size-4" aria-hidden="true" />
    ),
  },
]

export const ENVIRONMENTS: Environment[] = [
  {
    id: "production",
    name: "Production",
    isActive: true,
    icon: (
      <RocketIcon className="size-4" aria-hidden="true" />
    ),
  },
  {
    id: "staging",
    name: "Staging",
    icon: (
      <FlaskConicalIcon className="size-4" aria-hidden="true" />
    ),
  },
  {
    id: "development",
    name: "Development",
    icon: (
      <CodeIcon className="size-4" aria-hidden="true" />
    ),
  },
]

export const NAV_MAIN: NavItem[] = [
  {
    id: "overview",
    label: "Overview",
    isActive: true,
    icon: (
      <LayoutDashboardIcon aria-hidden="true" />
    ),
  },
  {
    id: "users",
    label: "Users",
    icon: (
      <UsersIcon aria-hidden="true" />
    ),
    children: [
      { id: "all-users", label: "All Users" },
      { id: "invitations", label: "Invitations" },
      { id: "roles", label: "Roles", isActive: true },
    ],
  },
  {
    id: "organizations",
    label: "Organizations",
    icon: (
      <Building2Icon aria-hidden="true" />
    ),
    children: [
      { id: "org-list", label: "All Organizations" },
      { id: "org-settings", label: "Settings" },
    ],
  },
  {
    id: "security",
    label: "Security",
    icon: (
      <ShieldCheckIcon aria-hidden="true" />
    ),
    children: [
      { id: "attack-protection", label: "Attack Protection" },
      { id: "fraud", label: "Fraud Detection" },
      { id: "audit-log", label: "Audit Log" },
    ],
  },
  {
    id: "webhooks",
    label: "Webhooks",
    icon: (
      <WebhookIcon aria-hidden="true" />
    ),
  },
  {
    id: "api-keys",
    label: "API Keys",
    icon: (
      <KeyRoundIcon aria-hidden="true" />
    ),
  },
]

export const RESOURCE_METRICS: ResourceMetric[] = [
  {
    id: "cpu",
    label: "CPU",
    unit: "%",
    icon: (
      <CpuIcon className="size-3 shrink-0 transition-colors duration-300" aria-hidden="true" />
    ),
    seedRange: [20, 65],
    color: "var(--color-blue-500)",
    spikeThreshold: 60,
  },
  {
    id: "gpu",
    label: "GPU",
    unit: "%",
    icon: (
      <MonitorIcon className="size-3 shrink-0 transition-colors duration-300" aria-hidden="true" />
    ),
    seedRange: [10, 50],
    color: "var(--color-emerald-500)",
    spikeThreshold: 45,
  },
  {
    id: "memory",
    label: "Memory",
    unit: "GB",
    icon: (
      <MemoryStickIcon className="size-3 shrink-0 transition-colors duration-300" aria-hidden="true" />
    ),
    seedRange: [4, 12],
    color: "var(--color-amber-500)",
    spikeThreshold: 12,
  },
  {
    id: "network",
    label: "Network",
    unit: "Mbps",
    icon: (
      <WifiIcon className="size-3 shrink-0 transition-colors duration-300" aria-hidden="true" />
    ),
    seedRange: [5, 80],
    color: "var(--color-violet-500)",
    spikeThreshold: 70,
  },
]

export const AGENTS: Agent[] = [
  {
    id: "ingest",
    name: "Ingest Worker",
    memoryMb: 256,
    color: "var(--color-indigo-500)",
  },
  {
    id: "transform",
    name: "Transform Pipeline",
    memoryMb: 512,
    color: "var(--color-purple-500)",
  },
  {
    id: "query",
    name: "Query Engine",
    memoryMb: 384,
    color: "var(--color-sky-500)",
  },
  {
    id: "export",
    name: "Export Service",
    memoryMb: 128,
    color: "var(--color-teal-500)",
  },
]

export const NEWS_ARTICLES: NewsArticle[] = [
  {
    href: "https://pro.reui.io/changelog?v=2.0.3",
    title: "Multi-theme support is here",
    summary:
      "Switch between Vega, Nova, Maia, Lyra, and Mira themes across all components.",
    image:
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=225&fit=crop&q=80",
  },
  {
    href: "https://pro.reui.io/changelog?v=2.0.2",
    title: "Icon library v2 released",
    summary:
      "Five icon libraries unified under a single API with automatic mapping.",
    image:
      "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=400&h=225&fit=crop&q=80",
  },
  {
    href: "https://pro.reui.io/changelog?v=2.0.1",
    title: "Sidebar layout patterns guide",
    summary:
      "Learn best practices for building responsive sidebar layouts with collapsible navigation.",
    image:
      "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=400&h=225&fit=crop&q=80",
  },
]