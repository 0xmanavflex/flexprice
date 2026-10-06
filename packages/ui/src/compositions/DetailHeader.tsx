import type { ReactNode } from 'react'
import { provenance } from '@ui/provenance'
import { DescriptionTip } from './DescriptionTip'
import { CopyId } from './DetailKit'

/**
 * A detail page's header (reference `DetailHeader`): icon tile, record name,
 * one-line subtitle, copyable id, and the actions (one primary plus a menu).
 *
 * Status and type belong in the subtitle (use `badges` for pills that sit on
 * the subtitle line) and the Information tab, not beside the name.
 * `subtitle` is the reference prop; `description` and `identifier` remain as
 * aliases of `subtitle` and `id`.
 */
export const DetailHeaderProvenance = provenance({
  source: 'composition',
  composes: ['compositions/detail-kit'],
  note: 'Reference detail header: icon tile, title, subtitle line, copyable id, actions.',
})

export interface DetailHeaderProps {
  title: string
  /** Icon shown in the tile left of the title. */
  icon?: ReactNode
  /** One line under the title; use `Dot` between facts. */
  subtitle?: ReactNode
  /** Alias of `subtitle`. */
  description?: string
  /** Status and type pills, leading the subtitle line. */
  badges?: ReactNode
  /** The record id, rendered as a copy button. */
  id?: string
  /** Alias of `id`. */
  identifier?: string
  /** The primary action and any overflow menu. */
  actions?: ReactNode
  breadcrumb?: ReactNode
}

export function DetailHeader({
  title,
  icon,
  subtitle,
  description,
  badges,
  id,
  identifier,
  actions,
  breadcrumb,
}: DetailHeaderProps) {
  const copyId = id ?? identifier
  const line = subtitle ?? description
  return (
    <header className="flex flex-col gap-3">
      {breadcrumb}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {icon ? (
            <span className="bg-muted/60 text-foreground/70 flex size-11 shrink-0 items-center justify-center rounded-xl border [&_svg]:size-5">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0 space-y-1">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-xl font-medium tracking-tight">{title}</h1>
              {line ? <DescriptionTip>{line}</DescriptionTip> : null}
            </div>
            {badges ? (
              <div className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-[13px]">
                {badges}
              </div>
            ) : null}
          </div>
        </div>
        {copyId || actions ? (
          <div className="flex items-center gap-2">
            {copyId ? <CopyId value={copyId} /> : null}
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  )
}
