import type { ReactNode } from 'react'
import type { PortalInvoiceStatus, PortalSubscriptionStatus } from '@fp/domain'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { IconTile } from '@ui/components/reui/icon-tile'
import { ErrorState } from '@ui/compositions/feedback/States'
import { SectionEmpty } from '@ui/compositions/feedback/SectionEmpty'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { Pill, type PillTone } from '../shared/cells'
import type { Load } from './types'

/**
 * The portal's building blocks: a card with a ruled header, a figure tile,
 * status pills, and the loading / failed states every card shares.
 */
export const PortalPartsProvenance = provenance({
  source: 'composition',
  composes: [
    'reui/icon-tile',
    'primitives/skeleton',
    'compositions/feedback/States',
    'compositions/feedback/SectionEmpty',
    'shared/cells',
  ],
  note: 'Customer portal card, figure tile and status pills; the reference portal’s card and tile anatomy.',
})

export function PortalCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string
  description?: string | undefined
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn('bg-card overflow-hidden rounded-xl border', className)}
      aria-label={title}
    >
      <header className="flex items-center justify-between gap-4 border-b px-6 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-medium">{title}</h2>
          {description ? <p className="text-muted-foreground text-[13px]">{description}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

/** One headline figure: icon and label, the figure, a line under it, and an action. */
export function FigureTile({
  icon,
  label,
  value,
  caption,
  captionTone = 'muted',
  action,
}: {
  icon?: ReactNode
  label: string
  value: ReactNode
  caption?: ReactNode
  captionTone?: 'muted' | 'danger'
  action?: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4 p-6">
      <div className="flex items-center gap-3">
        {icon ? (
          <IconTile size="sm" variant="outline" aria-hidden="true">
            {icon}
          </IconTile>
        ) : null}
        <p className="text-sm">{label}</p>
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="truncate text-2xl font-medium tracking-tight tabular-nums">{value}</p>
        {caption ? (
          <p
            className={cn(
              'text-[13px]',
              captionTone === 'danger'
                ? 'text-destructive-foreground dark:text-destructive'
                : 'text-muted-foreground',
            )}
          >
            {caption}
          </p>
        ) : null}
      </div>
      {action ? <div className="-ml-1">{action}</div> : null}
    </div>
  )
}

export function FigureTileSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-6" aria-hidden="true">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-4 w-24" />
    </div>
  )
}

/** Renders a `Load`: rows of bones while loading, an inline retry when it failed. */
export function Loaded<T>({
  load,
  label,
  rows = 3,
  children,
}: {
  load: Load<T>
  label: string
  rows?: number
  children: (data: T) => ReactNode
}) {
  if (load.status === 'loading') {
    return (
      <div className="flex flex-col gap-3 p-6" role="status" aria-label={`Loading ${label}`}>
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }
  if (load.status === 'error') {
    return (
      <div className="p-4">
        <ErrorState
          title={`We couldn’t load your ${label}`}
          description="Check your connection and try again."
          onRetry={load.retry}
        />
      </div>
    )
  }
  return <>{children(load.data)}</>
}

export function PortalEmpty({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return <SectionEmpty title={title} description={description} {...(action ? { action } : {})} />
}

const INVOICE_STATUS: Record<PortalInvoiceStatus, [PillTone, string]> = {
  draft: ['neutral', 'Draft'],
  open: ['info', 'Open'],
  overdue: ['danger', 'Overdue'],
  failed: ['danger', 'Payment failed'],
  processing: ['warning', 'Processing'],
  paid: ['success', 'Paid'],
  void: ['neutral', 'Void'],
}

export function InvoiceStatusPill({ status }: { status: PortalInvoiceStatus }) {
  const [tone, label] = INVOICE_STATUS[status]
  return <Pill tone={tone}>{label}</Pill>
}

const SUBSCRIPTION_TONE: Record<PortalSubscriptionStatus, PillTone> = {
  active: 'success',
  trialing: 'info',
  paused: 'warning',
  cancelled: 'neutral',
  other: 'neutral',
}

export function SubscriptionStatusPill({
  status,
  label,
}: {
  status: PortalSubscriptionStatus
  label: string
}) {
  return <Pill tone={SUBSCRIPTION_TONE[status]}>{label}</Pill>
}

/** A card brand chip: VISA, MC, AMEX. Neutral, so the brand name carries it. */
export function CardMark({ mark }: { mark: string }) {
  return (
    <span
      aria-hidden="true"
      className="bg-foreground text-background inline-flex h-6 w-9 shrink-0 items-center justify-center rounded-md text-[9px] font-medium tracking-wide"
    >
      {mark}
    </span>
  )
}
