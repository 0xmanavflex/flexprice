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
  // theme.primary_color drives buttons, the active tab and focus rings, so each tenant's portal carries its brand.
  const style = brandColor
    ? ({
        '--primary': brandColor,
        '--primary-foreground': '#ffffff',
        '--ring': brandColor,
      } as CSSProperties)
    : undefined
  return (
    <div className="bg-muted/30 text-foreground flex min-h-svh flex-col" style={style}>
      <header className="bg-background border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            {brandName ? (
              <>
                <span
                  aria-hidden="true"
                  className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-medium"
                >
                  {brandName.charAt(0).toUpperCase()}
                </span>
                <span className="truncate text-[15px] font-medium tracking-tight">{brandName}</span>
                <span className="bg-border hidden h-4 w-px sm:block" aria-hidden="true" />
              </>
            ) : null}
            <span
              className={
                brandName
                  ? 'text-muted-foreground hidden text-sm sm:block'
                  : 'text-[15px] font-medium tracking-tight'
              }
            >
              Billing
            </span>
          </div>
          <CustomerBadge customer={customer} />
        </div>
        <Tabs value={view} onValueChange={(value) => onViewChange(value as PortalView)}>
          <TabsList
            variant="line"
            aria-label="Billing sections"
            className="mx-auto flex h-auto w-full max-w-6xl justify-start gap-6 overflow-x-auto rounded-none p-0 px-5 group-data-horizontal/tabs:h-auto sm:px-8"
          >
            {views.map((v) => (
              <TabsTrigger
                key={v}
                value={v}
                className="text-muted-foreground hover:text-foreground data-active:text-foreground after:bg-primary -mb-px h-auto flex-none rounded-none border-0 px-0 pt-1 pb-3 font-normal group-data-horizontal/tabs:after:bottom-0 focus-visible:ring-0 focus-visible:outline-none focus-visible:after:opacity-100"
              >
                {VIEW_LABEL[v]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 pt-8 pb-16 sm:px-8">
        {children}
      </main>
      <footer className="text-muted-foreground border-t py-6 text-center text-xs">
        Powered by <span className="text-foreground/80">Flexprice</span>
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
      <div className="hidden min-w-0 text-right leading-tight sm:block">
        <p className="truncate text-sm">{name}</p>
        {email ? <p className="text-muted-foreground truncate text-xs">{email}</p> : null}
      </div>
      <Avatar className="size-8 border">
        <AvatarFallback className="bg-muted text-foreground/80 text-xs font-medium">
          {initials}
        </AvatarFallback>
      </Avatar>
    </div>
  )
}
