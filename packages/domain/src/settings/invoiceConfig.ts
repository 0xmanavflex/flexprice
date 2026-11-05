/**
 * How invoices are numbered, and when they are due.
 *
 * `GET/PUT /settings/invoice_config`. One record per environment: the sandbox
 * and production number their invoices independently, which is the point:
 * a test invoice must never consume a production sequence number.
 *
 * The model is total. `PUT /settings/{key}` merges at the top level, so an
 * omitted field does keep its stored value, but nothing below the top level
 * is merged and the whole value round-trips through the backend's Go struct
 * on every write. Sending the record entire is the only version of this that
 * stays true as fields are added.
 */
import { z } from 'zod'

/**
 * The date segment of an invoice number.
 *
 * Exactly five, and the backend rejects anything else
 * (`internal/types/invoice.go`). Unlike most enums in this package these are
 * worth validating against, because a sixth value is not a deployment being
 * ahead of this console: it is a save the API will refuse.
 */
export const INVOICE_NUMBER_FORMATS = ['YYYYMM', 'YYYYMMDD', 'YYMMDD', 'YY', 'YYYY'] as const
export type InvoiceNumberFormat = (typeof INVOICE_NUMBER_FORMATS)[number]

export const INVOICE_NUMBER_FORMAT_LABEL: Record<InvoiceNumberFormat, string> = {
  YYYYMM: 'Year and month (202609)',
  YYYYMMDD: 'Full date (20260929)',
  YYMMDD: 'Short date (260929)',
  YY: 'Short year (26)',
  YYYY: 'Year (2026)',
}

export interface InvoiceConfig {
  /** Leading literal, e.g. `INV`. Required: the backend rejects an empty one. */
  prefix: string
  /** Between the parts, e.g. `-`. Empty is explicitly valid: `INV2026090001`. */
  separator: string
  /**
   * The date segment's format.
   *
   * Typed as a plain string rather than the union, so that a value a future
   * backend adds can still be read and rendered. Writes are validated against
   * `INVOICE_NUMBER_FORMATS` by `invoiceConfigSchema`, which is where the
   * closed set actually matters.
   */
  format: string
  /**
   * The zone the date segment is rendered in.
   *
   * Any IANA name (`Asia/Kolkata`), or one of the abbreviations the backend
   * resolves (`IST`, `PST`, `CET`, …). Free text, not a dropdown: V1 renders
   * it as an input for the same reason: there are ~600 valid answers.
   */
  timezone: string
  /** The first number the sequence issues. */
  startSequence: number
  /** How many digits the sequence is padded to. 1–10. */
  suffixLength: number
  /** Days from finalisation to the due date. */
  dueDateDays: number
  /**
   * How long a finalised invoice waits before it is sent. 0 means immediately.
   *
   * Two hours by default, which is a grace period and not a queue delay: it is
   * the window in which a mistake can still be corrected before a customer
   * sees the invoice.
   */
  finalizationDelaySeconds: number
  /**
   * Whether buying credits settles its own transaction without a review step.
   *
   * Absent from a default read: the backend omits it while false: so it
   * arrives here as `false` and is sent on every write. Modelled rather than
   * ignored because ignoring it is how a tenant that switched it on has it
   * switched off by an unrelated save.
   */
  autoCompletePurchasedCreditTransaction: boolean
}

/**
 * What an invoice number will look like, without asking the server.
 *
 * Preview text for the editor. It renders a given date in the configured
 * format, and it cannot know the next sequence number: `startSequence` is the
 * only one it can honestly show, so a caller should label it an example rather
 * than the next number.
 */
export function previewInvoiceNumber(config: InvoiceConfig, on: Date = new Date()): string {
  // IANA zones and the abbreviations accepted by the backend. Unknown zones
  // cannot produce an honest preview; keep the editor usable and say so.
  const aliases: Record<string, string> = {
    IST: 'Asia/Kolkata',
    EST: 'America/New_York',
    CST: 'America/Chicago',
    MST: 'America/Denver',
    PST: 'America/Los_Angeles',
    HST: 'Pacific/Honolulu',
    AKST: 'America/Anchorage',
    GMT: 'Europe/London',
    CET: 'Europe/Berlin',
    EET: 'Europe/Athens',
    WET: 'Europe/Lisbon',
    BST: 'Europe/London',
    JST: 'Asia/Tokyo',
    KST: 'Asia/Seoul',
    CCT: 'Asia/Shanghai',
    AEST: 'Australia/Sydney',
    AWST: 'Australia/Perth',
    MSK: 'Europe/Moscow',
    CAT: 'Africa/Harare',
    EAT: 'Africa/Nairobi',
    WAT: 'Africa/Lagos',
  }
  const zone = config.timezone.trim() || 'UTC'
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: aliases[zone.toUpperCase()] ?? zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      numberingSystem: 'latn',
    }).formatToParts(on)
  } catch {
    return 'Preview unavailable for this timezone'
  }
  const year = parts.find((part) => part.type === 'year')?.value ?? ''
  const month = parts.find((part) => part.type === 'month')?.value ?? ''
  const day = parts.find((part) => part.type === 'day')?.value ?? ''

  // Longest token first: replacing `YY` before `YYYY` would turn 2026 into 26026.
  const date = config.format
    .replace('YYYY', year)
    .replace('YY', year.slice(-2))
    .replace('MM', month)
    .replace('DD', day)

  const sequence = String(Math.max(config.startSequence, 0)).padStart(
    Math.min(Math.max(config.suffixLength, 1), 10),
    '0',
  )

  return [config.prefix, date, sequence].filter((part) => part.length > 0).join(config.separator)
}

/** The example number for one billing entity: the environment's scheme with the entity's own prefix. */
export function entityInvoicePreview(config: InvoiceConfig, prefix: string): string {
  return previewInvoiceNumber({ ...config, prefix })
}

/**
 * A delay in the largest unit that divides it evenly.
 *
 * 7200 seconds is "2 hours" to a person and a magic number to everyone else.
 * The editor shows a number and a unit; this is what picks the unit.
 */
export function splitDelay(seconds: number): {
  value: number
  unit: 'seconds' | 'minutes' | 'hours' | 'days'
} {
  const safe = Math.max(Math.trunc(seconds), 0)
  if (safe === 0) return { value: 0, unit: 'seconds' }
  if (safe % 86_400 === 0) return { value: safe / 86_400, unit: 'days' }
  if (safe % 3_600 === 0) return { value: safe / 3_600, unit: 'hours' }
  if (safe % 60 === 0) return { value: safe / 60, unit: 'minutes' }
  return { value: safe, unit: 'seconds' }
}

const wholeNumber = (label: string) =>
  z.number({ message: `Enter ${label}` }).int(`${label} must be a whole number`)

/**
 * The write contract, as the backend states it.
 *
 * The bounds are not house style: they are `internal/types/invoice.go`'s own
 * `validate` tags. Rejecting here means a form field goes red; letting it
 * through means a 400 whose message the user cannot map to a field.
 */
export const invoiceConfigSchema = z.object({
  prefix: z
    .string()
    .trim()
    .min(1, 'Enter a prefix')
    .max(10, 'Keep the prefix to 10 characters or fewer'),
  separator: z.string().max(3, 'Keep the separator to 3 characters or fewer'),
  format: z.enum(INVOICE_NUMBER_FORMATS, { message: 'Choose a date format' }),
  timezone: z.string().trim().min(1, 'Enter a timezone, for example UTC'),
  startSequence: wholeNumber('a start number').min(0, 'The start number cannot be negative'),
  suffixLength: wholeNumber('a sequence length')
    .min(1, 'Use at least one digit')
    .max(10, 'Use 10 digits or fewer'),
  dueDateDays: wholeNumber('a due-date offset')
    .min(0, 'Payment terms cannot be negative')
    .max(365, 'Use 365 days or fewer'),
  finalizationDelaySeconds: wholeNumber('a delay')
    .min(0, 'The delay cannot be negative')
    // A day. Longer is a stuck invoice, not a grace period.
    .max(86_400, 'Use 24 hours (86400 seconds) or less'),
  autoCompletePurchasedCreditTransaction: z.boolean(),
})

/**
 * The backend's own defaults, as a never-written key reads them.
 *
 * Here so an editor has something to render before the first fetch resolves,
 * and something to diff "changed?" against. It is **not** a substitute for a
 * read: the server is the authority on its defaults, which is why resetting
 * deletes the stored row and asks, rather than PUTting this object.
 */
export function defaultInvoiceConfig(): InvoiceConfig {
  return {
    prefix: 'INV',
    separator: '-',
    format: 'YYYYMM',
    timezone: 'UTC',
    startSequence: 1,
    suffixLength: 5,
    dueDateDays: 1,
    finalizationDelaySeconds: 7200,
    autoCompletePurchasedCreditTransaction: false,
  }
}
