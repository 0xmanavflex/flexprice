// A line item's dates are contract dates, read in UTC as the contract page
// reads them: a viewer west of UTC must not see an Oct 15 start as Oct 14.
const DAY = 86_400_000

const contractDay = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

/** When a price applied: "Oct 1 – Oct 14", "From Oct 15", or "Price" with no dates. */
export function priceSpan(from: Date | null, rawTo: Date | null): string {
  // A line item's end is exclusive: one ending at midnight last billed the
  // day before, so that is the day shown. A mid-day end shows its own day.
  const to = rawTo && rawTo.getTime() % DAY === 0 ? new Date(rawTo.getTime() - 1) : rawTo
  if (from && to) return `${contractDay.format(from)} – ${contractDay.format(to)}`
  if (from) return `From ${contractDay.format(from)}`
  if (to) return `Until ${contractDay.format(to)}`
  return 'Price'
}
