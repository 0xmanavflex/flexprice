import { type InvoiceDetail, InvoiceLinePriceType } from '@fp/domain'

type Line = InvoiceDetail['lines'][number]

interface CsvColumn {
  header: string
  value: (line: Line) => string
}

const cell = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

// Stops a spreadsheet running a typed line name as a formula, including one
// behind leading spaces, which spreadsheets skip, and the full-width signs
// (＝ ＋ － ＠) some of them also read as formulas. A plain number is left as is.
const safe = (value: string) =>
  /^[\s]*[=+\-@\uFF1D\uFF0B\uFF0D\uFF20]|^[\t\r]/.test(value) && !Number.isFinite(Number(value))
    ? `'${value}`
    : value

const day = (date: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(date)

/**
 * An invoice's charged lines as CSV, V1's "Download CSV": the lines with an
 * amount above zero, and for a contract invoice their price type and billing
 * period too. Amounts are the API's own strings, unrounded.
 */
export function invoiceLinesCsv(invoice: InvoiceDetail): string {
  const lines = invoice.lines.filter((line) => Number(line.amount) > 0)
  const currency = invoice.currency.toUpperCase()
  const contract = invoice.subscriptionId !== null
  const columns: CsvColumn[] = [
    { header: 'Display name', value: (line) => line.description },
    ...(contract
      ? [
          {
            header: 'Price type',
            value: (line: Line) =>
              line.priceType === InvoiceLinePriceType.Usage
                ? 'Usage'
                : line.priceType === InvoiceLinePriceType.Fixed
                  ? 'Fixed'
                  : '',
          },
          {
            header: 'Billing period',
            value: (line: Line) =>
              line.periodStart && line.periodEnd
                ? `${day(line.periodStart)} – ${day(line.periodEnd)}`
                : '',
          },
        ]
      : []),
    { header: 'Quantity', value: (line) => line.quantity },
    { header: 'Amount', value: (line) => line.amount },
    { header: 'Currency', value: () => currency },
  ]
  return [
    columns.map((column) => cell(column.header)).join(','),
    ...lines.map((line) => columns.map((column) => cell(safe(column.value(line)))).join(',')),
  ].join('\r\n')
}

/** Saves the CSV as `invoice-<number>.csv`. */
export function downloadInvoiceCsv(invoice: InvoiceDetail): void {
  const name = (invoice.number || invoice.id).replace(/[^a-zA-Z0-9._-]+/g, '_')
  // A byte-order mark, so a spreadsheet reads the dash and accents as UTF-8.
  const url = URL.createObjectURL(
    new Blob(['\uFEFF', invoiceLinesCsv(invoice)], { type: 'text/csv;charset=utf-8' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = `invoice-${name}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
