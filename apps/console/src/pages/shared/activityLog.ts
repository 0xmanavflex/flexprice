import {
  activityByline,
  activitySourceLabel,
  describeActivity,
  type ActivityEntry,
} from '@fp/domain'
import type { ActivityLogEntry } from '@fp/ui/compositions'

const stamp = (date: Date) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)

const ENTITY_PATH: Record<string, string> = {
  customer: '/customers',
  subscription: '/contracts',
  invoice: '/invoices',
  payment: '/payments',
  credit_note: '/credit-memos',
  plan: '/plans',
  feature: '/features',
}

function entityHref(entry: ActivityEntry): string | undefined {
  const prefix = ENTITY_PATH[entry.entityType]
  if (!prefix || !entry.entityId) return undefined
  return `${prefix}/${encodeURIComponent(entry.entityId)}`
}

/** One rail row: title, local time, the type-specific sentence, and the person. */
export function toActivityLogEntry(entry: ActivityEntry): ActivityLogEntry {
  const facts = describeActivity(entry)
  const who = activityByline(entry)
  const source = activitySourceLabel(entry.source)
  const by = entry.actorType === 'user' || !who ? [who, source].filter(Boolean).join(' · ') : who
  const href = entityHref(entry)
  return {
    id: entry.id,
    title: entry.title,
    at: entry.occurredAt ? stamp(entry.occurredAt) : '',
    ...(facts.record ? { record: facts.record } : {}),
    ...(facts.summary ? { summary: facts.summary } : {}),
    ...(facts.detail ? { detail: facts.detail } : {}),
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
      ...(row.detail ? { detail: row.detail } : {}),
      ...(row.record ? { record: row.record } : {}),
      ...(row.by ? { by: row.by } : {}),
      ...(row.href ? { href: row.href } : {}),
    }
  })
}
