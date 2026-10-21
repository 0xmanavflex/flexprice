import type { CSSProperties, ReactNode } from 'react'
import type { PortalCustomer, PortalView } from '@fp/domain'
import { Avatar, AvatarFallback } from '@ui/components/primitives/avatar'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@ui/components/primitives/tabs'
import { provenance } from '@ui/provenance'
import type { Load } from './types'

/**
 * The portal's frame: the merchant's mark and "Billing", the customer on the
 * right, one tab per view, and "Powered by Flexprice" at the foot. The brand
 * colour, when the merchant set one, repaints `--primary` for everything inside.
 */
export const PortalShellProvenance = provenance({
  source: 'composition',
  composes: ['primitives/tabs', 'primitives/avatar', 'primitives/skeleton'],
  note: 'Customer portal header, view tabs and footer, after the reference portal.',
})

const VIEW_LABEL: Record<PortalView, string> = {
  overview: 'Overview',
  usage: 'Usage',
  credits: 'Credits',
  invoices: 'Invoices',
}

export function PortalShell({
  brandName,
  brandColor,
  customer,
  views,
  view,
  onViewChange,
  children,
}: {
  brandName: string | null
  brandColor: string | null
  customer: Load<PortalCustomer>
  views: readonly PortalView[]
  view: PortalView
  onViewChange: (view: PortalView) => void
  children: ReactNode
}) {
  const style = brandColor
    ? ({ '--primary': brandColor, '--ring': brandColor } as CSSProperties)
    : undefined
  return (
    <div className="bg-muted/30 text-foreground flex min-h-svh flex-col" style={style}>
      <header className="bg-background border-b">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 pt-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              {brandName ? (
                <>
                  <span
                    aria-hidden="true"
                    className="bg-primary text-primary-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-medium"
                  >
                    {brandName.charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate text-sm font-medium">{brandName}</span>
                  <span className="bg-border h-4 w-px" aria-hidden="true" />
                </>
              ) : null}
              <span className="text-muted-foreground text-sm">Billing</span>
            </div>
            <CustomerBadge customer={customer} />
          </div>
          <Tabs value={view} onValueChange={(value) => onViewChange(value as PortalView)}>
            <TabsList variant="line" aria-label="Billing sections" className="-mb-px h-10">
              {views.map((v) => (
                <TabsTrigger key={v} value={v}>
                  {VIEW_LABEL[v]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        {children}
      </main>
      <footer className="bg-background border-t py-6 text-center">
        <p className="text-muted-foreground text-xs">
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
      </footer>
    </div>
  )
}

function CustomerBadge({ customer }: { customer: Load<PortalCustomer> }) {
  if (customer.status !== 'ready') {
    return <Skeleton className="h-8 w-40" aria-hidden="true" />
  }
  const { name, email, initials } = customer.data
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="hidden min-w-0 text-right sm:block">
        <p className="truncate text-sm font-medium">{name}</p>
        {email ? <p className="text-muted-foreground truncate text-xs">{email}</p> : null}
      </div>
      <Avatar className="size-8">
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
    </div>
  )
}
