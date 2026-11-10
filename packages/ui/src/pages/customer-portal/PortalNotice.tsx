import type { ReactNode } from 'react'
import { LockIcon } from '@ui/icons'
import { IconTile } from '@ui/components/reui/icon-tile'
import { provenance } from '@ui/provenance'

/**
 * The portal when there is nothing to show: a link that is wrong or has
 * expired, a portal that failed to load, or a checkout return with no session. No sign-in offered: the customer
 * has no Flexprice account; their link is the credential.
 */
export const PortalNoticeProvenance = provenance({
  source: 'composition',
  composes: ['reui/icon-tile'],
  note: 'Customer portal full-page notice for an invalid or expired link.',
})

export function PortalNotice({
  title,
  body,
  action,
  icon = <LockIcon />,
  illustration,
}: {
  title: string
  body: string
  action?: ReactNode
  /** A lock for a link problem; something neutral for a state that is not one. */
  icon?: ReactNode
  /** Shown in place of the icon tile, at its own size (an animated mark, say). */
  illustration?: ReactNode
}) {
  return (
    <div className="bg-muted/30 flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <div className="bg-card flex w-full max-w-md flex-col items-center gap-4 rounded-xl border p-8 text-center">
        {illustration ?? (
          <IconTile size="lg" variant="elevated" aria-hidden="true">
            {icon}
          </IconTile>
        )}
        <div className="flex flex-col gap-1.5">
          <h1 className="text-lg font-medium tracking-tight">{title}</h1>
          <p className="text-muted-foreground text-sm text-balance">{body}</p>
        </div>
        {action}
      </div>
      <p className="text-muted-foreground mt-6 text-xs">
        Powered by{' '}
        <a
          href="https://flexprice.io"
          target="_blank"
          rel="noreferrer"
          className="text-foreground font-medium"
        >
          Flexprice
        </a>
      </p>
    </div>
  )
}
