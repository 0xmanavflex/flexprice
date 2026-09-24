// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import { type ReactNode } from "react"
import { type BadgeProps } from "@ui/components/reui/badge"
import { ZapIcon, SparklesIcon, ActivityIcon, LayersIcon, UserCircle, BarChart3Icon, SettingsIcon, UsersIcon, ShieldCheckIcon, FolderIcon, FileTextIcon, HouseIcon, UsersRoundIcon, InboxIcon, UserRoundCogIcon, BriefcaseBusinessIcon, PaletteIcon, PlusIcon, BadgeCheckIcon, CodeIcon, PackageIcon, DownloadIcon, ExternalLinkIcon, BookOpenIcon, MegaphoneIcon } from "lucide-react"

export type NavItem = {
  id: string
  label: string
  icon: ReactNode
  isActive?: boolean
}

export type InnerNavItem = {
  id: string
  label: string
  icon: ReactNode
  iconClassName?: string
  isActive?: boolean
  badge?: string | number
  badgeVariant?: BadgeProps["variant"]
}

export type InnerNavSection = {
  id: string
  title?: string
  action?: "plus" | "chevron"
  collapsible?: boolean
  items: InnerNavItem[]
}

export type InnerNavData = {
  sections: InnerNavSection[]
}

export type Workspace = {
  id: string
  name: string
  members: number
  color: string
  icon: ReactNode
}

export const USER = {
  name: "Chris Dale",
  email: "chris@thunder.example",
  initials: "CD",
  avatar:
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=96&h=96&dpr=2&q=80",
} as const

export const WORKSPACES: Workspace[] = [
  {
    id: "thunder",
    name: "Thunder AI",
    members: 8,
    color: "bg-teal-600 text-white",
    icon: (
      <ZapIcon className="size-4" aria-hidden="true" />
    ),
  },
  {
    id: "spark",
    name: "Spark AI",
    members: 6,
    color: "bg-fuchsia-600 text-white",
    icon: (
      <SparklesIcon className="size-4" aria-hidden="true" />
    ),
  },
  {
    id: "signal",
    name: "Signal AI",
    members: 12,
    color: "bg-amber-600 text-white",
    icon: (
      <ActivityIcon className="size-4" aria-hidden="true" />
    ),
  },
  {
    id: "atlas",
    name: "Atlas AI",
    members: 4,
    color: "bg-blue-600 text-white",
    icon: (
      <LayersIcon className="size-4" aria-hidden="true" />
    ),
  },
]

export const NAV_ITEMS: NavItem[] = [
  {
    id: "profile",
    label: "Profile",
    icon: (
      <UserCircle aria-hidden="true" />
    ),
  },
  {
    id: "updates",
    label: "Updates",
    isActive: true,
    icon: (
      <BarChart3Icon aria-hidden="true" />
    ),
  },
  {
    id: "account",
    label: "Account",
    icon: (
      <SettingsIcon aria-hidden="true" />
    ),
  },
  {
    id: "network",
    label: "Network",
    icon: (
      <UsersIcon aria-hidden="true" />
    ),
  },
  {
    id: "access",
    label: "Access",
    icon: (
      <ShieldCheckIcon aria-hidden="true" />
    ),
  },
  {
    id: "files",
    label: "Files",
    icon: (
      <FolderIcon aria-hidden="true" />
    ),
  },
  {
    id: "notes",
    label: "Notes",
    icon: (
      <FileTextIcon aria-hidden="true" />
    ),
  },
]

export const INNER_NAV: Record<string, InnerNavData> = {
  updates: {
    sections: [
      {
        id: "main",
        items: [
          {
            id: "home",
            label: "Home",
            icon: (
              <HouseIcon aria-hidden="true" />
            ),
          },
          {
            id: "updates",
            label: "Updates",
            isActive: true,
            icon: (
              <UsersRoundIcon aria-hidden="true" />
            ),
          },
          {
            id: "inbox",
            label: "Inbox",
            icon: (
              <InboxIcon aria-hidden="true" />
            ),
          },
          {
            id: "clients",
            label: "Clients",
            badge: "Beta",
            badgeVariant: "destructive-light",
            icon: (
              <UserRoundCogIcon aria-hidden="true" />
            ),
          },
          {
            id: "tasks",
            label: "My Tasks",
            icon: (
              <BarChart3Icon aria-hidden="true" />
            ),
          },
        ],
      },
      {
        id: "workspaces",
        title: "Workspaces",
        action: "plus",
        items: [
          {
            id: "concepts",
            label: "Business Concepts",
            icon: (
              <BriefcaseBusinessIcon aria-hidden="true" />
            ),
          },
          {
            id: "studio",
            label: "KeenThemes Studio",
            icon: (
              <PaletteIcon aria-hidden="true" />
            ),
          },
          {
            id: "teams",
            label: "Teams",
            badge: "Pro",
            badgeVariant: "success-light",
            icon: (
              <UsersIcon aria-hidden="true" />
            ),
          },
          {
            id: "reports",
            label: "Reports",
            icon: (
              <BarChart3Icon aria-hidden="true" />
            ),
          },
        ],
      },
      {
        id: "communities",
        title: "Communities",
        action: "chevron",
        collapsible: true,
        items: [
          {
            id: "create-community",
            label: "Create a community",
            icon: (
              <PlusIcon aria-hidden="true" />
            ),
          },
          {
            id: "designers",
            label: "Designers Hub",
            iconClassName: "text-rose-500",
            icon: (
              <BadgeCheckIcon aria-hidden="true" />
            ),
          },
          {
            id: "react",
            label: "React Js",
            iconClassName: "text-sky-500",
            icon: (
              <CodeIcon aria-hidden="true" />
            ),
          },
          {
            id: "node",
            label: "Node Js",
            iconClassName: "text-lime-600",
            icon: (
              <PackageIcon aria-hidden="true" />
            ),
          },
        ],
      },
      {
        id: "resources",
        title: "Resources",
        action: "chevron",
        collapsible: true,
        items: [
          {
            id: "about",
            label: "About Metronic",
            icon: (
              <DownloadIcon aria-hidden="true" />
            ),
          },
          {
            id: "advertise",
            label: "Advertise",
            badge: "Pro",
            badgeVariant: "success-light",
            icon: (
              <FileTextIcon aria-hidden="true" />
            ),
          },
          {
            id: "help",
            label: "Help",
            icon: (
              <ExternalLinkIcon aria-hidden="true" />
            ),
          },
          {
            id: "blog",
            label: "Blog",
            icon: (
              <BookOpenIcon aria-hidden="true" />
            ),
          },
          {
            id: "careers",
            label: "Careers",
            icon: (
              <BriefcaseBusinessIcon aria-hidden="true" />
            ),
          },
          {
            id: "press",
            label: "Press",
            icon: (
              <MegaphoneIcon aria-hidden="true" />
            ),
          },
        ],
      },
    ],
  },
}