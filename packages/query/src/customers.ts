import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type AuthSource,
  type Flexprice,
  call,
  clearPreferredConnection,
  createCustomer,
  getCustomer,
  searchCustomers,
  setPreferredConnection,
} from '@fp/api'
import {
  BILLING_ENTITY_FILTER,
  CUSTOMER_FILTERS,
  type CreateCustomer,
  type Customer,
  type CustomerIntegration,
  type EditCustomer,
  type IntegrationLink,
  type CustomerDetail,
  type CustomerQuery,
  CustomerSortField,
  type ListFilterSpec,
  CustomerStatus,
  CustomerTaxTreatment,
  DEFAULT_INVOICE_QUERY,
  INTEGRATION_CATALOG,
  type Subscription,
  type TenantFeatureUsage,
} from '@fp/domain'
import { LIVE_SUBSCRIPTION_STATUSES } from './subscriptionStatuses'
import { queryKeys } from './keys'
import {
  nameContainsFilter,
  statusFilterField,
  toFilterConditions,
  toMetadataFilter,
  toTopLevelChoice,
} from './search'
import { useFlexprice, useFlexpriceAuth, useFlexpriceServerURL } from './provider'
import { credentials, fromWire, toWireBody } from './wire'
import { type SubscriptionWire, toSubscription } from './subscriptions'
import { type InvoicePage, fetchInvoices } from './invoices'
import { type FeatureUsageWire, toFeatureUsage } from './tenant'
import { sortWithTieBreak } from './listSort'

/**
 * Customers: the translation between billing vocabulary and the API.
 *
 * Reached through `POST /customers/search`, the same search shape the
 * catalogue lists use. The wire's status knows a
 * soft-deleted state the list has no column for, so it collapses to the two a
 * billing list shows, with anything unrecognised falling to published rather
 * than vanishing from the list.
 */

/** One row of the customer's `integrations` array, camelCased by `fromWire`. */
export interface CustomerIntegrationWire {
  providerType?: string | undefined
  providerEntityId?: string | undefined
  status?: string | undefined
}

/** The wire shape this reads, camelCased by `fromWire`. */
export interface CustomerWire {
  id?: string | undefined
  billingEntityId?: string | undefined
  preferredConnectionId?: string | null | undefined
  name?: string | undefined
  email?: string | undefined
  externalId?: string | undefined
  addressCountry?: string | undefined
  billingCurrency?: string | undefined
  timezone?: string | undefined
  status?: string | undefined
  integrations?: CustomerIntegrationWire[] | undefined
  createdAt?: Date | undefined
  updatedAt?: Date | undefined
}

/** Published mappings only, one mark per provider. */
export function toCustomerIntegrations(
  wires: CustomerIntegrationWire[] | undefined,
): CustomerIntegration[] {
  const seen = new Set<string>()
  const integrations: CustomerIntegration[] = []
  for (const wire of wires ?? []) {
    const providerType = wire.providerType?.trim()
    if (!providerType || seen.has(providerType)) continue
    if (wire.status && wire.status !== 'published') continue
    seen.add(providerType)
    const spec = INTEGRATION_CATALOG.find((entry) => entry.providerType === providerType)
    integrations.push({
      id: spec?.id ?? providerType,
      name: spec?.name ?? providerType,
      providerType,
      ...(wire.providerEntityId?.trim() ? { providerEntityId: wire.providerEntityId.trim() } : {}),
    })
  }
  return integrations
}

const CUSTOMER_STATUSES = new Set<string>(Object.values(CustomerStatus))

export function toCustomer(wire: CustomerWire): Customer {
  const status = CUSTOMER_STATUSES.has(wire.status ?? '')
    ? (wire.status as CustomerStatus)
    : CustomerStatus.Published

  return {
    id: wire.id ?? '',
    name: wire.name ?? 'Unnamed customer',
    email: wire.email ?? '',
    externalId: wire.externalId ?? '',
    addressCountry: wire.addressCountry ?? '',
    ...(wire.billingCurrency ? { billingCurrency: wire.billingCurrency.toLowerCase() } : {}),
    ...(wire.timezone ? { timezone: wire.timezone } : {}),
    status,
    ...(wire.billingEntityId ? { billingEntityId: wire.billingEntityId } : {}),
    ...(wire.preferredConnectionId ? { preferredConnectionId: wire.preferredConnectionId } : {}),
    integrations: toCustomerIntegrations(wire.integrations),
    createdAt: wire.createdAt ?? null,
    updatedAt: wire.updatedAt ?? null,
  }
}

const SORT_FIELD: Record<CustomerSortField, string> = {
  [CustomerSortField.Name]: 'name',
  [CustomerSortField.CreatedAt]: 'created_at',
  [CustomerSortField.UpdatedAt]: 'updated_at',
}

/** `specs` are the filters the list offers: the entity filter is among them only while entities are enabled. */
export function toCustomerFilter(
  query: CustomerQuery,
  specs: readonly ListFilterSpec[] = CUSTOMER_FILTERS,
): Record<string, unknown> {
  const conditions = toFilterConditions(query.filters ?? [], specs)
  const metadata = toMetadataFilter(query.filters ?? [], specs)
  const billingEntityId = toTopLevelChoice(query.filters ?? [], specs, BILLING_ENTITY_FILTER.field)
  return {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    sort: sortWithTieBreak(SORT_FIELD[query.sortBy], query.sortDirection),
    // The integration marks in the list: one batched lookup on the server
    // instead of a mappings request per row.
    expand: 'integrations',
    ...statusFilterField(query.statuses, Object.values(CustomerStatus)),
    ...(query.search.trim() || conditions.length > 0
      ? {
          filters: [
            ...(query.search.trim() ? nameContainsFilter(query.search.trim()) : []),
            ...conditions,
          ],
        }
      : {}),
    // Metadata pairs are the search's own map, every pair matching.
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    ...(billingEntityId ? { billingEntityId } : {}),
  }
}

export interface CustomerPage {
  customers: Customer[]
  total: number
}

export async function fetchCustomers(
  serverURL: string,
  auth: AuthSource,
  query: CustomerQuery,
  signal?: AbortSignal,
  specs?: readonly ListFilterSpec[],
): Promise<CustomerPage> {
  const { token, environmentId } = await credentials(auth, 'Sign in to view customers.')
  const response = fromWire<{
    items?: CustomerWire[] | null
    pagination?: { total?: number }
  }>(
    await searchCustomers(
      serverURL,
      token,
      environmentId,
      toWireBody(toCustomerFilter(query, specs)),
      signal,
    ),
  )
  const customers = (response?.items ?? []).map(toCustomer)

  /*
   * No narrowing happens here any more, and that is the fix.
   *
   * Search and status used to be applied to the fetched page: the request asked
   * for 25 rows, the browser dropped the ones that did not match, and `total`
   * still reported the server's unfiltered count. Searching "acme" found an
   * Acme on page 1 and missed the one on page 3, the pager promised pages that
   * came back empty, and page 2 of a search was not the second page of matches
   * but the matches inside the second page of everything.
   *
   * Both are server-side now (see `toCustomerFilter`), so `pagination.total` is
   * the count of rows that actually match and every page is full.
   *
   * One deliberate narrowing of behaviour: search matches the **name** only,
   * where the browser version also matched email and external id. The filter
   * DSL conjoins its conditions: Ent's `Where(...)` ANDs them: so one box
   * across three fields would need an OR the API does not offer. Email and
   * external id remain searchable as their own `contains` filters in the filter
   * bar (`CUSTOMER_FILTERS`), which do work across every page.
   */
  return {
    customers,
    total: response?.pagination?.total ?? 0,
  }
}

/** `specs`: the filters the list offers, when they differ from `CUSTOMER_FILTERS` (the entity filter). */
export function useCustomers(
  query: CustomerQuery,
  options: { enabled?: boolean; specs?: readonly ListFilterSpec[] } = {},
) {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const billingEntityId = toTopLevelChoice(
    query.filters ?? [],
    options.specs ?? CUSTOMER_FILTERS,
    BILLING_ENTITY_FILTER.field,
  )

  return useQuery({
    queryKey: queryKeys.customers.list({
      ...query,
      statuses: [...query.statuses].sort(),
      // Whether the entity filter is sent, so turning entities on refetches.
      ...(billingEntityId ? { billingEntityId } : {}),
    }),
    queryFn: ({ signal }) => fetchCustomers(serverURL, auth, query, signal, options.specs),
    enabled: options.enabled ?? true,
    placeholderData: (previous) => previous,
  })
}

/**
 * The detail read model, richer than the list's.
 *
 * `GET /customers/{id}` returns the fuller
 * record: the postal address, a phone, the timezone, the tax treatment and any
 * metadata: that the search list drops. Everything optional collapses to empty
 * rather than absent, so the detail page renders a dash, never a hole.
 */
export interface CustomerDetailWire extends CustomerWire {
  addressLine1?: string | undefined
  addressLine2?: string | undefined
  addressCity?: string | undefined
  addressState?: string | undefined
  addressPostalCode?: string | undefined
  /** The wire spells the phone number `contact`. */
  contact?: string | undefined
  timezone?: string | undefined
  taxTreatment?: string | undefined
  metadata?: Record<string, string> | undefined
}

const TAX_TREATMENTS = new Set<string>(Object.values(CustomerTaxTreatment))

export function toCustomerDetail(wire: CustomerDetailWire): CustomerDetail {
  const taxTreatment = TAX_TREATMENTS.has(wire.taxTreatment ?? '')
    ? (wire.taxTreatment as CustomerTaxTreatment)
    : null

  return {
    ...toCustomer(wire),
    addressLine1: wire.addressLine1 ?? '',
    addressLine2: wire.addressLine2 ?? '',
    addressCity: wire.addressCity ?? '',
    addressState: wire.addressState ?? '',
    addressPostalCode: wire.addressPostalCode ?? '',
    phone: wire.contact ?? '',
    timezone: wire.timezone ?? '',
    taxTreatment,
    metadata: wire.metadata ?? {},
  }
}

export async function fetchCustomer(
  serverURL: string,
  auth: AuthSource,
  id: string,
  signal?: AbortSignal,
): Promise<CustomerDetail> {
  const { token, environmentId } = await credentials(auth, 'Sign in to view this customer.')
  const body = await getCustomer(serverURL, token, environmentId, id, signal)
  return toCustomerDetail(fromWire<CustomerDetailWire>(body))
}

/**
 * One customer, by internal id.
 *
 * Keyed on the internal `customerId` the route carries. The external-id
 * endpoints (subscriptions, entitlements) need the `externalId` this returns, so
 * a detail page reads the customer first and scopes the rest to what it finds.
 */
export function useCustomer(id: string) {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()

  return useQuery({
    queryKey: queryKeys.customers.detail(id),
    queryFn: ({ signal }) => fetchCustomer(serverURL, auth, id, signal),
    enabled: id.length > 0,
  })
}

export async function fetchCustomerSubscriptions(
  client: Flexprice,
  customerId: string,
): Promise<Subscription[]> {
  const response = await call(() =>
    client.subscriptions.querySubscription({
      // The internal id, not the external one: the API resolves an external id
      // to published customers only, so an archived customer's would 404.
      customerId,
      // The search returns only active subscriptions unless told otherwise, so a
      // trialing or draft contract would vanish. Same set V1's overview asks for,
      // plus paused, which the Live contracts tile counts.
      subscriptionStatus: LIVE_SUBSCRIPTION_STATUSES,
      expand: 'plan',
      limit: 100,
    } as never),
  )
  return (response.items ?? []).map((item) => toSubscription(item as SubscriptionWire))
}

/**
 * A customer's subscriptions, scoped by their internal id.
 *
 * The subscription search narrowed by `customerId`. Not the external id: the
 * API resolves that to a published customer only, so an archived customer's
 * contracts would fail to load (404) rather than show. Not
 * `GET /customers/external/{id}/subscriptions`: that endpoint rejects any
 * `expand` (400), so the plan name could not be resolved and the whole tab
 * failed. Not a paged list: a single customer's subscriptions are a handful,
 * shown whole rather than behind a pager.
 */
export function useCustomerSubscriptions(customerId: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.subscriptions.list({ customerId }),
    queryFn: () => fetchCustomerSubscriptions(client, customerId),
    enabled: customerId.length > 0,
  })
}

/**
 * A customer's invoices, scoped by their internal id.
 *
 * Invoices have no dedicated per-customer endpoint; the invoice search takes a
 * `customerId`, which still resolves once the customer is archived (the
 * external id does not). Returns the same `InvoicePage` the list does: status
 * is derived, so a draft reads "Draft" and a past-due one "Overdue".
 */
export function useCustomerInvoices(customerId: string) {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()

  return useQuery<InvoicePage>({
    queryKey: queryKeys.invoices.list({ customerId }),
    queryFn: ({ signal }) =>
      fetchInvoices(serverURL, auth, { ...DEFAULT_INVOICE_QUERY, pageSize: 200 }, signal, {
        customerId,
      }),
    enabled: customerId.length > 0,
  })
}

/**
 * A customer's entitlement usage: the per-feature quotas their detail page shows.
 *
 * `GET /customers/usage` (`client.customers.getCustomerUsageSummary`), which
 * takes the customer as a **query parameter**, not a path segment: there is no
 * `/customers/{id}/usage`. It is the only endpoint in the API that answers
 * "how much of this allowance has been used" per feature: `/entitlements/search`
 * knows the caps but not the usage, and `/events/analytics` knows usage over a
 * window the caller picks, which is not the same thing as usage within the
 * entitlement's own reset period.
 *
 * The payload is a `CustomerUsageSummaryResponse`, which is byte-for-byte the
 * `usage` half of `getTenantBillingUsage`. So this reuses `toFeatureUsage`
 * rather than restating the mapping: including the part that matters most,
 * that `total_limit: null` is *unlimited* and must not collapse to zero.
 *
 * Unlike the tenant route, the generated SDK path for this one is correct, so
 * it goes through the client with no `fetch` escape hatch.
 */
export interface CustomerUsageSummary {
  features: TenantFeatureUsage[]
  /** The billing period the usage is measured over. Both ends may be absent. */
  periodStart: Date | null
  periodEnd: Date | null
}

interface CustomerUsageSummaryWire {
  features?: FeatureUsageWire[] | undefined
  period?:
    { startTime?: Date | null | undefined; endTime?: Date | null | undefined } | null | undefined
}

export function toCustomerUsageSummary(wire: CustomerUsageSummaryWire): CustomerUsageSummary {
  return {
    features: (wire.features ?? []).map(toFeatureUsage),
    periodStart: wire.period?.startTime ?? null,
    periodEnd: wire.period?.endTime ?? null,
  }
}

export async function fetchCustomerUsageSummary(
  client: Flexprice,
  customerId: string,
  subscriptionId?: string,
): Promise<CustomerUsageSummary> {
  const response = await call(() =>
    client.customers.getCustomerUsageSummary({
      customerId,
      ...(subscriptionId ? { subscriptionIds: [subscriptionId] } : {}),
    }),
  )
  return toCustomerUsageSummary(response as CustomerUsageSummaryWire)
}

/**
 * One customer's feature quotas, by internal id.
 *
 * Keyed on the internal `customerId`: this endpoint takes that, not the
 * external id the subscription and invoice reads need. Gated on a real id so it
 * sits idle rather than asking about the empty string.
 */
export function useCustomerUsageSummary(customerId: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.customers.usage(customerId),
    queryFn: () => fetchCustomerUsageSummary(client, customerId),
    enabled: customerId.length > 0,
  })
}

/**
 * The quotas one contract grants, with the customer's usage against them.
 *
 * The same `GET /customers/usage`, narrowed with `subscription_ids`, so a
 * contract's Entitlements section reads its usage from the endpoint the
 * customer page does rather than from a second source that could disagree.
 * Usage is the customer's: a feature two contracts both grant reports one
 * combined figure, which is how the API meters it.
 */
export function useContractUsageSummary(customerId: string, subscriptionId: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.customers.contractUsage(customerId, subscriptionId),
    queryFn: () => fetchCustomerUsageSummary(client, customerId, subscriptionId),
    enabled: customerId.length > 0 && subscriptionId.length > 0,
  })
}

/** The text fields a customer form leaves as `''` when blank, mapped to their wire names. */
const CUSTOMER_TEXT_FIELDS = [
  ['email', 'email'],
  ['phone', 'contact'],
  ['timezone', 'timezone'],
  ['addressLine1', 'addressLine1'],
  ['addressLine2', 'addressLine2'],
  ['addressCity', 'addressCity'],
  ['addressState', 'addressState'],
  ['addressPostalCode', 'addressPostalCode'],
  ['addressCountry', 'addressCountry'],
] as const

/** Domain draft out, `CreateCustomerRequest` in. Blank optional fields are omitted. */
export function toCreateCustomerRequest(draft: CreateCustomer): Record<string, unknown> {
  const request: Record<string, unknown> = { externalId: draft.externalId, name: draft.name }
  for (const [field, wireKey] of CUSTOMER_TEXT_FIELDS) {
    const value = draft[field]
    if (value) request[wireKey] = value
  }
  if (draft.taxTreatment) request.taxTreatment = draft.taxTreatment
  if (draft.metadata) request.metadata = draft.metadata
  if (draft.billingEntityId) request.billingEntityId = draft.billingEntityId
  return request
}

/**
 * Domain edit out, `UpdateCustomerRequest` in. The update patches, so blanks are
 * omitted and leave the stored value alone; the SDK cannot send an empty string
 * to clear a field, so clearing a value is not offered.
 */
export function toUpdateCustomerRequest(draft: EditCustomer): Record<string, unknown> {
  return toCreateCustomerRequest(draft)
}

export function useCreateCustomer() {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const queryClient = useQueryClient()

  return useMutation({
    meta: { notify: { success: 'Customer created', error: 'Could not create the customer.' } },
    mutationFn: async (draft: CreateCustomer) => {
      const { token, environmentId } = await credentials(auth, 'Sign in to create a customer.')
      return createCustomer(
        serverURL,
        token,
        environmentId,
        toWireBody(toCreateCustomerRequest(draft)),
      )
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.customers.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.counts.all() })
    },
  })
}

export function useUpdateCustomer() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: EditCustomer }) =>
      call(() => client.customers.updateCustomer(toUpdateCustomerRequest(draft) as never, id)),
    onSuccess: (_result, { id }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.customers.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.customers.detail(id) })
    },
  })
}

/** Payments go through `connectionId`; answers with the customer, which replaces the cached one. */
export function useSetPreferredConnection(customerId: string) {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const queryClient = useQueryClient()

  return useMutation({
    meta: { notify: { success: 'Preferred payment gateway saved' } },
    mutationFn: async (connectionId: string) => {
      const { token, environmentId } = await credentials(auth, 'Sign in to edit this customer.')
      const body = await setPreferredConnection(
        serverURL,
        token,
        environmentId,
        customerId,
        connectionId,
      )
      return toCustomerDetail(fromWire<CustomerDetailWire>(body))
    },
    onSuccess: (customer) =>
      queryClient.setQueryData(queryKeys.customers.detail(customerId), customer),
  })
}

/** Back to Automatic: Flexprice picks the connection. */
export function useClearPreferredConnection(customerId: string) {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const queryClient = useQueryClient()

  return useMutation({
    meta: { notify: { success: 'Preferred payment gateway saved' } },
    mutationFn: async () => {
      const { token, environmentId } = await credentials(auth, 'Sign in to edit this customer.')
      const body = await clearPreferredConnection(serverURL, token, environmentId, customerId)
      return toCustomerDetail(fromWire<CustomerDetailWire>(body))
    },
    onSuccess: (customer) =>
      queryClient.setQueryData(queryKeys.customers.detail(customerId), customer),
  })
}

export function useDeleteCustomer() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => call(() => client.customers.deleteCustomer(id)),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.customers.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.counts.all() })
      void queryClient.removeQueries({ queryKey: queryKeys.customers.detail(id) })
    },
  })
}

/** One row of `GET /integrations/mappings`, camelCased by `fromWire`. */
export interface IntegrationMappingWire {
  id?: string | undefined
  providerType?: string | undefined
  providerEntityId?: string | undefined
  status?: string | undefined
  createdAt?: Date | undefined
  updatedAt?: Date | undefined
}

/**
 * Published mappings only, one per provider, named from the integration
 * catalogue exactly as the customer list names its marks: the catalogue `id`
 * is what picks the logo.
 */
export function toIntegrationLinks(wires: IntegrationMappingWire[] | undefined): IntegrationLink[] {
  const seen = new Set<string>()
  const links: IntegrationLink[] = []
  for (const wire of wires ?? []) {
    const providerType = wire.providerType?.trim()
    if (!providerType || seen.has(providerType)) continue
    if (wire.status && wire.status !== 'published') continue
    seen.add(providerType)
    const spec = INTEGRATION_CATALOG.find((entry) => entry.providerType === providerType)
    links.push({
      id: spec?.id ?? providerType,
      name: spec?.name ?? providerType,
      providerType,
      mappingId: wire.id ?? '',
      providerEntityId: wire.providerEntityId?.trim() ?? '',
      createdAt: wire.createdAt ?? null,
      updatedAt: wire.updatedAt ?? null,
    })
  }
  return links
}

/** Where a customer is mapped in each connected provider: `GET /integrations/mappings`. */
export function useCustomerIntegrationLinks(customerId: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.integrationLinks.forCustomer(customerId),
    queryFn: async ({ signal }) => {
      const response = await call(
        (options) =>
          client.integrations.getEntityIntegrationMappings('customer', customerId, options),
        signal,
      )
      return toIntegrationLinks(response.items)
    },
    enabled: customerId.length > 0,
  })
}

/** The customer list and detail show the same marks, so a link change refreshes both. */
function invalidateIntegrationLinks(
  queryClient: ReturnType<typeof useQueryClient>,
  customerId: string,
) {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.integrationLinks.forCustomer(customerId),
  })
  void queryClient.invalidateQueries({ queryKey: queryKeys.customers.all() })
}

/** Map this customer to their record in a provider: `POST /integrations/link`. */
export function useLinkCustomerIntegration(customerId: string) {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      providerType,
      providerEntityId,
    }: {
      providerType: string
      providerEntityId: string
    }) =>
      call(() =>
        client.integrations.linkIntegrationMapping({
          entityId: customerId,
          entityType: 'customer',
          providerType,
          providerEntityId,
        }),
      ),
    onSuccess: () => invalidateIntegrationLinks(queryClient, customerId),
  })
}

/** Remove a provider mapping: `DELETE /integrations/link`, which carries a body. */
export function useUnlinkCustomerIntegration(customerId: string) {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ providerType }: { providerType: string }) =>
      call(() =>
        client.integrations.delinkIntegrationMapping({
          entityId: customerId,
          entityType: 'customer',
          providerType,
        }),
      ),
    onSuccess: () => invalidateIntegrationLinks(queryClient, customerId),
  })
}
