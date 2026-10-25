import type { ReactNode } from 'react'
import { DetailBreadcrumb, type DetailCrumb } from '../../compositions/detail/DetailShell'
import { DetailMoreMenu, type DetailMenuItem } from '../../compositions/detail/DetailKit'
import { DetailHeader } from '../../compositions/detail/DetailHeader'

export interface EntityHeaderProps {
  trail: DetailCrumb[]
  /** Glyph shown inside the neutral icon tile. */
  icon: ReactNode
  title: string
  /** Status and type pills, shown small under the title (status first). */
  badges?: ReactNode
  /** Copyable identifier, shown as an "ID" copy chip. */
  id?: string
  /** The id in the customer's own systems, shown first as an "External ID" chip. */
  externalId?: string
  /** Drawn immediately before the copy-ID chip. */
  leading?: ReactNode
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
 * shared `DetailHeaderCluster`: "ID"/email copy chips, then a single More menu
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
  externalId,
  leading,
  email,
  menuLabel = 'More actions',
  menu = [],
}: EntityHeaderProps) {
  return (
    <div className="mx-auto w-full max-w-[var(--shell-max)] px-6 pt-5 pb-5">
      <DetailHeader
        breadcrumb={<DetailBreadcrumb trail={trail} />}
        icon={icon}
        title={title}
        badges={badges}
        id={id}
        {...(externalId ? { externalId } : {})}
        leading={leading}
        email={email}
        actions={<DetailMoreMenu label={menuLabel} items={menu} />}
      />
    </div>
  )
}
