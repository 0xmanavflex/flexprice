import { useEffect, useRef } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { toast } from '@fp/ui/pages'
import { ENVIRONMENT_TOASTER_ID } from '@/pages/shared/RecordElsewhere'
import type { UseEnvironments } from './useEnvironments'
import { ENVIRONMENT_PARAM, parseEnvironmentParam } from './environmentParam'

export { ENVIRONMENT_PARAM, parseEnvironmentParam }

/**
 * Honours a link's environment, then takes it out of the address.
 *
 * - A link that names an environment the person can reach switches the console
 *   there once, on arrival, and says so ("Switched to Production"). An
 *   environment they cannot reach is ignored: the page opens in their own.
 * - Once the console is in the right environment (or the link's cannot be
 *   reached) `?env=` is removed, so it does not ride along on every address
 *   afterwards. Links built for someone else (a payment link's return address)
 *   still add it themselves.
 */
export function useEnvironmentInUrl({ environments, current, select }: UseEnvironments) {
  const navigate = useNavigate()
  const search = useRouterState({ select: (state) => state.location.search }) as Record<
    string,
    unknown
  >
  const linked = parseEnvironmentParam(search).env
  // The link's environment is honoured once, on arrival: after that the
  // switcher decides, and a stale `?env=` is only cleared.
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
          // The param comes off once the switch lands and `current` follows.
          return
        }
      }
    }

    if (linked !== undefined) {
      void navigate({
        to: '.',
        search: (previous: Record<string, unknown>) => {
          const { [ENVIRONMENT_PARAM]: _environment, ...rest } = previous
          return rest
        },
        replace: true,
      } as never)
    }
  }, [linked, current.id, environments, select, navigate])
}
