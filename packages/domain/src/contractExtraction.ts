/**
 * Contract upload: a signed agreement goes in as a file, Flexprice AI reads it
 * in the background, and the terms it found come back on the contract for
 * the user to confirm.
 *
 * The backend runs the extraction as a job (`extraction_status`
 * `pending` → `processing` → `completed` | `failed`); the console polls the
 * contract until it settles.
 */

/** What the backend accepts, checked again server-side from the file's bytes. */
export const CONTRACT_UPLOAD_ACCEPT = '.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg'
export const CONTRACT_UPLOAD_MAX_BYTES = 20 * 1024 * 1024
export const CONTRACT_UPLOAD_LIMITS_LABEL = 'PDF, PNG or JPG · up to 20 MB'

export const CONTRACT_EXTRACTION_STATUS = {
  Pending: 'pending',
  Processing: 'processing',
  Completed: 'completed',
  Failed: 'failed',
} as const
export type ContractExtractionStatus =
  (typeof CONTRACT_EXTRACTION_STATUS)[keyof typeof CONTRACT_EXTRACTION_STATUS]

const EXTRACTION_STATUSES = new Set<string>(Object.values(CONTRACT_EXTRACTION_STATUS))

/** An unknown or missing status reads as queued: still waiting, never falsely done. */
export function toContractExtractionStatus(value: unknown): ContractExtractionStatus {
  return typeof value === 'string' && EXTRACTION_STATUSES.has(value)
    ? (value as ContractExtractionStatus)
    : CONTRACT_EXTRACTION_STATUS.Pending
}

/** Still being read: the page keeps polling while this is true. */
export function isContractExtractionActive(status: ContractExtractionStatus): boolean {
  return (
    status === CONTRACT_EXTRACTION_STATUS.Pending ||
    status === CONTRACT_EXTRACTION_STATUS.Processing
  )
}

/** The kinds of document one uploaded file can hold. */
export const CONTRACT_DOCUMENT_TYPE_LABEL = {
  msa: 'Master services agreement',
  order_form: 'Order form',
  purchase_order: 'Purchase order',
  amendment: 'Amendment',
  statement_of_work: 'Statement of work',
  renewal: 'Renewal',
  other: 'Other',
} as const satisfies Record<string, string>
export type ContractDocumentType = keyof typeof CONTRACT_DOCUMENT_TYPE_LABEL

export function toContractDocumentType(value: unknown): ContractDocumentType {
  return typeof value === 'string' && value in CONTRACT_DOCUMENT_TYPE_LABEL
    ? (value as ContractDocumentType)
    : 'other'
}

export const CONTRACT_TYPE_LABEL = {
  new: 'New contract',
  amendment: 'Amendment',
  renewal: 'Renewal',
} as const satisfies Record<string, string>
export type ContractType = keyof typeof CONTRACT_TYPE_LABEL

export const CONTRACT_TYPE_DESCRIPTION: Record<ContractType, string> = {
  new: 'A fresh agreement with this customer',
  amendment: 'Changes an existing contract',
  renewal: 'Extends an existing contract',
}

export function toContractType(value: unknown): ContractType | null {
  return typeof value === 'string' && value in CONTRACT_TYPE_LABEL ? (value as ContractType) : null
}

/** Where on a page a term was read from, in fractions of the page. */
export interface ContractTermBox {
  page: number
  left: number
  top: number
  width: number
  height: number
}

/**
 * One value Flexprice AI read, with the evidence for it.
 *
 * Every extracted field has this shape, so the later steps can show the words
 * a value came from and flag the ones the model was unsure of.
 */
export interface ContractTerm<T = string> {
  value: T | null
  /** 0–100. */
  confidence: number | null
  page: number | null
  quote: string
  options: string[]
  note: string
  boxes: ContractTermBox[]
  /** Worked out from other terms (an end date from a start and a length), not read from the page. */
  derived: boolean
}

/** One document inside the uploaded file, by page range. */
export interface ContractDocumentPart {
  type: ContractDocumentType
  title: string
  pageStart: number | null
  pageEnd: number | null
}

export interface ContractToCheck {
  total: number
  customer: number
  charges: number
  billing: number
}

/** What a completed extraction found. */
export interface ContractExtraction {
  pages: number | null
  fields: number | null
  documents: ContractDocumentPart[]
  contractType: ContractTerm<ContractType> | null
  toCheck: ContractToCheck
  /** Every term read, in the backend's order, by path. */
  terms: ContractExtractedTerm[]
  /** The model's own remarks. Free text with no place on the page. */
  doubts: string[]
}

export interface ContractDocumentFile {
  fileName: string
  mediaType: string
  sizeBytes: number | null
}

/** A contract created from an upload, as step 1 of the upload flow reads it. */
export interface UploadedContract {
  id: string
  contractStatus: string
  document: ContractDocumentFile | null
  extractionStatus: ContractExtractionStatus
  /** Why extraction failed, in words the backend chose for a person. */
  extractionError: string
  extraction: ContractExtraction | null
}

/** "Pages 1–10", "Page 13", or "" when the range is unknown. */
export function contractPageRangeLabel(start: number | null, end: number | null): string {
  if (start === null) return ''
  if (end === null || end === start) return `Page ${start}`
  return `Pages ${start}–${end}`
}

/* ------------------------------------------------------------------------ */
/* Terms, and which ones need a person to check them                        */
/* ------------------------------------------------------------------------ */

/**
 * The terms an extraction holds, by group, in the order the backend walks them
 * (`eachTerm` in flexprice `internal/ee/service/contract/extraction_review.go`).
 * A path is the term's JSON path there: `customer.legal_name`,
 * `charges[2].amount`. Keep this in step with that function.
 */
export const CONTRACT_TERM_FIELDS = {
  single: ['contract_type'],
  groups: {
    customer: ['legal_name', 'billing_address', 'primary_contact', 'billing_email'],
    term: [
      'signed_date',
      'effective_date',
      'term_months',
      'auto_renew',
      'renewal_term_months',
      'notice_days',
      'renewal_price_change',
      'cancellation',
    ],
    billing: ['structure', 'currency', 'invoice_day', 'payment_terms', 'late_fee', 'tax'],
  },
  lists: {
    charges: [
      'name',
      'amount',
      'amount_period',
      'billing_period',
      'billing_timing',
      'included_quantity',
      'unit',
      'tier_mode',
      'trigger',
      'revenue_recognition',
    ],
    commitments: ['amount', 'period', 'covers', 'shortfall'],
    credits: ['amount', 'kind', 'expiry'],
    service_levels: ['description'],
  },
} as const

/** One term, with where it sits in the result. */
export interface ContractExtractedTerm {
  path: string
  term: ContractTerm<string>
}

/**
 * Below this confidence a term needs checking. Keep equal to
 * `DefaultReviewThreshold` in flexprice `internal/ee/service/contract/extraction_enrich.go`.
 */
export const CONTRACT_REVIEW_THRESHOLD = 90

/**
 * Whether a person should check this term: the model offered alternatives, or
 * read a value it was not sure of. Mirrors the backend's `needsCheck`, so the
 * terms flagged here add up to its `to_check`. Nothing else compares confidence.
 */
export function contractTermNeedsReview(term: ContractTerm<unknown>): boolean {
  if (term.derived || term.page === null) return false
  return (
    term.options.length > 0 ||
    (term.value !== null && (term.confidence ?? 0) < CONTRACT_REVIEW_THRESHOLD)
  )
}

/** The upload steps a term is confirmed on. */
export type ContractReviewStep = 'customer' | 'charges' | 'billing'

/** Which step confirms a term. Mirrors the backend's `stepFor`; null for terms no step counts. */
export function contractTermStep(path: string): ContractReviewStep | null {
  if (path.startsWith('customer.')) return 'customer'
  if (
    path.startsWith('term.') ||
    path.startsWith('billing.') ||
    path.endsWith('.billing_period') ||
    path.endsWith('.billing_timing')
  ) {
    return 'billing'
  }
  if (/^(charges|commitments|credits|service_levels)\[/.test(path)) return 'charges'
  return null
}

/** How many terms need checking, counted the way the backend counts `to_check.total`. */
export function countContractTermsToCheck(terms: readonly ContractExtractedTerm[]): number {
  return terms.filter((t) => contractTermStep(t.path) && contractTermNeedsReview(t.term)).length
}

const TERM_LABEL: Record<string, string> = {
  contract_type: 'Contract type',
  'customer.legal_name': 'Legal name',
  'customer.billing_address': 'Billing address',
  'customer.primary_contact': 'Primary contact',
  'customer.billing_email': 'Billing email',
  'term.signed_date': 'Signed date',
  'term.effective_date': 'Effective date',
  'term.term_months': 'Term length',
  'term.auto_renew': 'Auto-renews',
  'term.renewal_term_months': 'Renewal term',
  'term.notice_days': 'Notice period',
  'term.renewal_price_change': 'Renewal price change',
  'term.cancellation': 'Cancellation',
  'billing.structure': 'Billing structure',
  'billing.currency': 'Currency',
  'billing.invoice_day': 'Invoice day',
  'billing.payment_terms': 'Payment terms',
  'billing.late_fee': 'Late fee',
  'billing.tax': 'Tax',
}

const LIST_LABEL: Record<string, string> = {
  charges: 'Charge',
  commitments: 'Commitment',
  credits: 'Credit',
  service_levels: 'Service level',
}

const ITEM_FIELD_LABEL: Record<string, string> = {
  name: 'Name',
  amount: 'Amount',
  amount_period: 'Amount period',
  billing_period: 'Billing period',
  billing_timing: 'Billing timing',
  included_quantity: 'Included quantity',
  unit: 'Unit',
  tier_mode: 'Tier mode',
  trigger: 'Trigger',
  revenue_recognition: 'Revenue recognition',
  period: 'Period',
  covers: 'Covers',
  shortfall: 'Shortfall',
  kind: 'Kind',
  expiry: 'Expiry',
}

/** A term's name for people: "Legal name", "Charge 3 · Amount", "Service level 2". */
export function contractTermLabel(path: string): string {
  const fixed = TERM_LABEL[path]
  if (fixed) return fixed
  const item = /^([a-z_]+)\[(\d+)\]\.([a-z_]+)$/.exec(path)
  if (item) {
    const [, list = '', index = '0', field = ''] = item
    const name = `${LIST_LABEL[list] ?? list} ${Number(index) + 1}`
    return list === 'service_levels' ? name : `${name} · ${ITEM_FIELD_LABEL[field] ?? field}`
  }
  return path
}

/** Confident terms are marked green; terms to check, yellow. */
export type ContractHighlightTone = 'confident' | 'doubt'

/** Where a term was read from, ready to draw on the document. */
export interface ContractHighlight {
  /** The term's path. */
  id: string
  label: string
  value: string
  tone: ContractHighlightTone
  boxes: ContractTermBox[]
}

/**
 * The highlights for a document: one per term that says where it was read
 * from, in reading order (by the page and height of its first box). Terms
 * without boxes, and derived ones, are not drawn.
 */
export function collectContractHighlights(
  terms: readonly ContractExtractedTerm[],
): ContractHighlight[] {
  return terms
    .filter(({ term }) => term.boxes.length > 0 && !term.derived)
    .map(({ path, term }) => ({
      id: path,
      label: contractTermLabel(path),
      value: term.value ?? '',
      tone: contractTermNeedsReview(term) ? ('doubt' as const) : ('confident' as const),
      boxes: term.boxes,
    }))
    .sort((a, b) => readingOrder(a.boxes[0]) - readingOrder(b.boxes[0]))
}

const readingOrder = (box: ContractTermBox | undefined) => (box ? box.page + box.top : 0)
