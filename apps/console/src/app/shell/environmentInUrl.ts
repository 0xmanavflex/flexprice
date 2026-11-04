import { useEffect, useRef } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { toast } from '@fp/ui/pages'
import { ENVIRONMENT_TOASTER_ID } from '@/pages/shared/RecordElsewhere'
import type { UseEnvironments } from './useEnvironments'
import { ENVIRONMENT_PARAM, parseEnvironmentParam } from './environmentParam'

export { ENVIRONMENT_PARAM, parseEnvironmentParam }

/**
 * Keeps the address and the environment in step, from the shell.
 *
 * - A link that names an environment the person can reach switches the console
 *   there once, on arrival, and says so ("Switched to Production"). An
 *   environment they cannot reach is ignored: the page opens in their own.
 * - After that the address follows the console: it always names the
 *   environment in use, including after a switch from the switcher, so a link
 *   copied from the address bar opens the same view for whoever receives it.
 *
 * The id is carried across navigation by the shell route's
 * `retainSearchParams`, so in-app links need not add it; the replace below only
 * corrects the address when it is missing or stale.
 */
export function useEnvironmentInUrl({ environments, current, select }: UseEnvironments) {
  const navigate = useNavigate()
  const search = useRouterState({ select: (state) => state.location.search }) as Record<
    string,
    unknown
  >
  const linked = parseEnvironmentParam(search).env
  // The link's environment is honoured once, on arrival: after that the
  // switcher and the address follow the console, not the other way round.
  const arrived = useRef(false)

  useEffect(() => {
    // Wait for the list: it says which environments exist and which is in use.
    if (!current.id || environments.length === 0) return

    if (!arrived.current) {
      arrived.current = true
      if (linked && linked !== current.id) {
        const target = environments.find((environment) => environment.id === linked)
        if (target) {
          select(target.id)
          toast(`Switched to ${target.name}`, {
            description: 'The link you opened is in this environment.',
            toasterId: ENVIRONMENT_TOASTER_ID,
          })
          return
        }
      }
    }

    if (linked !== current.id) {
      void navigate({
        to: '.',
        search: (previous: Record<string, unknown>) => ({
          ...previous,
          [ENVIRONMENT_PARAM]: current.id,
        }),
        replace: true,
      } as never)
    }
  }, [linked, current.id, environments, select, navigate])
}
