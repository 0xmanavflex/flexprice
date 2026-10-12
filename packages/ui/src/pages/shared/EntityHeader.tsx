import type { ReactNode } from 'react'
import { DetailBreadcrumb, type DetailCrumb } from '../../compositions/detail/DetailShell'
import {
  DetailHeaderCluster,
  DetailMoreMenu,
  type DetailMenuItem,
} from '../../compositions/detail/DetailKit'
import { DetailPills } from '../../compositions/detail/pillSize'

export interface EntityHeaderProps {
  trail: DetailCrumb[]
  /** Glyph shown inside the neutral icon tile. */
  icon: ReactNode
  title: string
  /** Status and type pills, shown small under the title (status first). */
  badges?: ReactNode
  /** Copyable identifier, shown as an "ID" copy chip. */
  id?: string
  /** Copyable email, shown as a mail-icon copy chip beside the id. */
  email?: string
  /** Accessible name of the More button, e.g. "Customer actions". */
  menuLabel?: string
  /** Every action for the record. The header has no other action control. */
  menu?: DetailMenuItem[]
}

/**
 * The detail-page header for records that need a custom tile (an avatar, say):
 * the tile, the name and the small pills under it on the left; on the right the
 * shared `DetailHeaderCluster` — "ID"/email copy chips, then a single More menu
 * that holds every action (no inline buttons).
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
  menuLabel = 'More actions',
  menu = [],
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
          <div className="min-w-0">
            <h1 className="min-w-0 truncate text-xl leading-tight font-medium tracking-tight">
              {title}
            </h1>
            <DetailPills>{badges}</DetailPills>
          </div>
        </div>
        <DetailHeaderCluster
          id={id}
          email={email}
          more={<DetailMoreMenu label={menuLabel} items={menu} />}
        />
      </div>
    </header>
  )
}
