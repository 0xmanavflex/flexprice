// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import { type ReactNode } from "react"

interface InnerSidebarProps {
  label: string
  children: ReactNode
}

export function InnerSidebar({ label, children }: InnerSidebarProps) {
  return (
    <aside
      className="bg-muted dark:bg-background hidden w-(--sidebar-width-inner) shrink-0 overflow-hidden md:flex"
      aria-label={`${label} navigation`}
    >
      <div className="flex w-(--sidebar-width-inner) shrink-0 flex-col overflow-hidden">
        {children}
      </div>
    </aside>
  )
}