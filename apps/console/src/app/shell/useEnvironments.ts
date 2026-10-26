import { useCallback, useEffect, useMemo } from 'react'
import {
  EnvironmentType,
  environmentKind,
  type CreateEnvironment,
  type Environment,
} from '@fp/domain'
import { useCreateEnvironment, useEnvironmentList } from '@fp/query'
import type { ShellEnvironment } from '@fp/ui/compositions'
import { env } from '@/env'
import { useSession } from '../session'

/**
 * The environment list, and where the console is working.
 *
 * This used to hold a two-item array and a long note about why it could not be
 * a request. The note was right about the cause and is worth keeping in one
 * line: `environment.go` carries a swagger annotation on 1 of its 5 handlers:
 * the clone: so `GET /environments` and `POST /environments` are live,
 * RBAC-protected routes absent from the OpenAPI document and therefore from
 * the SDK (`docs/api-contract-gap.md`).
 *
 * What changed is where that gap is absorbed. It is not absorbed here, and it
 * is still not a `@fp/sdk-adapter` shim: a shim needs a removal issue, and
 * inventing an issue number to satisfy a lint rule is how a temporary layer
 * becomes permanent. It is absorbed in `@fp/api`'s `session.ts`, which is the
 * documented home for exactly these routes and speaks `fetch` for them, behind
 * `@fp/query`'s `useEnvironmentList` / `useCreateEnvironment`. So this hook is
 * an ordinary consumer of the one data door, like every other hook in the app,
 * and when the handlers are annotated nothing here changes at all: the change
 * is one file deep in `@fp/api`.
 *
 * ## The active id is not stored here
 *
 * It lives in `SessionProvider`, because it is not a piece of shell state: it
 * is persisted across reloads and it is what the API client puts in
 * `X-Environment-ID` on every request. A second `useState` copy here would be
 * a second answer to "which environment am I in", and the two would disagree
 * exactly when it matters: a switch that repaints the header while every
 * query still reads the old environment.
 */

export interface UseEnvironments {
  environments: ShellEnvironment[]
  current: ShellEnvironment
  select: (id: string) => void
  create: (draft: CreateEnvironment) => void
  /**
   * Production is arranged rather than self-served for most tenants, which is
   * why V1 puts a "talk to us" panel behind it.
   *
   * Still `false`, and still an assumption rather than a reading. The API does
   * enforce per-type quotas: a create past the limit comes back as
   * `validation_error: You have reached the maximum limit of 2 development
   * environment(s)`: but it only says so in response to an attempt, and there
   * is no endpoint that reports the quota up front. Probing it would mean
   * creating a production environment to find out whether one may be created,
   * which is not a question worth answering that way. So the safe assumption
   * stands, the option stays visible and disabled with its reason attached,
   * and if the limits ever become readable this becomes a real value.
   */
  canCreateProduction: boolean
}

/**
 * A token under mocks, so there is one code path and not two.
 *
 * `useEnvironmentList` is disabled without a token: correctly, since a
 * signed-out request is a guaranteed 401. Storybook, the e2e run and a plain
 * `pnpm dev` with no backend have no token and still need a shell, so they get
 * a token-shaped constant and MSW answers `GET /environments` with the real
 * response shape (see `mocks/handlers.ts`). The alternative: a `useMocks`
 * branch returning a hardcoded array: is a path the real build never runs,
 * which is how mocked code rots.
 */
const MOCK_TOKEN = 'mock-session-token'

function toShell(environment: Environment): ShellEnvironment {
  return {
    id: environment.id,
    name: environment.name,
    kind: environmentKind(environment.type),
  }
}

/**
 * What the header shows when there is no environment to show.
 *
 * `current` cannot be absent: the shell renders an environment in the
 * breadcrumb on every page, and the switcher's trigger needs a name. So the
 * in-flight and failed states get a labelled placeholder with an **empty id**:
 * it names no environment, nothing can be selected into it, and it is never
 * written to the session, so no request is ever made "in" it. Fabricating a
 * plausible `Sandbox` here would be the one genuinely dangerous option: it
 * would read as a working console pointed somewhere safe.
 *
 * `kind` is `sandbox` for the same reason `toEnvironment` defaults there:
 * only production is marked, and marking a placeholder as production would
 * teach people to ignore the mark.
 */
function placeholder(name: string): ShellEnvironment {
  return { id: '', name, kind: 'sandbox' }
}

/**
 * The default, when the session has no usable id.
 *
 * A sandbox in preference to production whenever both exist: whichever
 * environment the app opens in is the one someone will edit without checking.
 */
function preferredDefault(environments: Environment[]): Environment | undefined {
  return environments.find((e) => e.type !== EnvironmentType.Production) ?? environments[0]
}

export function useEnvironments(): UseEnvironments {
  const { session, environmentId, setEnvironmentId } = useSession()

  /*
   * The same precedence `useAuthSource` uses, deliberately: the development
   * API-key override wins over a signed-in token. It has to be the same
   * identity: the list decides which environment id goes in `X-Environment-ID`
   * on every other request, so fetching it as a different principal than the
   * one making those requests is how you get a list of environments none of
   * them may enter.
   */
  const token = env.apiKey ?? session?.token ?? (env.useMocks ? MOCK_TOKEN : null)

  const { data, isError, isFetching } = useEnvironmentList(token)
  const environments = useMemo(() => data ?? [], [data])

  const selected = environments.find((e) => e.id === environmentId)
  const fallback = preferredDefault(environments)

  /*
   * Two cases, one rule: adopt the default whenever the session's id is not one
   * of the ids the server just returned.
   *
   * The first is a fresh browser, with nothing persisted. The second is the
   * one that actually hurts: an id persisted from another tenant, or from an
   * environment since deleted. `X-Environment-ID` naming an environment this
   * token cannot reach makes every call 403, so the console loads, looks
   * signed in, and shows nothing anywhere. Re-defaulting is what turns that
   * into a working console pointed at a real environment.
   *
   * It runs in an effect rather than during render because it writes to the
   * session provider and to `localStorage`, and it is a no-op once the ids
   * agree, so it settles in one pass.
   */
  useEffect(() => {
    // A create switches to the new id before the list refetch finishes. Falling
    // back in that window would leave the console on the previous environment
    // and, once the refetch landed, look like the new one was never selected.
    if (!fallback || selected || isFetching) return
    setEnvironmentId(fallback.id)
  }, [fallback, selected, isFetching, setEnvironmentId])

  const { mutate } = useCreateEnvironment(token)

  const create = useCallback(
    (draft: CreateEnvironment) => {
      mutate(draft, {
        onSuccess: (created) => {
          // Switching to what you just made is the only reason to have made
          // it: but only when the response named it. A 2xx with no id still
          // created something; the invalidated list will show it, and
          // switching to an id we do not have would strand the console in an
          // environment that 403s everything.
          if (created.id) setEnvironmentId(created.id)
        },
      })
    },
    [mutate, setEnvironmentId],
  )

  const shell = environments.map(toShell)

  /*
   * While the list is in flight the header reads "Loading environments" and
   * the switcher's menu is empty; if the request fails it reads "Environments
   * unavailable" and stays empty. Neither is a state the rest of the console
   * can work in: without an environment id every other call 403s: and
   * neither pretends otherwise. The one thing not done here is telling the
   * person *why* it failed; the switcher has no room for an error, and the
   * page underneath is already showing the same failure with the room to
   * explain it.
   */
  const current =
    (selected ? toShell(selected) : undefined) ??
    (fallback ? toShell(fallback) : undefined) ??
    placeholder(isError ? 'Environments unavailable' : 'Loading environments')

  return {
    environments: shell,
    current,
    select: setEnvironmentId,
    create,
    canCreateProduction: false,
  }
}
