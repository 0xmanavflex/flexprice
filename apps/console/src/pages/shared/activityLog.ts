import {
  activityActor,
  activityByline,
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

const stamp = activityStamp

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

/** One rail row: title, local time, the type-specific sentence, and the person. */
export function toActivityLogEntry(entry: ActivityEntry): ActivityLogEntry {
  const facts = describeActivity(entry)
  // Who acted, then the channel: always both, so "By Workflow" is never
  // read as the actor when the system did it through the workflow.
  const who = activityByline(entry) ?? activityActor(entry)
  const source = activitySourceLabel(entry.source)
  const by = [who, source].filter(Boolean).join(' · ')
  const href = activityEntityHref(entry)
  return {
    id: entry.id,
    title: entry.title,
    at: entry.occurredAt ? stamp(entry.occurredAt) : '',
    ...(facts.record ? { record: facts.record } : {}),
    ...(facts.fields ? { fields: facts.fields } : {}),
    ...(by ? { by } : {}),
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
