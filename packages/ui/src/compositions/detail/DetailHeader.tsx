import type { ReactNode } from 'react'
import { provenance } from '@ui/provenance'
import { DetailHeaderCluster } from './DetailKit'
import { DetailPills } from './pillSize'

/**
 * A detail page's header (reference `DetailHeader`): icon tile and record name
 * on the left; the status and type pills in a small row directly under it; on the
 * right the "ID" (and email) copy chips and the More menu.
 *
 * There is no subtitle line.
 * `identifier` remains as an alias of `id`.
 */
export const DetailHeaderProvenance = provenance({
  source: 'composition',
  composes: ['compositions/detail-kit'],
  note: 'Reference detail header: icon tile, title; right cluster of primary actions, chips, copy chips, More menu.',
})

export interface DetailHeaderProps {
  title: string
  /** Icon shown in the tile left of the title. */
  icon?: ReactNode
  /** Status and type pills, shown small under the title (status first). */
  badges?: ReactNode
  /** The record id, rendered as an "ID" copy chip. */
  id?: string | undefined
  /** The id in the customer's own systems, as an "External ID" chip before the ID. */
  externalId?: string | undefined
  /** Alias of `id`. */
  identifier?: string
  /** An email, rendered as a mail-icon copy chip beside the id. */
  email?: string | undefined
  /** Legacy inline action slot. Prefer putting every action in `actions` via `DetailMoreMenu`. */
  primary?: ReactNode
  /** Connected integration marks beside the record identifier. */
  leading?: ReactNode
  /** The overflow (More) menu, last in the right-hand cluster. Build it with `DetailMoreMenu`. */
  actions?: ReactNode
  breadcrumb?: ReactNode
}

export function DetailHeader({
  title,
  icon,
  badges,
  id,
  externalId,
  identifier,
  email,
  primary,
  leading,
  actions,
  breadcrumb,
}: DetailHeaderProps) {
  return (
    <header className="flex flex-col gap-3">
      {breadcrumb}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          {icon ? (
            <span className="bg-muted/60 text-foreground/70 flex size-11 shrink-0 items-center justify-center rounded-xl border [&_svg]:size-5">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <h1 className="min-w-0 truncate text-xl font-medium tracking-tight">{title}</h1>
            <DetailPills>{badges}</DetailPills>
          </div>
        </div>
        <DetailHeaderCluster
          primary={primary}
          leading={leading}
          externalId={externalId}
          id={id ?? identifier}
          email={email}
          more={actions}
        />
      </div>
    </header>
  )
}
