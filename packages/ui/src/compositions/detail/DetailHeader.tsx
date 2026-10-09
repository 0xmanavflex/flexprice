import type { ReactNode } from 'react'
import { provenance } from '@ui/provenance'
import { DetailHeaderCluster } from './DetailKit'

/**
 * A detail page's header (reference `DetailHeader`): icon tile and record name
 * on the left; on the right, in this order, the primary actions (at most two),
 * the status and type chips, the "ID" (and email) copy chips, and the More menu.
 *
 * There is no subtitle line, and no chip sits beside the name.
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
  /** Status and type chips, shown in the right-hand cluster. */
  badges?: ReactNode
  /** The record id, rendered as an "ID" copy chip. */
  id?: string
  /** Alias of `id`. */
  identifier?: string
  /** An email, rendered as a mail-icon copy chip beside the id. */
  email?: string
  /** Legacy inline action slot. Prefer putting every action in `actions` via `DetailMoreMenu`. */
  primary?: ReactNode
  /** The overflow (More) menu, last in the right-hand cluster. Build it with `DetailMoreMenu`. */
  actions?: ReactNode
  breadcrumb?: ReactNode
}

export function DetailHeader({
  title,
  icon,
  badges,
  id,
  identifier,
  email,
  primary,
  actions,
  breadcrumb,
}: DetailHeaderProps) {
  return (
    <header className="flex flex-col gap-3">
      {breadcrumb}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {icon ? (
            <span className="bg-muted/60 text-foreground/70 flex size-11 shrink-0 items-center justify-center rounded-xl border [&_svg]:size-5">
              {icon}
            </span>
          ) : null}
          <h1 className="min-w-0 truncate text-xl font-medium tracking-tight">{title}</h1>
        </div>
        <DetailHeaderCluster
          primary={primary}
          badges={badges}
          id={id ?? identifier}
          email={email}
          more={actions}
        />
      </div>
    </header>
  )
}
