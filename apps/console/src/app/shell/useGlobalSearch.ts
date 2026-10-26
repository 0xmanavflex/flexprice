import { useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_CUSTOMER_QUERY,
  DEFAULT_FEATURE_QUERY,
  DEFAULT_INVOICE_QUERY,
  DEFAULT_PLAN_QUERY,
} from '@fp/domain'
import { useCustomers, useFeatures, useInvoices, usePlans } from '@fp/query'
import type { ShellSearchItem } from '@fp/ui/compositions'
import { CREATE_ACTIONS } from './createActions'
import { getSupportChatCommandLabel, isSupportChatAvailable } from '@/app/supportChat/config'
import { FOOTER_NAV, hrefForNavId, NAV, SECONDARY } from './navigation'

const MIN_TERM = 2
const PAGE_SIZE = 5

/** Pages and create actions: always available, filtered by the palette. */
export function searchableDestinations(): { items: ShellSearchItem[]; paths: Map<string, string> } {
  const items: ShellSearchItem[] = []
  const paths = new Map<string, string>()

  for (const entry of [...NAV, ...FOOTER_NAV, ...SECONDARY]) {
    const rows = entry.path || entry.external ? [entry] : []
    for (const row of [...rows, ...(entry.children ?? [])]) {
      const href = hrefForNavId(row.id)
      if (!href) continue
      const id = `page:${row.id}`
      items.push({
        id,
        label: row.label,
        group: 'Pages',
        ...(entry.children ? { hint: entry.label } : {}),
      })
      paths.set(id, href)
    }
  }

  for (const action of CREATE_ACTIONS) {
    const id = `action:${action.id}`
    items.push({ id, label: action.label, group: 'Actions' })
    paths.set(id, action.path)
  }

  // "Open Pylon" / "Open Intercom", only when a provider is configured: as V1's palette.
  if (isSupportChatAvailable()) {
    items.push({
      id: SUPPORT_CHAT_ACTION_ID,
      label: getSupportChatCommandLabel(),
      group: 'Actions',
    })
  }

  return { items, paths }
}

/** The palette item that opens the support chat rather than navigating. */
export const SUPPORT_CHAT_ACTION_ID = 'action:open-support-chat'

/**
 * Records matching `rawTerm`, fetched only once the dialog has a term worth
 * sending: the four list endpoints each take a `search`, so this is four small
 * reads rather than a dedicated search service.
 *
 * Responses cannot arrive out of order: each query is keyed by the settled
 * (debounced) term, so a slow reply for "ac" is cached under "ac" and never
 * rendered over "acm". The term itself is local state, so typing is not
 * throttled and only the network is.
 */
export function useGlobalSearch(rawTerm: string) {
  const [term, setTerm] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(rawTerm.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [rawTerm])

  const enabled = term.length >= MIN_TERM
  const base = { page: 1, pageSize: PAGE_SIZE, search: term }

  const customers = useCustomers({ ...DEFAULT_CUSTOMER_QUERY, ...base, filters: [] }, { enabled })
  const plans = usePlans({ ...DEFAULT_PLAN_QUERY, ...base }, { enabled })
  const features = useFeatures({ ...DEFAULT_FEATURE_QUERY, ...base, filters: [] }, { enabled })
  const invoices = useInvoices({ ...DEFAULT_INVOICE_QUERY, ...base }, { enabled })

  const { results, paths } = useMemo(() => {
    const results: ShellSearchItem[] = []
    const paths = new Map<string, string>()
    if (!enabled) return { results, paths }

    const add = (item: ShellSearchItem, path: string) => {
      results.push(item)
      paths.set(item.id, path)
    }

    for (const c of customers.data?.customers ?? []) {
      add(
        {
          id: `customer:${c.id}`,
          group: 'Customers',
          label: c.name,
          hint: c.email || c.externalId,
        },
        `/customers/${c.id}`,
      )
    }
    for (const p of plans.data?.plans ?? []) {
      add(
        { id: `plan:${p.id}`, group: 'Plans', label: p.name, hint: p.lookupKey },
        `/plans/${p.id}`,
      )
    }
    for (const f of features.data?.features ?? []) {
      add({ id: `feature:${f.id}`, group: 'Features', label: f.name }, `/features/${f.id}`)
    }
    for (const i of invoices.data?.invoices ?? []) {
      add(
        { id: `invoice:${i.id}`, group: 'Invoices', label: i.number, hint: i.customerName },
        `/invoices/${i.id}`,
      )
    }
    return { results, paths }
  }, [enabled, customers.data, plans.data, features.data, invoices.data])

  const failed = enabled
    ? [customers, plans, features, invoices].filter((query) => query.isError)
    : []
  const hasError = failed.length > 0
  const retry = () => {
    for (const query of failed) void query.refetch()
  }

  const isSearching =
    rawTerm.trim() !== term ||
    (enabled &&
      (customers.isFetching || plans.isFetching || features.isFetching || invoices.isFetching))

  return { results, paths, isSearching, hasError, retry }
}
