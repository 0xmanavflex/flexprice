import type { ReactNode } from 'react'

/** A top-level destination on the icon rail. */
export interface ShellSection {
  id: string
  label: string
  icon: ReactNode
}

/** An entry in the section's own navigation panel. */
export interface ShellNavItem {
  id: string
  label: string
  icon?: ReactNode
  /**
   * How many of this thing exist.
   *
   * Shown so "is there anything here?" is answered before a click — which is
   * how an empty catalogue becomes obvious rather than a surprise after
   * navigating.
   */
  count?: number
}

export interface ShellNavGroup {
  id: string
  title?: string
  items: ShellNavItem[]
}

/**
 * An environment, and whether it is the live one.
 *
 * `kind` is separate from the name because the name is arbitrary — a tenant may
 * call production "Main" — and the interface has to treat live data differently
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
}
