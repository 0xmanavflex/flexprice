import { createContext, useContext, useEffect, useRef } from 'react'

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

/**
 * Hand a page's own trail up to the shell header.
 *
 * The header already draws the section. A form or a record appends itself, and
 * the crumb before it becomes the way back. Outside the shell this does nothing.
 */
export function usePublishDetailTrail(trail: readonly { label: string; onClick?: () => void }[]) {
  const publish = useShellDetailTrail()
  const latest = useRef(trail)
  latest.current = trail
  const key = trail.map((crumb) => `${crumb.label}\u0001${crumb.onClick ? '1' : '0'}`).join('\u0000')

  useEffect(() => {
    if (!publish || latest.current.length < 2) return
    publish(
      latest.current.map((crumb, index) => ({
        label: crumb.label,
        onClick: () => latest.current[index]?.onClick?.(),
        hasClick: Boolean(crumb.onClick),
      })),
    )
    return () => publish(null)
  }, [publish, key])
}
