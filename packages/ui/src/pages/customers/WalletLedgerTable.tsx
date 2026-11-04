import { type WalletTransaction, formatMoney, money } from '@fp/domain'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { DetailTable } from '../shared/DetailTable'

export const WalletLedgerTableProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/DetailTable'],
  note: 'DetailTable over a wallet’s transactions: top-ups and debits as signed credits, remaining, consumed bar and expiry on top-ups.',
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
function detailLine(tx: WalletTransaction): string {
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

/**
 * Credits of each top-up that lapsed rather than were used, by top-up id.
 *
 * An expiry is its own debit (`CREDIT_EXPIRED`). It names the top-up it
 * lapsed from in its breakdown, or failing that in its reference; without
 * this, a top-up whose last credits expired reads as fully consumed.
 */
export function expiredByTopUp(transactions: readonly WalletTransaction[]): Map<string, number> {
  const topUps = new Set(transactions.filter((tx) => tx.direction === 'in').map((tx) => tx.id))
  const out = new Map<string, number>()
  const add = (id: string, credits: string) => {
    const value = toNumber(credits)
    if (value !== null && value > 0) out.set(id, (out.get(id) ?? 0) + value)
  }
  for (const tx of transactions) {
    if (!tx.expiry) continue
    if (tx.drawnFrom?.length) {
      for (const line of tx.drawnFrom) add(line.topUpId, line.credits)
    } else if (tx.reference && topUps.has(tx.reference.id)) {
      add(tx.reference.id, tx.credits)
    }
  }
  return out
}

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
  const tone = expired ? 'bg-destructive' : hot ? 'bg-warning' : 'bg-muted-foreground'
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
 * The wallet's one ledger, newest first: top-ups and debits side by side. A
 * top-up carries remaining, consumed and expiry.
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
  // One row per transaction. A debit does not open to the top-ups it drew
  // from: that breakdown is off for now.
  const rows: LedgerRow[] = ordered.map((tx): LedgerRow => ({
    kind: tx.direction === 'out' ? 'debit' : 'topup',
    id: tx.id,
    tx,
  }))
  const expiredOf = expiredByTopUp(ordered)
  /** The share of a top-up drawn down by usage: neither left nor lapsed. */
  const consumedShare = (tx: WalletTransaction) => {
    const left = toNumber(tx.creditsAvailable)
    const total = Number(tx.credits)
    if (left === null || !(total > 0)) return null
    return Math.max(0, total - left - (expiredOf.get(tx.id) ?? 0)) / total
  }

  const sortKey = (pick: (tx: WalletTransaction) => number) => (row: LedgerRow) => pick(row.tx)

  return (
    <>
      <DetailTable<LedgerRow>
        compact
        label="Transactions"
        noun={noun}
        rows={rows}
        empty="No transactions yet."
        searchText={(row) =>
          `${row.tx.reason} ${detailLine(row.tx)} ${row.tx.description} ${row.tx.reference?.id ?? ''}`
        }
        columns={[
          {
            key: 'transaction',
            header: 'Transaction',
            width: 280,
            cell: (row) => (
              <div className="min-w-0">
                <p className="truncate text-sm">{row.tx.reason || '—'}</p>
                <p className="text-muted-foreground truncate text-xs">{detailLine(row.tx)}</p>
              </div>
            ),
          },
          {
            key: 'credits',
            header: 'Credits',
            width: 130,
            sortBy: sortKey((tx) => Number(tx.credits)),
            cell: (row) =>
              row.kind === 'debit' ? (
                <div>
                  <p className="text-destructive-foreground dark:text-destructive text-sm font-medium tabular-nums">
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
            sortBy: sortKey((tx) => consumedShare(tx) ?? -1),
            cell: (row) => {
              if (row.kind === 'debit') return null
              const expired = row.tx.expiresAt !== null && daysUntil(row.tx.expiresAt, now) < 0
              const lapsed = expiredOf.get(row.tx.id) ?? 0
              return (
                <div>
                  <ConsumedBar share={consumedShare(row.tx)} label="consumed" expired={expired} />
                  {lapsed > 0 ? (
                    <p className="text-destructive-foreground dark:text-destructive text-xs tabular-nums">
                      {formatCredits(String(lapsed))} expired
                    </p>
                  ) : null}
                </div>
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
      {ordered.length === 0 ? null : (
        <p className="text-muted-foreground border-t px-6 py-3 text-xs">
          Usage draws on the top-up that expires soonest, among those it is allowed to use.
        </p>
      )}
    </>
  )
}
