import {
  activityActor,
  activitySourceLabel,
  describeActivity,
  type ActivityEntry,
  type ActivityField,
} from '@fp/domain'
import type { ActivityLogEntry } from '@fp/ui/compositions'

/**
 * When an activity happened, in the viewer's zone with the zone named
 * ("Oct 23, 2026, 9:51 PM GMT+5:30"), so it is never mistaken for the
 * customer's own configured timezone. One format for the rail and the tab.
 */
export const activityStamp = (date: Date) =>
  `${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)} ${zoneName(date)}`

/** The same instant in UTC, for the event details. */
export const activityStampUtc = (date: Date) =>
  `${new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'UTC',
  }).format(date)} UTC`

function zoneName(date: Date): string {
  const part = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName')
  return part?.value ?? 'UTC'
}

const ENTITY_PATH: Record<string, string> = {
  customer: '/customers',
  subscription: '/contracts',
  invoice: '/invoices',
  payment: '/payments',
  credit_note: '/credit-memos',
  plan: '/plans',
  feature: '/features',
}

/** The page for the record an activity is about, when it has one. */
export function activityEntityHref(entry: ActivityEntry): string | undefined {
  const prefix = ENTITY_PATH[entry.entityType]
  if (!prefix || !entry.entityId) return undefined
  return `${prefix}/${encodeURIComponent(entry.entityId)}`
}

/**
 * The card's time: day and minute, at a glance ("24 Oct · 18:03"), with the
 * year only when it is not this one. The zone-named time is the hover title,
 * and the details drawer shows it in full.
 */
export function activityCompactStamp(date: Date, now: Date = new Date()): string {
  const sameYear = date.getFullYear() === now.getFullYear()
  // Three-letter months everywhere ("Sep", not en-GB's "Sept"), day first.
  const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date)
  const day = `${date.getDate()} ${month}${sameYear ? '' : ` ${date.getFullYear()}`}`
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
  return `${day} · ${time}`
}

/** The values the card's one summary line keeps: states, never amounts or ids. */
const SUMMARY_LABELS = new Set(['Tax treatment', 'Status'])

/**
 * "By …", subtle and short: a person with the channel ("Subrat · Dashboard"),
 * an API key with its kind ("billing prod · API key"), and the system by the
 * channel it came through ("Workflow").
 */
export function activityCardActor(entry: ActivityEntry): string {
  const source = activitySourceLabel(entry.source)
  switch (entry.actorType) {
    case 'system':
      return source || activityActor(entry)
    case 'api_key':
      return `${entry.actorLabel || 'Unnamed key'} · API key`
    case 'customer':
      return `${entry.actorLabel || 'Customer'} · Customer`
    default:
      return [activityActor(entry), source].filter(Boolean).join(' · ')
  }
}

/**
 * One card row: title, time, the affected record with a one-line state
 * summary ("INV-202610-00210 · Finalized", "Taxable · Published"), and who
 * did it. Everything else (fields, ids, request metadata) is in the drawer.
 */
export function toActivityLogEntry(entry: ActivityEntry): ActivityLogEntry {
  const facts = describeActivity(entry)
  const states = (facts.fields ?? []).filter((field) => SUMMARY_LABELS.has(field.label))
  const values = states.length > 0 ? states : (facts.fields ?? []).slice(0, 1)
  const summary = values.map((field) => field.value).join(' · ')
  const href = activityEntityHref(entry)
  return {
    id: entry.id,
    title: entry.title,
    at: entry.occurredAt ? activityCompactStamp(entry.occurredAt) : '',
    ...(entry.occurredAt ? { atTitle: activityStamp(entry.occurredAt) } : {}),
    ...(facts.record ? { record: facts.record } : {}),
    ...(summary ? { summary } : {}),
    by: activityCardActor(entry),
    ...(href ? { href } : {}),
  }
}

/** Contract and invoice documents still number their rows. */
export function railActivity(entries: ActivityEntry[]): Array<{
  id: number
  title: string
  at: string
  status: 'completed'
  summary: string
  fields?: readonly ActivityField[]
  detail?: string
  record?: string
  by?: string
  href?: string
}> {
  return entries.map((entry, index) => {
    const row = toActivityLogEntry(entry)
    return {
      id: index + 1,
      title: row.title,
      at: row.at,
      status: 'completed' as const,
      summary: row.summary ?? '',
      ...(row.fields ? { fields: row.fields } : {}),
      ...(row.detail ? { detail: row.detail } : {}),
      ...(row.record ? { record: row.record } : {}),
      ...(row.by ? { by: row.by } : {}),
      ...(row.href ? { href: row.href } : {}),
    }
  })
}
