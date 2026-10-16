import { request } from './settings'

/**
 * `POST /dashboard/revenue-dashboard` — invoiced revenue for a window, per
 * currency and per customer. Live, but absent from the OpenAPI document and so
 * from the SDK (the dashboard handlers carry no swagger annotations), which is
 * why this speaks `fetch` the way `settings.ts` does.
 *
 * Every amount is the server's decimal string. It sums invoice line items whose
 * service period falls in the window, split by price type (usage vs fixed), so
 * it is billed revenue rather than an estimate from usage events.
 */
export interface RevenueDashboardWire {
  summaries?: Record<
    string,
    {
      total_revenue?: string
      total_usage_revenue?: string
      total_fixed_revenue?: string
    }
  > | null
  items?: Array<{
    customer_id?: string
    customer_name?: string
    external_customer_id?: string
    currency?: string
    total_revenue?: string
    total_usage_revenue?: string
    total_fixed_revenue?: string
  }> | null
}

export async function fetchRevenueDashboard(
  serverURL: string,
  token: string,
  environmentId: string,
  window: { start: Date; end: Date },
): Promise<RevenueDashboardWire> {
  const body = await request(serverURL, '/dashboard/revenue-dashboard', {
    method: 'POST',
    token,
    environmentId,
    body: { period_start: window.start.toISOString(), period_end: window.end.toISOString() },
  })
  return (body ?? {}) as RevenueDashboardWire
}
