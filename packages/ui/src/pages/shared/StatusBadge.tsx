import type { CircleIcon } from '@ui/icons'
import { FEATURE_TYPE_LABEL, InvoiceStatus, needsAttention, type FeatureType } from '@fp/domain'
import { provenance } from '@ui/provenance'
import { FEATURE_TYPE_GLYPH, Pill, type PillTone } from './cells'
import { INVOICE_STATUS_TONE } from './statusTones'
import { statusTone } from './statusTones'

/**
 * A billing status: a bordered pill with a coloured dot.
 *
 * Colour is carried by the 6px dot rather than a fill. With five statuses down
 * eighteen dense rows, tinted fills turn the status column into a traffic
 * light: every row shouting at once, which is the same as none of them
 * shouting. A ring of neutral pills with one red dot in it reads instantly.
 *
 * The label is always spelled out beside the dot, so tone is never the only
 * thing saying what the status is, and only a status needing action gets the
 * destructive colour.
 */
export const StatusBadgeProvenance = provenance({
  source: 'composition',
  composes: [],
  note: 'Dot-pill status, colour on the dot: so a dense column is not a traffic light.',
})

/** The dot colour each status carries: the shared registry. */
const INVOICE_TONE = INVOICE_STATUS_TONE

const INVOICE_LABEL: Record<InvoiceStatus, string> = {
  [InvoiceStatus.Draft]: 'Draft',
  [InvoiceStatus.Open]: 'Open',
  [InvoiceStatus.Paid]: 'Paid',
  [InvoiceStatus.Overdue]: 'Overdue',
  [InvoiceStatus.Void]: 'Void',
  [InvoiceStatus.Skipped]: 'Skipped',
}

export interface InvoiceStatusBadgeProps {
  status: InvoiceStatus
}

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  return (
    <Pill tone={INVOICE_TONE[status]}>
      {INVOICE_LABEL[status]}
      {/* Colour alone cannot carry "this one needs you". */}
      {needsAttention(status) ? <span className="sr-only">: needs attention</span> : null}
    </Pill>
  )
}

/**
 * A catalogue label, drawn the same way a status is: a dot pill. One shape
 * shared by every catalogue chip so the table reads as one system rather than a
 * colour swatch per column.
 */
export interface GlyphBadgeProps {
  /** A lucide icon component. Kept for call-site compatibility; the dot carries the tone. */
  icon: typeof CircleIcon
  /** A `text-*` colour utility naming the tone, e.g. `text-success`. */
  tone: string
  label: string
}

/** The tone each `text-*` utility names. Literal keys, so Tailwind never has to guess. */
const TEXT_TONE: Record<string, PillTone> = {
  'text-success': 'success',
  'text-info': 'info',
  'text-trial': 'trial',
  'text-warning': 'warning',
  'text-destructive': 'danger',
  'text-muted-foreground': 'neutral',
}

/**
 * The one status chip shape: a bordered pill with a coloured dot.
 *
 * Exported so a table that needs a status the shared badges do not cover yet:
 * a subscription's lifecycle, a payment's state: composes the *same* chip from
 * its own tone/label map, rather than inventing a differently-shaped badge.
 * Every status across the console reads as one system this way.
 */
export function GlyphBadge({ tone, label }: GlyphBadgeProps) {
  return <Pill tone={TEXT_TONE[tone] ?? 'neutral'}>{label}</Pill>
}

/** The glyph each feature type carries: the agreed set, shared with every table. */
const FEATURE_TYPE_ICON: Record<FeatureType, typeof CircleIcon> = FEATURE_TYPE_GLYPH

export interface FeatureTypeBadgeProps {
  type: FeatureType
}

export function FeatureTypeBadge({ type }: FeatureTypeBadgeProps) {
  const Icon = FEATURE_TYPE_ICON[type]
  return <Pill icon={<Icon aria-hidden />}>{FEATURE_TYPE_LABEL[type]}</Pill>
}

/**
 * The shared catalogue status: published or archived, drawn like every status
 * here: a dot pill. Features, plans and add-ons all use it, so an Active
 * chip is the same object in every catalogue table.
 */
export type CatalogStatus = 'published' | 'archived'

const CATALOG_STATUS: Record<CatalogStatus, { tone: PillTone; label: string }> = {
  published: { tone: statusTone('published'), label: 'Active' },
  archived: { tone: statusTone('archived'), label: 'Archived' },
}

export interface CatalogStatusBadgeProps {
  status: CatalogStatus
}

export function CatalogStatusBadge({ status }: CatalogStatusBadgeProps) {
  const { tone, label } = CATALOG_STATUS[status]
  return <Pill tone={tone}>{label}</Pill>
}
