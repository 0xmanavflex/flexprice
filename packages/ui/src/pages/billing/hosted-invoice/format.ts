/**
 * "14 Nov 2026" in the reader's locale. Pass `timeZone: 'UTC'` for calendar dates
 * such as a due date, so the page shows the same day as the invoice PDF.
 */
export function formatHostedDate(value: Date, locale?: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(timeZone ? { timeZone } : {}),
  }).format(value)
}
