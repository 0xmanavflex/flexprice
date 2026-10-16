import { createContext, useContext, type ReactNode } from 'react'
import { cn } from '@ui/lib/cn'

export type PillSize = 'default' | 'sm'

/**
 * The size a `Pill` falls back to when the caller passes none. A detail header
 * sets it to `sm` once, so every status, kind and count pill under the title
 * shrinks together without a per-call prop.
 */
export const PillSizeContext = createContext<PillSize>('default')

export const usePillSize = () => useContext(PillSizeContext)

/**
 * The row of small pills directly under a detail page's title: status first,
 * then kind, cadence and counts. Renders nothing when there are none.
 */
export function DetailPills({ children, className }: { children?: ReactNode; className?: string }) {
  if (!children) return null
  return (
    <PillSizeContext.Provider value="sm">
      <div className={cn('flex flex-wrap items-center gap-1.5 pt-0.5', className)}>{children}</div>
    </PillSizeContext.Provider>
  )
}
