import { useCallback, useState } from 'react'
import {
  EnvironmentType,
  environmentKind,
  type CreateEnvironment,
  type Environment,
} from '@fp/domain'
import type { ShellEnvironment } from '@fp/ui/compositions'

/**
 * The environment list, and the one place it is not yet real.
 *
 * `environment.go` carries a swagger annotation on 1 of its 5 handlers — the
 * clone — so `GET /environments` and `POST /environments` are absent from the
 * OpenAPI document and therefore from the SDK. Both endpoints exist and the
 * current dashboard uses them; they are simply undocumented.
 *
 * Rather than shim around that, the list is held here, in one hook, with the
 * exact shape the API returns. Creating one adds it here. That is the same
 * fidelity everything else about environments has today — the switcher has
 * never been backed by a request — and it makes the flow demonstrable end to
 * end instead of dead.
 *
 * When the handlers are annotated, this hook's body becomes a `useQuery` and a
 * `useMutation` against `@fp/query` and nothing above it changes: the shell
 * already takes a list, a current id, and two callbacks.
 *
 * It is deliberately *not* a `@fp/sdk-adapter` shim. A shim needs a removal
 * issue, and inventing an issue number to satisfy a lint rule is how a
 * temporary layer becomes permanent.
 */
const SEED: Environment[] = [
  { id: 'env_prod', name: 'Production', type: EnvironmentType.Production },
  { id: 'env_dev', name: 'Sandbox', type: EnvironmentType.Sandbox },
]

export interface UseEnvironments {
  environments: ShellEnvironment[]
  current: ShellEnvironment
  select: (id: string) => void
  create: (draft: CreateEnvironment) => void
  /**
   * Production is arranged rather than self-served for most tenants, which is
   * why V1 puts a "talk to us" panel behind it. Until the plan is readable
   * from the API, assume it is not available and say so.
   */
  canCreateProduction: boolean
}

function toShell(environment: Environment): ShellEnvironment {
  return {
    id: environment.id,
    name: environment.name,
    kind: environmentKind(environment.type),
  }
}

export function useEnvironments(): UseEnvironments {
  const [environments, setEnvironments] = useState<Environment[]>(SEED)
  // The sandbox, not the production one. Whichever environment the app opens
  // in is the one someone will edit without checking.
  const [currentId, setCurrentId] = useState('env_dev')

  const create = useCallback((draft: CreateEnvironment) => {
    const created: Environment = {
      id: `env_${Math.random().toString(36).slice(2, 10)}`,
      name: draft.name,
      type: draft.type,
    }
    setEnvironments((previous) => [...previous, created])
    // Switching to what you just made is the only reason to have made it.
    setCurrentId(created.id)
  }, [])

  const shell = environments.map(toShell)

  return {
    environments: shell,
    current: shell.find((e) => e.id === currentId) ?? shell[0]!,
    select: setCurrentId,
    create,
    canCreateProduction: false,
  }
}
