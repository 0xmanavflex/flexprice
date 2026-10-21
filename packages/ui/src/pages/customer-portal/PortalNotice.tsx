import type { ReactNode } from 'react'
import { LockIcon } from '@ui/icons'
import { IconTile } from '@ui/components/reui/icon-tile'
import { provenance } from '@ui/provenance'

/**
 * The portal when there is nothing to show: a link that is wrong or has
 * expired, or a portal that failed to load. No sign-in offered — the customer
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
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="bg-muted/30 flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <div className="bg-card flex w-full max-w-md flex-col items-center gap-4 rounded-xl border p-8 text-center">
        <IconTile size="lg" variant="elevated" aria-hidden="true">
          <LockIcon />
        </IconTile>
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
