import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, ErrorKind, type Flexprice, call, inviteUser } from '@fp/api'
import {
  type CreateServiceAccount,
  type InviteMember,
  type Member,
  type MemberQuery,
  MemberType,
  matchesMemberQuery,
  normalizeRoleSelection,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice, useFlexpriceAuth, useFlexpriceServerURL } from './provider'

/**
 * Members: people and service accounts, one endpoint, two screens.
 *
 * Reached through `POST /users/search` (`client.users.queryUser`). The Team
 * screen and the Service Accounts screen differ only by the `type` sent, which
 * is why there is one fetch here and two thin hooks over it.
 *
 * Three things were verified live and each of them changes the code:
 *
 *   1. **`type` is mandatory.** A body of `{limit, offset}` with no `type`
 *      returns `{items: [], total: 0}`: not everything, *nothing*: and a body
 *      of `{}` answers 500. So `toMemberFilter` always sends one.
 *   2. **`filters` and `roles` are ignored.** `UserFilter` declares both, the
 *      SDK serialises both, and the endpoint pays attention to neither: a
 *      `contains` filter for `"zzzznomatch"` returned the row it cannot match,
 *      and `roles: ['event_reader']` returned a user whose only role is
 *      `super_admin`. Sending them would produce a search box that appears to
 *      work and quietly shows wrong results: exactly the defect class
 *      `docs/audit/live-api-verification.md` records. So search and role
 *      narrowing are applied on the page, and said so.
 *   3. **`status` must not be sent.** `status: 'published'` returns zero rows;
 *      user records carry no status column.
 *
 * A user record also has no `created_at`/`updated_at`, so there is no "joined"
 * column to offer.
 */

/** The tenant as it arrives nested on a user. Only the two fields a row shows. */
interface MemberTenantWire {
  id?: string | undefined
  name?: string | undefined
}

/** The wire shape this reads, after the SDK camelCases the response. */
export interface UserWire {
  id?: string | undefined
  name?: string | undefined
  email?: string | undefined
  type?: string | undefined
  roles?: string[] | undefined
  tenant?: MemberTenantWire | undefined
  metadata?: Record<string, string> | undefined
}

const MEMBER_TYPES = new Set<string>(Object.values(MemberType))

export function toMember(wire: UserWire): Member {
  const type = MEMBER_TYPES.has(wire.type ?? '')
    ? (wire.type as MemberType)
    : // An unknown discriminator is the API ahead of this client. A person is
      // the safer default: a service account rendered as a person is a cosmetic
      // wrong label, a person rendered as a service account offers the wrong
      // destructive actions.
      MemberType.User

  return {
    id: wire.id ?? '',
    name: wire.name ?? '',
    // Documented as empty for service accounts, so this is a real empty string
    // rather than a missing value to paper over.
    email: wire.email ?? '',
    type,
    // Normalized on the way in as well as out: a response that lists
    // super_admin alongside other roles is still displayed as the one grant it
    // actually is.
    roles: normalizeRoleSelection(wire.roles ?? []),
    tenantId: wire.tenant?.id ?? '',
    tenantName: wire.tenant?.name ?? '',
  }
}

/**
 * Domain query out, `UserFilter` in.
 *
 * Only `type`, `limit` and `offset`: the three fields the endpoint honours.
 * Page numbers are 1-based; offsets are not.
 */
export function toMemberFilter(query: MemberQuery): Record<string, unknown> {
  return {
    type: query.type,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  }
}

export interface MemberPage {
  members: Member[]
  /** The server's total for the `type`, before the page-applied narrowing. */
  total: number
}

export async function fetchMembers(client: Flexprice, query: MemberQuery): Promise<MemberPage> {
  const response = await call(() => client.users.queryUser(toMemberFilter(query) as never))
  const members = (response.items ?? []).map((item) => toMember(item as UserWire))

  return {
    // Search and role narrowing are not server-side filters here: see the
    // module note. Stated rather than hidden: this narrows the current page,
    // not the whole set, and `total` still counts the whole set.
    members: members.filter((member) => matchesMemberQuery(member, query)),
    total: response.pagination?.total ?? 0,
  }
}

export function useMembers(query: MemberQuery) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.members.list({ ...query, roles: [...query.roles].sort() }),
    queryFn: () => fetchMembers(client, query),
    placeholderData: (previous) => previous,
  })
}

/** Members read per request, and the most requests one scan makes. */
const SCAN_PAGE_SIZE = 100

/**
 * Every member of the query's type, read page by page.
 *
 * The Team and Service accounts tables search, sort and page in the browser,
 * because the endpoint ignores `filters` (see the module note). That is only
 * honest over the whole set, so the whole set is read: a tenant's people and
 * machine identities run to dozens, not thousands. `total` is what matched.
 */
export async function fetchAllMembers(client: Flexprice, query: MemberQuery): Promise<MemberPage> {
  const members: Member[] = []
  // Until the server's total is reached, however many pages that takes: a
  // cut-off would hide members with no sign the list is incomplete.
  for (let page = 1; ; page += 1) {
    const response = await call(() =>
      client.users.queryUser(toMemberFilter({ ...query, page, pageSize: SCAN_PAGE_SIZE }) as never),
    )
    const items = response.items ?? []
    members.push(...items.map((item) => toMember(item as UserWire)))
    const total = response.pagination?.total ?? 0
    if (items.length < SCAN_PAGE_SIZE || members.length >= total) break
  }
  const matching = members.filter((member) => matchesMemberQuery(member, query))
  return { members: matching, total: matching.length }
}

function useAllMembers(query: MemberQuery) {
  const client = useFlexprice()
  const { page: _page, pageSize: _pageSize, ...unpaged } = query

  return useQuery({
    queryKey: queryKeys.members.list({ ...unpaged, roles: [...query.roles].sort(), all: true }),
    queryFn: () => fetchAllMembers(client, query),
    placeholderData: (previous) => previous,
  })
}

/** The Team screen: every person in the tenant. */
export function useTeamMembers(query: MemberQuery) {
  return useAllMembers({ ...query, type: MemberType.User })
}

/** The Service Accounts screen: every machine identity in the tenant. */
export function useServiceAccounts(query: MemberQuery) {
  return useAllMembers({ ...query, type: MemberType.ServiceAccount })
}

/**
 * The signed-in member's own record.
 *
 * `GET /users/me`. Distinct from `useCurrentUser` in `session.ts`, which reads
 * the same route through the session shim to bootstrap auth; this one returns a
 * domain `Member` for rendering a profile card once a session exists.
 */
export function useUserInfo() {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.members.me(),
    queryFn: async () => {
      const wire = await call(() => client.users.getUserInfo())
      return toMember(wire as UserWire)
    },
  })
}

/**
 * Invite a person. `POST /users` with `type: 'user'`.
 *
 * Roles are sent only when chosen: the API requires them for a service account
 * and treats them as optional for a person, so an empty array is omitted rather
 * than sent as `[]`.
 */
export function toInviteMemberRequest(draft: InviteMember): Record<string, unknown> {
  return {
    type: MemberType.User,
    email: draft.email,
    ...(draft.name ? { name: draft.name } : {}),
    ...(draft.roles.length > 0 ? { roles: normalizeRoleSelection(draft.roles) } : {}),
  }
}

/**
 * Create a service account. `POST /users` with `type: 'service_account'`.
 *
 * No email: the API returns one empty for this type: and `roles` is required.
 * The create response can carry a `password`; it is deliberately not surfaced,
 * because a service account is authenticated with an API key issued against it
 * (see `apiKeys.ts`), not with a password.
 */
export function toCreateServiceAccountRequest(
  draft: CreateServiceAccount,
): Record<string, unknown> {
  return {
    type: MemberType.ServiceAccount,
    name: draft.name,
    roles: normalizeRoleSelection(draft.roles),
  }
}

/**
 * Invite a teammate: `POST /users` with `type: 'user'`.
 *
 * What comes back depends on the deployment:
 *
 *   - **Hosted (Supabase):** a one-time `password`, returned once and stored
 *     nowhere, so the caller must show it now or it is lost.
 *   - **Self-hosted:** no password; an `invite_token` the admin shares as a
 *     link, at which the member sets their own password (flexprice#3123).
 *
 * Sent with `fetch` rather than the SDK: the SDK's `CreateUserResponse` schema
 * strips `invite_token`, which is not in the OpenAPI document.
 */
export function useInviteMember() {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (draft: InviteMember) => {
      const token = await auth.getToken()
      if (!token) throw new ApiError(ErrorKind.Unauthorized, 'Sign in to invite a member.')
      const result = await inviteUser(
        serverURL,
        token,
        (await auth.getEnvironmentId()) ?? '',
        toInviteMemberRequest(draft),
      )
      return {
        member: toMember(result.user as UserWire),
        password: result.password,
        inviteLink: result.inviteLink,
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.members.all() })
    },
  })
}

export function useCreateServiceAccount() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (draft: CreateServiceAccount) => {
      const wire = await call(() =>
        client.users.createUser(toCreateServiceAccountRequest(draft) as never),
      )
      return toMember(wire as UserWire)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.members.all() })
    },
  })
}

/**
 * Rename **yourself**.
 *
 * `PUT /users/me`: the route takes no id, so this can only ever edit the
 * signed-in person's own record. There is no API for renaming another member;
 * a service account is renamed with `useRenameServiceAccount` below. Worth
 * naming precisely, because "update user" reads like it takes an id.
 */
export function useUpdateOwnProfile() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (name: string) => {
      const wire = await call(() => client.users.updateUser({ name } as never))
      return toMember(wire as UserWire)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.members.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.session.all() })
    },
  })
}

/**
 * Replace a member's roles. `PUT /users/{id}/roles`.
 *
 * The roles are normalized before they are sent, so super-admin exclusivity
 * holds at the network boundary and not only in whichever picker produced the
 * list: the rule lives in `@fp/domain`, and this is the one place that has to
 * apply it on the way out.
 */
export function useUpdateMemberRoles() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, roles }: { id: string; roles: string[] }) => {
      const wire = await call(() =>
        client.users.updateUserRoles(id, { roles: normalizeRoleSelection(roles) } as never),
      )
      return toMember(wire as UserWire)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.members.all() })
      // A key's roles are the holder's roles, so the keys table is now stale.
      void queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all() })
    },
  })
}

/**
 * Remove a person from the tenant. `POST /users/{id}/remove`.
 *
 * A hard removal, not an archive: there is no status to set them back to, so
 * this is not reversible from the console.
 */
export function useRemoveMember() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => call(() => client.users.removeUser(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.members.all() })
    },
  })
}

/** Rename a service account. `PUT /users/{id}`, which takes only a name. */
export function useRenameServiceAccount() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const wire = await call(() => client.users.updateServiceAccount(id, { name } as never))
      return toMember(wire as UserWire)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.members.all() })
      // The keys table prints the owning service account's name.
      void queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all() })
    },
  })
}

/**
 * Delete a service account. `DELETE /users/{id}`.
 *
 * Every API key issued against it stops working, so the keys list is
 * invalidated alongside the members list.
 */
export function useDeleteServiceAccount() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => call(() => client.users.deleteServiceAccount(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.members.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all() })
    },
  })
}
