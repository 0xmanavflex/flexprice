/**
 * A member of the tenant: a person or a machine.
 *
 * The Team screen and the Service Accounts screen are the *same* endpoint,
 * `POST /users/search`, filtered differently: the API carries one record type
 * with a `type` discriminator, `user` for a person and `service_account` for a
 * machine identity that an API key is issued against. V1 models these as two
 * unrelated shapes and re-derives the distinction in each component; here the
 * distinction is one field, and the two screens are two queries.
 *
 * What the API does *not* carry is worth stating, because a table will want it:
 * a user record has no `created_at`, `updated_at` or `status`: verified live.
 * There is no "joined on" column to render and no way to show a deactivated
 * member, because a removed member is deleted rather than archived.
 */
import { z } from 'zod'

/**
 * Person or machine. The API's own spelling, so it is also the value sent as
 * `UserFilter.type`: which the list endpoint *requires*: verified live, a
 * search body with no `type` returns `{items: [], total: 0}` rather than
 * everything, and a body with no fields at all answers 500.
 */
export const MemberType = {
  User: 'user',
  ServiceAccount: 'service_account',
} as const
export type MemberType = (typeof MemberType)[keyof typeof MemberType]

export const MEMBER_TYPE_LABEL: Record<MemberType, string> = {
  [MemberType.User]: 'Member',
  [MemberType.ServiceAccount]: 'Service account',
}

/** The read model the Team and Service Accounts tables render. Narrow and total. */
export interface Member {
  id: string
  /** Display name. Empty for a person who never set one. */
  name: string
  /** Always empty for a service account: the API says so explicitly. */
  email: string
  type: MemberType
  /** RBAC role ids, e.g. `['super_admin']`. Assignable, never editable. */
  roles: string[]
  /** The tenant the member belongs to, when the response expanded it. */
  tenantId: string
  tenantName: string
}

export function isServiceAccount(member: Member): boolean {
  return member.type === MemberType.ServiceAccount
}

/**
 * What to put in the name column.
 *
 * A person is identified by their email when they never set a name; a service
 * account has no email at all, so its name is all there is.
 */
export function memberDisplayName(member: Member): string {
  return member.name || member.email || 'Unnamed'
}

/**
 * What the list can ask for. Product vocabulary, not transport.
 *
 * `search` and `roles` are deliberately *page* filters rather than request
 * fields, and that is not a shortcut: see `toMemberFilter` in `@fp/query`.
 * `UserFilter` declares both `filters` and `roles`, and the endpoint ignores
 * them: verified live, a `contains` filter for `"zzzznomatch"` returned the
 * matching-nothing row anyway, and `roles: ['event_reader']` returned a user
 * whose only role is `super_admin`. Sending them would look like it worked.
 */
export interface MemberQuery {
  page: number
  pageSize: number
  /** Which screen this is. Required by the API, so it has no empty value. */
  type: MemberType
  search: string
  /** Narrow to members holding any of these role ids. Applied on the page. */
  roles: string[]
}

export const DEFAULT_MEMBER_QUERY: MemberQuery = {
  page: 1,
  pageSize: 25,
  type: MemberType.User,
  search: '',
  roles: [],
}

export const DEFAULT_SERVICE_ACCOUNT_QUERY: MemberQuery = {
  ...DEFAULT_MEMBER_QUERY,
  type: MemberType.ServiceAccount,
}

/** Does this member match the page-applied part of the query? */
export function matchesMemberQuery(member: Member, query: MemberQuery): boolean {
  const term = query.search.trim().toLowerCase()
  const matchesSearch =
    term.length === 0 ||
    member.name.toLowerCase().includes(term) ||
    member.email.toLowerCase().includes(term)

  const matchesRoles =
    query.roles.length === 0 || member.roles.some((role) => query.roles.includes(role))

  return matchesSearch && matchesRoles
}

/**
 * Inviting a person.
 *
 * `POST /users` with `type: 'user'`. The API documents `email` as required for
 * a person and `roles` as required for a service account, so the two drafts are
 * separate schemas rather than one with everything optional: a form that can
 * submit a person with no email is a form that fails at the network.
 *
 * Roles are optional on an invite: a member can be created with none and have
 * them assigned afterwards through `updateUserRoles`.
 */
export const inviteMemberSchema = z.object({
  email: z.string().trim().min(1, 'Enter an email').email('Enter a valid email'),
  name: z.string().trim().optional(),
  roles: z.array(z.string()).default([]),
})

export type InviteMember = z.infer<typeof inviteMemberSchema>

export function emptyInvite(): InviteMember {
  return { email: '', name: '', roles: [] }
}

/**
 * Creating a service account.
 *
 * No email: the API returns one empty for service accounts: and at least one
 * role, because a machine identity with no permissions can do nothing and the
 * API requires `roles` for this type.
 */
export const createServiceAccountSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name'),
  roles: z.array(z.string()).min(1, 'Choose at least one role'),
})

export type CreateServiceAccount = z.infer<typeof createServiceAccountSchema>

export function emptyServiceAccount(): CreateServiceAccount {
  return { name: '', roles: [] }
}

/**
 * Renaming a member.
 *
 * A person's own record is edited through `PUT /users/me` (`updateUser`), which
 * takes only a name and metadata: an email cannot be changed. A service
 * account is renamed through `PUT /users/{id}` (`updateServiceAccount`), which
 * takes only a name.
 */
export const renameMemberSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name'),
})

export type RenameMember = z.infer<typeof renameMemberSchema>
