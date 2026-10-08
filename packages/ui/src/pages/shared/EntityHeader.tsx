import type { ReactNode } from 'react'
import { DetailBreadcrumb, type DetailCrumb } from '../../compositions/DetailShell'
import { DetailHeaderCluster } from '../../compositions/DetailKit'

export interface EntityHeaderProps {
  trail: DetailCrumb[]
  /** Glyph shown inside the neutral icon tile. */
  icon: ReactNode
  title: string
  /** Status and type chips, shown in the right-hand cluster (never beside the name). */
  badges?: ReactNode
  /** Copyable identifier, shown as an "ID" copy chip. */
  id?: string
  /** Copyable email, shown as a mail-icon copy chip beside the id. */
  email?: string
  /** Up to two primary actions, first in the right-hand cluster. */
  primary?: ReactNode
  /** The overflow (More) menu, last in the right-hand cluster. */
  actions?: ReactNode
}

/**
 * The detail-page header for records that need a custom tile (an avatar, say):
 * the tile and the name on the left; on the right the shared
 * `DetailHeaderCluster` — primary actions, chips, "ID"/email copy chips, More.
 * There is no subtitle line. The trail is published to the shell's header
 * breadcrumb, not drawn here.
 */
export function EntityHeader({
  trail,
  icon,
  title,
  badges,
  id,
  email,
  primary,
  actions,
}: EntityHeaderProps) {
  return (
    <header className="flex flex-col gap-4 px-6 pt-6 pb-4">
      <DetailBreadcrumb trail={trail} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg border"
          >
            {icon}
          </span>
          <h1 className="min-w-0 truncate text-xl leading-tight font-medium tracking-tight">
            {title}
          </h1>
        </div>
        <DetailHeaderCluster
          primary={primary}
          badges={badges}
          id={id}
          email={email}
          more={actions}
        />
      </div>
    </header>
  )
}
