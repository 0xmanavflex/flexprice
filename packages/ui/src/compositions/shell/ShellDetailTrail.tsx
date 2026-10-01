import { createContext, useContext } from 'react'

export interface ShellDetailCrumb {
  label: string
  onClick: () => void
  hasClick: boolean
}

type Publish = (trail: ShellDetailCrumb[] | null) => void

const ShellDetailTrailContext = createContext<Publish | null>(null)

export const ShellDetailTrailProvider = ShellDetailTrailContext.Provider

/** Null outside a shell that shows detail trails in its own header. */
export function useShellDetailTrail(): Publish | null {
  return useContext(ShellDetailTrailContext)
}
