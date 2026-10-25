import type { ReactNode } from 'react'

/**
 * A destination, or a group of them.
 *
 * One level of nesting, which is what the product needs: Product Catalog has
 * seven children, Billing six, Developers seven. A flat list would be
 * twenty-four items with no grouping.
 */
export interface ShellNavItem {
  id: string
  label: string
  icon?: ReactNode
  /** A page outside the app: the row is a real link that opens in a new tab. */
  href?: string
  /** Children. A parent with children expands rather than standing alone. */
  items?: ShellNavItem[]
}

export interface ShellNavGroup {
  id: string
  title?: string
  /** Sits at the foot of the sidebar, under a rule, instead of following the groups above it. */
  pinned?: boolean
  items: ShellNavItem[]
}

/**
 * An environment, and whether it is the live one.
 *
 * `kind` is separate from the name because the name is arbitrary: a tenant may
 * call production "Main": and the interface has to treat live data differently
 * regardless of what it was named.
 */
export interface ShellEnvironment {
  id: string
  name: string
  kind: 'production' | 'sandbox'
}

export interface ShellUser {
  name: string
  email: string
  avatarUrl?: string
  /** Shown under the name in the footer, where the block shows a workspace. */
  organization?: string
}
