import type { ReactNode } from 'react'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { DetailBreadcrumb, type DetailCrumb } from '../../compositions/DetailShell'
import { CopyId } from '../../compositions/DetailKit'

export interface EntityHeaderProps {
  trail: DetailCrumb[]
  /** Glyph shown inside the neutral icon tile. */
  icon: ReactNode
  title: string
  /** Status badge shown beside the title. */
  badge?: ReactNode
  /** One short line under the name, e.g. the feature type. */
  subtitle?: string
  /** Compact attribute chips (`HeaderChip`) under the name, in place of a subtitle. */
  chips?: ReactNode
  /** Copyable identifier shown beside the subtitle. */
  id?: string
  /** One primary action and its overflow menu. */
  actions?: ReactNode
}

/**
 * The detail-page header for catalogue records: an icon tile, the name, a
 * one-line subtitle, and on the right a copyable id chip and the actions. The
 * trail is published to the shell's header breadcrumb, not drawn here.
 * Built here (not in `DetailHeader`) because the tile needs a slot that shared
 * header does not have.
 */
export function EntityHeader({
  trail,
  icon,
  title,
  badge,
  subtitle,
  chips,
  id,
  actions,
}: EntityHeaderProps) {
  return (
    <header className="flex flex-col gap-4 px-6 pt-6 pb-4">
      <DetailBreadcrumb trail={trail} />
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg border"
          >
            {icon}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-2xl leading-tight font-medium tracking-tight">
                {title}
              </h1>
              {badge}
            </div>
            {subtitle ? (
              <span className="text-muted-foreground text-xs font-normal">{subtitle}</span>
            ) : null}
            {chips ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{chips}</div>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {id ? (
            <span className="px-2.5 py-1.5">
              <CopyId value={id} />
            </span>
          ) : null}
          {actions}
        </div>
      </div>
    </header>
  )
}

/**
 * One attribute as a compact chip: a muted label, the value, and (with `copy`)
 * a click-to-copy affordance. Replaces the cards and subtitle lines a record's
 * header used to spend its height on.
 */
export function HeaderChip({
  label,
  children,
  copy,
}: {
  label: string
  children: ReactNode
  /** The text to put on the clipboard; the chip becomes a button. */
  copy?: string
}) {
  const [copied, setCopied] = useState(false)
  const body = (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground max-w-56 truncate">{children}</span>
    </>
  )
  const className =
    'border-border bg-muted/40 inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs'
  if (!copy) return <span className={className}>{body}</span>
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      className={`${className} hover:bg-muted cursor-pointer`}
      onClick={() => {
        void navigator.clipboard?.writeText(copy)
        toast.success(`${label} copied`)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      }}
    >
      {body}
      {copied ? (
        <CheckIcon className="size-3" aria-hidden="true" />
      ) : (
        <CopyIcon className="text-muted-foreground size-3" aria-hidden="true" />
      )}
    </button>
  )
}
