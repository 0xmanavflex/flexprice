/** "14 Nov 2026" in the reader's locale. */
export function formatHostedDate(value: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(value)
}
