import type { ReactNode } from 'react'
import { DetailBreadcrumb, type DetailCrumb } from '../../compositions/DetailShell'
import { CopyId } from '../../compositions/DetailKit'

export interface EntityHeaderProps {
  trail: DetailCrumb[]
  /** Glyph shown inside the neutral icon tile. */
  icon: ReactNode
  title: string
  /** One short line under the name, e.g. the feature type. */
  subtitle?: string
  /** Copyable identifier shown beside the subtitle. */
  id?: string
  /** One primary action and its overflow menu. */
  actions?: ReactNode
}

/**
 * The detail-page header for catalogue records: breadcrumb, an icon tile, the
 * name, a one-line subtitle with a copyable id, and the actions on the right.
 * Built here (not in `DetailHeader`) because the tile needs a slot that shared
 * header does not have.
 */
export function EntityHeader({ trail, icon, title, subtitle, id, actions }: EntityHeaderProps) {
  return (
    <header className="flex flex-col gap-4 px-6 pt-5 pb-4">
      <DetailBreadcrumb trail={trail} />
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground"
          >
            {icon}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="truncate text-lg leading-tight font-medium">{title}</h1>
            {subtitle || id ? (
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {subtitle ? <span>{subtitle}</span> : null}
                {id ? <CopyId value={id} /> : null}
              </div>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  )
}
