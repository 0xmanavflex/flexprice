import { moneyFormatLocale } from '@fp/domain'

const DAY = 86_400_000

export function formatDate(value: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(value)
}

/**
 * An invoice's issue or due day, named in UTC as the hosted invoice and the PDF
 * name it, so the portal never says a different day from the document.
 */
export function formatInvoiceDay(value: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(value)
}

export function formatDay(value: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(value)
}

export function formatRange(start: Date | null, end: Date | null, locale?: string): string {
  if (!start || !end) return '—'
  return `${formatDate(start, locale)} – ${formatDate(end, locale)}`
}

/**
 * A billing period as the days it covers: "Oct 1, 2026 – Oct 31, 2026". The
 * API's end is exclusive (Nov 1, 00:00), so the last day is the one before;
 * both are named in UTC, the zone the backend draws periods in, as V1 did.
 */
export function formatPeriod(start: Date, end: Date, locale?: string): string {
  const day = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const last = new Date(Math.max(start.getTime(), end.getTime() - 1000))
  return `${day.format(start)} – ${day.format(last)}`
}

/** "in 7 days", "today", "tomorrow", "3 days ago". */
export function relativeDays(value: Date, now: Date): string {
  const days = Math.round((startOfDay(value) - startOfDay(now)) / DAY)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  return days > 0 ? `in ${days} days` : `${-days} days ago`
}

function startOfDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
}

/** A decimal string grouped for reading: "18,640", "2,500.5". */
export function formatNumber(value: string, locale?: string): string {
  const [whole = '0', fraction] = value.replace('-', '').split('.')
  const grouped = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
    BigInt(whole || '0'),
  )
  const sign = value.startsWith('-') ? '−' : ''
  return fraction ? `${sign}${grouped}.${fraction.slice(0, 4)}` : `${sign}${grouped}`
}

/** Large counts, short: "842.1K", "1M". */
export function formatCompact(value: string | number, locale?: string): string {
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(
    Number(value),
  )
}

export function formatPercent(fraction: number, locale?: string): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(
    fraction,
  )
}

export function formatChartMoney(value: number, currency: string, locale?: string): string {
  void locale
  return new Intl.NumberFormat(moneyFormatLocale(currency), {
    style: 'currency',
    currency,
    maximumFractionDigits: value < 10 ? 2 : 0,
  }).format(value)
}

/**
 * A per-unit price, to as many places as it has (up to six): "$0.0002",
 * not "$0.00". Display only; the amount is the API's decimal string.
 */
export function formatUnitPrice(amount: string, currency: string, locale?: string): string {
  void locale
  const places = Math.min(6, Math.max(2, amount.split('.')[1]?.replace(/0+$/, '').length ?? 0))
  return new Intl.NumberFormat(moneyFormatLocale(currency), {
    style: 'currency',
    currency,
    minimumFractionDigits: places,
    maximumFractionDigits: places,
  }).format(Number(amount))
}
