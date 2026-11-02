import type { ReactNode } from 'react'
import type { PortalInvoiceStatus, PortalSubscriptionStatus } from '@fp/domain'
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
} from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { RadioGroup, RadioGroupItem } from '@ui/components/primitives/radio-group'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { IconTile } from '@ui/components/reui/icon-tile'
import { ErrorState } from '@ui/compositions/feedback/States'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { Pill, type PillTone } from '../shared/cells'
import type { Load } from './types'
import { PORTAL_SUBSCRIPTION_STATUS_TONE } from '../shared/statusTones'

/**
 * The customer portal's building blocks, after the portal prototype
 * (`prototype/src/portal/parts.tsx`): the summary cell, empty states, status
 * pills, radio rows, the checkout hand-off and the ledger row: each on kit
 * and ReUI pieces (IconTile, RadioGroup, Pill, Button, ErrorState).
 */
export const PortalPartsProvenance = provenance({
  source: 'composition',
  composes: [
    'reui/icon-tile',
    'primitives/radio-group',
    'primitives/button',
    'primitives/skeleton',
    'compositions/feedback/States',
    'shared/cells',
  ],
  note: 'Customer portal parts, after the portal prototype: summary cell, empty state, pills, radio rows, checkout hand-off, ledger row.',
})

/** Renders a `Load`: bones while loading, an inline retry when it failed. */
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

/** A panel's empty state: an icon tile, one line, one hint. */
export function PortalEmpty({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <IconTile
        size="default"
        variant="outline"
        className="text-muted-foreground"
        aria-hidden="true"
      >
        {icon}
      </IconTile>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground max-w-sm text-[13px]">{description}</p>
      </div>
      {action}
    </div>
  )
}

/**
 * One figure of the account summary (profile-8's usage metrics card): an icon
 * tile and its label, the figure, a line under it, and an action link.
 */
export function SummaryCell({
  icon,
  label,
  value,
  hint,
  tone = 'muted',
  action,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  hint: ReactNode
  tone?: 'muted' | 'danger'
  action?: { label: string; run: () => void } | undefined
}) {
  return (
    <div className="flex flex-col gap-4 px-6 py-5">
      <div className="flex items-center gap-3">
        <IconTile
          size="default"
          variant="outline"
          className="text-foreground/70"
          aria-hidden="true"
        >
          {icon}
        </IconTile>
        <p className="text-sm">{label}</p>
      </div>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2 text-2xl font-medium tracking-tight tabular-nums">
          {value}
        </div>
        <p
          className={cn(
            'text-[13px]',
            tone === 'danger'
              ? 'text-destructive-foreground dark:text-destructive'
              : 'text-muted-foreground',
          )}
        >
          {hint}
        </p>
      </div>
      {action ? (
        <Button
          variant="link"
          className="text-foreground h-auto self-start p-0 text-[13px]"
          onClick={action.run}
        >
          {action.label}
        </Button>
      ) : null}
    </div>
  )
}

const INVOICE_STATUS: Record<PortalInvoiceStatus, [PillTone, string]> = {
  draft: ['neutral', 'Draft'],
  open: ['warning', 'Due'],
  overdue: ['danger', 'Overdue'],
  failed: ['danger', 'Payment failed'],
  processing: ['warning', 'Processing'],
  paid: ['success', 'Paid'],
  void: ['neutral', 'Void'],
}

export function invoiceStatusLabel(status: PortalInvoiceStatus): string {
  return INVOICE_STATUS[status][1]
}

export function InvoiceStatusPill({ status }: { status: PortalInvoiceStatus }) {
  const [tone, label] = INVOICE_STATUS[status]
  return <Pill tone={tone}>{label}</Pill>
}

export function SubscriptionStatusPill({
  status,
  label,
}: {
  status: PortalSubscriptionStatus
  label: string
}) {
  return <Pill tone={PORTAL_SUBSCRIPTION_STATUS_TONE[status]}>{label}</Pill>
}

export interface RadioRowOption {
  value: string
  /** A logo or icon before the text. */
  media?: ReactNode
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
}

/** Selectable rows (payment choice, provider, download format), on the kit's RadioGroup. */
export function RadioRows({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: RadioRowOption[]
}) {
  return (
    <RadioGroup
      aria-label={label}
      value={value}
      onValueChange={(next) => onChange(String(next))}
      className="flex flex-col gap-2"
    >
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            'flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors',
            value === option.value
              ? 'border-primary/60 bg-primary/4 ring-primary/20 ring-2'
              : 'hover:bg-muted/40',
            option.disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          <RadioGroupItem value={option.value} disabled={option.disabled ?? false} />
          {option.media}
          <span className="min-w-0 flex-1">
            <span className="block text-sm">{option.label}</span>
            {option.description ? (
              <span className="text-muted-foreground block text-xs">{option.description}</span>
            ) : null}
          </span>
        </label>
      ))}
    </RadioGroup>
  )
}

/**
 * Shown once a hosted checkout or payment link is open: the page is in a new
 * tab, and the link stays here, because the tab may have been blocked or the
 * portal may be embedded in an iframe.
 */
export function CheckoutLinkPanel({
  url,
  amount,
  onCopy,
  onDone,
}: {
  url: string
  /** "$500.00", or "nothing now" for saving a card. */
  amount: ReactNode
  onCopy: () => void
  onDone: () => void
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="bg-muted/40 flex items-start gap-3 rounded-lg border p-4">
        <IconTile size="sm" variant="soft" className="text-primary rounded-full" aria-hidden="true">
          <ExternalLinkIcon />
        </IconTile>
        <div className="flex flex-col gap-1 text-[13px]">
          <p className="text-sm font-medium">Finish paying {amount} in the new tab</p>
          <p className="text-muted-foreground">
            We opened the payment page in a new tab. If it didn’t open, use the link below. This
            page updates by itself once the payment goes through.
          </p>
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2">
        <span className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-xs">
          {url}
        </span>
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onCopy}>
          <CopyIcon aria-hidden="true" />
          Copy
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-5">
        <Button
          variant="outline"
          className="h-8 px-3"
          nativeButton={false}
          render={<a href={url} target="_blank" rel="noopener noreferrer" role="link" />}
        >
          <ExternalLinkIcon aria-hidden="true" />
          Open payment page
        </Button>
        <Button className="h-8 px-3" onClick={onDone}>
          <CheckIcon aria-hidden="true" />
          I’ve paid
        </Button>
      </div>
    </div>
  )
}

/** One wallet transaction, list-5 style: a tone tile, reason and detail, date, signed amount and credits. */
export function LedgerRow({
  reason,
  detail,
  date,
  incoming,
  amount,
  credits,
}: {
  reason: string
  detail: string
  date: string
  incoming: boolean
  amount: ReactNode
  credits: string
}) {
  const tone = incoming
    ? 'text-success-foreground dark:text-success'
    : 'text-destructive-foreground dark:text-destructive'
  return (
    <li className="flex items-center gap-4 px-6 py-4">
      <IconTile size="default" variant="soft" className={tone} aria-hidden="true">
        {incoming ? <ArrowUpRightIcon /> : <ArrowDownRightIcon />}
      </IconTile>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium">{reason}</p>
        {detail ? <p className="text-muted-foreground truncate text-xs">{detail}</p> : null}
      </div>
      <span className="text-muted-foreground hidden w-28 text-xs sm:block">{date}</span>
      <div className="w-32 space-y-0.5 text-right">
        <p className={cn('text-[15px] font-medium tabular-nums', tone)}>
          {incoming ? '+ ' : '− '}
          {amount}
        </p>
        <p className="text-muted-foreground text-xs tabular-nums">
          {incoming ? '+' : '−'}
          {credits} credits
        </p>
      </div>
    </li>
  )
}
