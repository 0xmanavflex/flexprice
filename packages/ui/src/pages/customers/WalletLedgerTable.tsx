import { useState } from 'react'
import { type WalletConsumption, type WalletTransaction, formatMoney, money } from '@fp/domain'
import { ChevronDownIcon, ChevronRightIcon } from '@ui/icons'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { DetailTable } from '../shared/DetailTable'

export const WalletLedgerTableProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/DetailTable'],
  note: 'DetailTable over a wallet’s top-ups: signed credits, remaining, consumed bar and expiry, with per-product child rows when the API reports them.',
})

/** An expiry this close is called out in amber. */
export const EXPIRING_SOON_DAYS = 14

const DAY_MS = 86_400_000

// `Intl.NumberFormat` formats a decimal string exactly; the cast bridges a lib typing gap.
export const formatCredits = (value: string) =>
  value.trim() === '' || !Number.isFinite(Number(value))
    ? '—'
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(
        value as unknown as number,
      )

export const formatDay = (value: Date, withYear = true) =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  }).format(value)

const daysUntil = (date: Date, now: Date) => Math.ceil((date.getTime() - now.getTime()) / DAY_MS)

const toNumber = (value: string | null): number | null => {
  if (value === null || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** The credits still live on a top-up that has an expiry date. */
function liveCredits(tx: WalletTransaction): number {
  return tx.expiresAt ? (toNumber(tx.creditsAvailable) ?? 0) : 0
}

/** The soonest expiry inside the warning window and the credits that lapse that day, or null. */
export function expiringSoon(
  topUps: WalletTransaction[],
  now: Date,
): { credits: string; date: Date } | null {
  const due = topUps.filter((tx) => {
    if (!tx.expiresAt || liveCredits(tx) <= 0) return false
    const days = daysUntil(tx.expiresAt, now)
    return days >= 0 && days <= EXPIRING_SOON_DAYS
  })
  const first = due.reduce<Date | null>(
    (soonest, tx) =>
      tx.expiresAt && (!soonest || tx.expiresAt.getTime() < soonest.getTime())
        ? tx.expiresAt
        : soonest,
    null,
  )
  if (!first) return null
  const sameDay = due.filter((tx) => tx.expiresAt && formatDay(tx.expiresAt) === formatDay(first))
  return {
    credits: String(sameDay.reduce((sum, tx) => sum + liveCredits(tx), 0)),
    date: first,
  }
}

/** A share of a top-up's dollar amount, for the Remaining column. */
function shareOf(total: WalletTransaction['amount'], part: number, whole: number) {
  const value = whole > 0 ? (Number(total.amount) * part) / whole : Number.NaN
  return Number.isFinite(value) ? formatMoney(money(value.toFixed(2), total.currency)) : '—'
}

type LedgerRow =
  | { kind: 'topup'; id: string; tx: WalletTransaction }
  | { kind: 'debit'; id: string; tx: WalletTransaction }
  | { kind: 'child'; id: string; tx: WalletTransaction; line: WalletConsumption }

/** "Invoice inv_1 · key: value": a transaction's reference and metadata, as one line. */
/** Ids and request dumps. They stay searchable and stay off the row. */
function looksTechnical(text: string): boolean {
  const value = text.trim()
  if (!value) return true
  if (/[_=]/.test(value)) return true
  if (/\b(request|credit_grant|external)\b/i.test(value)) return true
  // A hex blob (credit_grant-d73a8d6d56298a5f). An invoice number is shorter.
  return /[0-9a-f]{10,}/i.test(value)
}

/** "Auto top-up · INV-2026-01441 · added Sep 24, 2026". Never a request id. */
function topUpLine(tx: WalletTransaction): string {
  const description = tx.description.trim()
  const reference = tx.reference?.id.trim() ?? ''
  return [
    description && !looksTechnical(description) ? description : '',
    reference && !looksTechnical(reference) ? reference : '',
    tx.createdAt ? `added ${formatDay(tx.createdAt)}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

const hasBreakdown = (tx: WalletTransaction) => (tx.consumption?.length ?? 0) > 0

function ConsumedBar({
  share,
  label,
  expired = false,
}: {
  share: number | null
  label: string
  expired?: boolean
}) {
  if (share === null) return <span className="text-muted-foreground text-sm">{'—'}</span>
  const percent = Math.min(100, Math.max(0, Math.round(share * 100)))
  const hot = percent >= 90
  const tone = expired ? 'bg-destructive' : hot ? 'bg-warning' : 'bg-muted-foreground/40'
  const text = expired
    ? 'text-destructive-foreground dark:text-destructive'
    : hot
      ? 'text-warning-foreground dark:text-warning'
      : 'text-muted-foreground'
  return (
    <div className="flex items-center gap-2">
      <div
        role="img"
        aria-label={`${percent}% ${label}`}
        className="bg-muted h-1.5 w-16 shrink-0 overflow-hidden rounded-full"
      >
        <div className={cn('h-full rounded-full', tone)} style={{ width: `${percent}%` }} />
      </div>
      <span className={cn('text-xs tabular-nums', text)}>{percent}%</span>
    </div>
  )
}

function Expires({ date, now }: { date: Date | null; now: Date }) {
  if (!date) return <p className="text-sm">Never</p>
  const days = daysUntil(date, now)
  if (days < 0) {
    return (
      <div>
        <p className="text-sm tabular-nums">{formatDay(date)}</p>
        <p className="text-destructive-foreground dark:text-destructive text-xs">Expired</p>
      </div>
    )
  }
  const soon = days <= EXPIRING_SOON_DAYS
  const hint =
    days === 0
      ? 'today'
      : new Intl.RelativeTimeFormat(undefined, { numeric: 'always' }).format(days, 'day')
  return (
    <div>
      <p className="text-sm tabular-nums">{formatDay(date)}</p>
      <p
        className={cn(
          'text-xs',
          soon ? 'text-warning-foreground dark:text-warning' : 'text-muted-foreground',
        )}
      >
        {hint}
      </p>
    </div>
  )
}

/**
 * The wallet's one ledger, newest first. Credits in are top-ups: they carry
 * remaining, consumed and expiry, and open to the products that drew them down
 * when the API says so. Credits out are debits, shown as a plain negative row.
 */
export function WalletLedgerTable({
  transactions,
  now,
  noun = 'transactions',
}: {
  transactions: readonly WalletTransaction[]
  now: Date
  noun?: string
}) {
  const ordered = [...transactions].sort(
    (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
  )
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const rows: LedgerRow[] = ordered.flatMap((tx): LedgerRow[] =>
    tx.direction === 'out'
      ? []
      : [
          { kind: 'topup', id: tx.id, tx },
          ...(open.has(tx.id)
            ? (tx.consumption ?? []).map((line): LedgerRow => ({
                kind: 'child',
                id: `${tx.id}:${line.id}`,
                tx,
                line,
              }))
            : []),
        ],
  )
  const topUps = ordered.filter((tx) => tx.direction !== 'out')
  const anyBreakdown = topUps.some(hasBreakdown)

  /** Children sort and search with their top-up, so they stay beneath it. */
  const sortKey = (pick: (tx: WalletTransaction) => number) => (row: LedgerRow) => pick(row.tx)

  return (
    <>
      <DetailTable<LedgerRow>
        compact
        label="Top-ups"
        noun={noun}
        rows={rows}
        empty="No top-ups yet."
        searchText={(row) =>
          row.kind === 'child'
            ? `${row.tx.reason} ${row.line.product} ${row.line.contract}`
            : `${row.tx.reason} ${topUpLine(row.tx)} ${row.tx.description} ${row.tx.reference?.id ?? ''}`
        }
        columns={[
          {
            key: 'topup',
            header: 'Top-up',
            width: 280,
            cell: (row) =>
              row.kind === 'child' ? (
                <div className="flex min-w-0 items-center gap-2 pl-8">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{row.line.product}</p>
                    {row.line.contract && !looksTechnical(row.line.contract) ? (
                      <p className="text-muted-foreground truncate text-xs">{row.line.contract}</p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="flex min-w-0 items-center gap-2">
                  {row.kind === 'topup' && hasBreakdown(row.tx) ? (
                    <button
                      type="button"
                      aria-expanded={open.has(row.tx.id)}
                      aria-label={`${open.has(row.tx.id) ? 'Collapse' : 'Expand'} ${row.tx.reason || 'top-up'}`}
                      onClick={() => toggle(row.tx.id)}
                      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex size-6 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-3"
                    >
                      {open.has(row.tx.id) ? (
                        <ChevronDownIcon className="size-4" aria-hidden="true" />
                      ) : (
                        <ChevronRightIcon className="size-4" aria-hidden="true" />
                      )}
                    </button>
                  ) : anyBreakdown ? (
                    <span className="size-6 shrink-0" aria-hidden="true" />
                  ) : null}
                  <div className="min-w-0">
                    <p className="truncate text-sm">{row.tx.reason || '—'}</p>
                    <p className="text-muted-foreground truncate text-xs">{topUpLine(row.tx)}</p>
                  </div>
                </div>
              ),
          },
          {
            key: 'credits',
            header: 'Credits',
            width: 130,
            sortBy: sortKey((tx) => Number(tx.credits)),
            cell: (row) =>
              row.kind === 'child' ? (
                <div>
                  <p className="text-destructive-foreground dark:text-destructive text-sm font-medium tabular-nums">
                    {'−'}
                    {formatCredits(row.line.credits)}
                  </p>
                  {row.line.amount ? (
                    <p className="text-muted-foreground text-xs tabular-nums">
                      {'−'}
                      {formatMoney(row.line.amount)}
                    </p>
                  ) : null}
                </div>
              ) : row.kind === 'debit' ? (
                <div>
                  <p className="text-sm font-medium tabular-nums">
                    {'−'}
                    {formatCredits(row.tx.credits)}
                  </p>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {formatMoney(row.tx.amount)}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-success-foreground dark:text-success text-sm font-medium tabular-nums">
                    +{formatCredits(row.tx.credits)}
                  </p>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {formatMoney(row.tx.amount)}
                  </p>
                </div>
              ),
          },
          {
            key: 'remaining',
            header: 'Remaining',
            width: 130,
            sortBy: sortKey((tx) => toNumber(tx.creditsAvailable) ?? -1),
            cell: (row) => {
              if (row.kind !== 'topup') return null
              const left = toNumber(row.tx.creditsAvailable)
              if (left === null) return <span className="text-muted-foreground text-sm">{'—'}</span>
              return (
                <div>
                  <p className="text-sm tabular-nums">{formatCredits(String(left))}</p>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {shareOf(row.tx.amount, left, Number(row.tx.credits))}
                  </p>
                </div>
              )
            },
          },
          {
            key: 'consumed',
            header: 'Consumed',
            width: 150,
            sortBy: sortKey((tx) => {
              const left = toNumber(tx.creditsAvailable)
              const total = Number(tx.credits)
              return left === null || total <= 0 ? -1 : (total - left) / total
            }),
            cell: (row) => {
              if (row.kind === 'child') {
                const total = Number(row.tx.credits)
                const used = Number(row.line.credits)
                return (
                  <ConsumedBar
                    share={total > 0 && Number.isFinite(used) ? used / total : null}
                    label="of the top-up"
                  />
                )
              }
              if (row.kind === 'debit') return null
              const left = toNumber(row.tx.creditsAvailable)
              const total = Number(row.tx.credits)
              const expired = row.tx.expiresAt !== null && daysUntil(row.tx.expiresAt, now) < 0
              return (
                <ConsumedBar
                  share={left === null || !(total > 0) ? null : (total - left) / total}
                  label="consumed"
                  expired={expired}
                />
              )
            },
          },
          {
            key: 'expires',
            header: 'Expires',
            width: 150,
            sortBy: sortKey((tx) => tx.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER),
            cell: (row) =>
              row.kind === 'topup' ? <Expires date={row.tx.expiresAt} now={now} /> : null,
          },
        ]}
      />
      {topUps.length === 0 ? null : (
        <p className="text-muted-foreground border-t px-6 py-3 text-xs">
          Usage draws on the top-up that expires soonest, among those it is allowed to use. Open a
          row to see every debit against it.
        </p>
      )}
    </>
  )
}
