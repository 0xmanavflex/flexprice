export interface CsvColumn<T> {
  header: string
  value: (row: T) => string | number | null | undefined
}

const cell = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

// Stops spreadsheets running a cell as a formula.
const safe = (value: string) =>
  /^[=+\-@\t\r]/.test(value) && !Number.isFinite(Number(value)) ? `'${value}` : value

export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const lines = [
    columns.map((column) => cell(column.header)),
    ...rows.map((row) =>
      columns.map((column) => {
        const value = column.value(row)
        return cell(value === null || value === undefined ? '' : safe(String(value)))
      }),
    ),
  ]
  return lines.map((line) => line.join(',')).join('\r\n')
}

export function csvFilename(name: string, rangeLabel: string): string {
  const slug = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  return `${slug(name)}_${slug(rangeLabel)}.csv`
}

export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
