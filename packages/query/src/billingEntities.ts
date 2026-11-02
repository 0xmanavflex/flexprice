import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type AuthSource,
  createBillingEntity,
  enableBillingEntities,
  getBillingEntity,
  getBillingEntityStatus,
  listBillingEntities,
  updateBillingEntity,
} from '@fp/api'
import {
  type BillingEntity,
  type BillingEntityDraft,
  BillingEntityMode,
  type SellerAddress,
  type SellerDetails,
  type TaxIdentifier,
  effectiveEntityId,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexpriceAuth, useFlexpriceServerURL } from './provider'
import { credentials } from './wire'

/**
 * Billing entities: the legal sellers an environment invoices from. The routes
 * have no SDK method (see `@fp/api` `billingEntities.ts`). Mode and every
 * entity route are per environment; the list, detail and writes only answer
 * once the mode is `enabled`.
 */

export interface BillingEntityWire {
  id?: string
  name?: string
  legal_name?: string
  is_default?: boolean
  invoice_number_prefix?: string
  seller_details?: {
    email?: string
    help_email?: string
    phone?: string
    address?: {
      address_line1?: string
      address_line2?: string
      address_city?: string
      address_state?: string
      address_postal_code?: string
      address_country?: string
    } | null
  } | null
  tax_identifiers?: { type?: string; value?: string; country?: string }[] | null
  created_at?: string
}

/** Keeps only the keys that carry a value. */
function compact<T>(value: Record<string, string | undefined>): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item)) as T
}

export function toBillingEntity(wire: BillingEntityWire): BillingEntity {
  const seller = wire.seller_details
  const address = seller?.address
  const createdAt = wire.created_at ? new Date(wire.created_at) : null
  return {
    id: wire.id ?? '',
    name: wire.name ?? '',
    legalName: wire.legal_name ?? '',
    isDefault: wire.is_default ?? false,
    invoiceNumberPrefix: wire.invoice_number_prefix ?? '',
    seller: {
      ...compact<Omit<SellerDetails, 'address'>>({
        email: seller?.email,
        helpEmail: seller?.help_email,
        phone: seller?.phone,
      }),
      address: compact<SellerAddress>({
        line1: address?.address_line1,
        line2: address?.address_line2,
        city: address?.address_city,
        state: address?.address_state,
        postalCode: address?.address_postal_code,
        country: address?.address_country,
      }),
    },
    taxIdentifiers: (wire.tax_identifiers ?? []).map((item): TaxIdentifier =>
      compact({ type: item.type, value: item.value, country: item.country }),
    ),
    createdAt: createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : null,
  }
}

/** The create and update body. Empty seller fields are left out, but seller_details is always sent (a missing one means unchanged on update); tax identifiers go whole. */
export function toBillingEntityRequest(draft: BillingEntityDraft): Record<string, unknown> {
  const { seller } = draft
  const address = compact<Record<string, string>>({
    address_line1: seller.address.line1,
    address_line2: seller.address.line2,
    address_city: seller.address.city,
    address_state: seller.address.state,
    address_postal_code: seller.address.postalCode,
    address_country: seller.address.country,
  })
  const sellerDetails = {
    ...compact<Record<string, string>>({
      email: seller.email,
      help_email: seller.helpEmail,
      phone: seller.phone,
    }),
    ...(Object.keys(address).length > 0 ? { address } : {}),
  }
  return {
    name: draft.name,
    legal_name: draft.legalName,
    invoice_number_prefix: draft.invoiceNumberPrefix,
    seller_details: sellerDetails,
    tax_identifiers: draft.taxIdentifiers,
  }
}

const MODES: readonly string[] = Object.values(BillingEntityMode)

function toMode(body: unknown): BillingEntityMode {
  const mode = (body as { mode?: string } | null)?.mode ?? ''
  return MODES.includes(mode) ? (mode as BillingEntityMode) : BillingEntityMode.Off
}

const STATUS_POLL_MS = 3000

/** Enabling assigns the environment's customers in the background; poll until it lands. */
export function statusRefetchInterval(mode: BillingEntityMode | undefined): number | false {
  return mode === BillingEntityMode.Enabling ? STATUS_POLL_MS : false
}

const SIGNED_OUT = 'Sign in to manage billing entities.'

async function fetchStatus(
  serverURL: string,
  auth: AuthSource,
  signal?: AbortSignal,
): Promise<BillingEntityMode> {
  const { token, environmentId } = await credentials(auth, SIGNED_OUT)
  return toMode(await getBillingEntityStatus(serverURL, token, environmentId, signal))
}

const ENTITY_PAGE = 1000

async function fetchEntities(
  serverURL: string,
  auth: AuthSource,
  signal?: AbortSignal,
): Promise<BillingEntity[]> {
  const { token, environmentId } = await credentials(auth, SIGNED_OUT)
  const body = await listBillingEntities(
    serverURL,
    token,
    environmentId,
    { limit: ENTITY_PAGE, offset: 0 },
    signal,
  )
  const items = (body as { items?: BillingEntityWire[] | null } | null)?.items ?? []
  return items.map(toBillingEntity)
}

async function fetchEntity(
  serverURL: string,
  auth: AuthSource,
  id: string,
  signal?: AbortSignal,
): Promise<BillingEntity> {
  const { token, environmentId } = await credentials(auth, SIGNED_OUT)
  return toBillingEntity(
    (await getBillingEntity(serverURL, token, environmentId, id, signal)) as BillingEntityWire,
  )
}

export function useBillingEntityStatus() {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()

  return useQuery({
    queryKey: queryKeys.billingEntities.status(),
    queryFn: ({ signal }) => fetchStatus(serverURL, auth, signal),
    refetchInterval: (query) => statusRefetchInterval(query.state.data),
  })
}

/** The environment's entities; nothing is asked until the mode is `enabled`. */
export function useBillingEntities(options: { enabled?: boolean } = {}) {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const status = useBillingEntityStatus()

  return useQuery({
    queryKey: queryKeys.billingEntities.list(),
    queryFn: ({ signal }) => fetchEntities(serverURL, auth, signal),
    enabled: (options.enabled ?? true) && status.data === BillingEntityMode.Enabled,
  })
}

/** The entity filter's choices; null while entities are not enabled, so lists leave the filter out. */
export function useEntityFilterOptions(): { value: string; label: string }[] | null {
  const status = useBillingEntityStatus()
  const entities = useBillingEntities()
  if (status.data !== BillingEntityMode.Enabled) return null
  return (entities.data ?? []).map((entity) => ({ value: entity.id, label: entity.name }))
}

/** The entity a customer bills from; null while entities are not enabled or still loading. */
export function useCustomerBillingEntity(
  customer: { billingEntityId?: string | null | undefined } | undefined,
): BillingEntity | null {
  const status = useBillingEntityStatus()
  const entities = useBillingEntities()
  if (status.data !== BillingEntityMode.Enabled || !customer || !entities.data) return null
  const id = effectiveEntityId(customer, entities.data)
  return entities.data.find((entity) => entity.id === id) ?? null
}

export function useBillingEntity(id: string) {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const status = useBillingEntityStatus()

  return useQuery({
    queryKey: queryKeys.billingEntities.detail(id),
    queryFn: ({ signal }) => fetchEntity(serverURL, auth, id, signal),
    enabled: id.length > 0 && status.data === BillingEntityMode.Enabled,
  })
}

function useRefreshEntities() {
  const queryClient = useQueryClient()
  return () => void queryClient.invalidateQueries({ queryKey: queryKeys.billingEntities.all() })
}

/** Super admins only; irreversible. Resolves with the mode the API reports (`enabling` or `enabled`). */
export function useEnableBillingEntities() {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const refresh = useRefreshEntities()

  return useMutation({
    mutationFn: async () => {
      const { token, environmentId } = await credentials(auth, SIGNED_OUT)
      return toMode(await enableBillingEntities(serverURL, token, environmentId))
    },
    onSuccess: refresh,
    meta: { notify: { error: 'Could not enable billing entities.' } },
  })
}

export function useCreateBillingEntity() {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const refresh = useRefreshEntities()

  return useMutation({
    mutationFn: async (draft: BillingEntityDraft) => {
      const { token, environmentId } = await credentials(auth, SIGNED_OUT)
      return toBillingEntity(
        (await createBillingEntity(
          serverURL,
          token,
          environmentId,
          toBillingEntityRequest(draft),
        )) as BillingEntityWire,
      )
    },
    onSuccess: refresh,
    meta: {
      notify: { success: 'Billing entity created', error: 'Could not create the billing entity.' },
    },
  })
}

export function useUpdateBillingEntity() {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const refresh = useRefreshEntities()

  return useMutation({
    mutationFn: async ({ id, draft }: { id: string; draft: BillingEntityDraft }) => {
      const { token, environmentId } = await credentials(auth, SIGNED_OUT)
      return toBillingEntity(
        (await updateBillingEntity(
          serverURL,
          token,
          environmentId,
          id,
          toBillingEntityRequest(draft),
        )) as BillingEntityWire,
      )
    },
    onSuccess: refresh,
    meta: {
      notify: { success: 'Billing entity saved', error: 'Could not save the billing entity.' },
    },
  })
}
