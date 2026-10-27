// A line item's dates are contract dates, read in UTC as the contract page
// reads them: a viewer west of UTC must not see an Oct 15 start as Oct 14.
const contractDay = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

/** When a price applied: "Oct 1 – Oct 14", "From Oct 15", or "Price" with no dates. */
export function priceSpan(from: Date | null, to: Date | null): string {
  if (from && to) return `${contractDay.format(from)} – ${contractDay.format(to)}`
  if (from) return `From ${contractDay.format(from)}`
  if (to) return `Until ${contractDay.format(to)}`
  return 'Price'
}
