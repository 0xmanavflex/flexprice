import { type ReactNode, useEffect, useRef } from 'react'
import { useRecordEnvironment } from '@fp/query'
import { PageBody, PageLoadingState } from '@fp/ui/compositions'
import { Toaster, toast } from '@fp/ui/pages'
import { env } from '@/env'
import { useSession } from '@/app/session'
import { useEnvironments } from '@/app/shell/useEnvironments'

/** The toaster for "Switched to …": shell-wide, so it shows on the page that remounts after the switch. */
export const ENVIRONMENT_TOASTER_ID = 'environment-switch'

export function EnvironmentToaster() {
  return <Toaster id={ENVIRONMENT_TOASTER_ID} position="bottom-right" />
}

/**
 * A record this environment does not have, looked for in the others.
 *
 * A link names a record (`/invoices/inv_1`), not the environment it lives in,
 * so whoever opens it: a teammate, or the same person after signing in on a
 * fresh browser: is in whichever environment their console last used. Record
 * ids are unique across environments, so before saying "not found" this asks
 * the other environments the person can reach. When one has it, the console
 * switches there (the page remounts on the switch and loads the record) and
 * says so. Only when none has it is the page really not found.
 */
export function RecordElsewhere({
  path,
  noun,
  notFound,
}: {
  /** The record's API path, e.g. `/invoices/inv_1`. */
  path: string
  /** "this invoice". */
  noun: string
  /** What to show when no environment has it. */
  notFound: ReactNode
}) {
  const { session } = useSession()
  const { environments, current, select } = useEnvironments()
  const token = env.apiKey ?? session?.token ?? null
  const others = environments.filter((e) => e.id && e.id !== current.id).map((e) => e.id)
  const located = useRecordEnvironment(token, path, others)
  const found = located.data ?? null
  const switched = useRef(false)

  useEffect(() => {
    if (!found || switched.current) return
    switched.current = true
    const name = environments.find((e) => e.id === found)?.name ?? 'another environment'
    select(found)
    toast(`Switched to ${name}`, {
      description: `${noun.charAt(0).toUpperCase()}${noun.slice(1)} is in ${name}.`,
      toasterId: ENVIRONMENT_TOASTER_ID,
    })
  }, [found, environments, select, noun])

  const searching = others.length > 0 && (located.isPending || found !== null)
  if (searching) {
    return (
      <PageBody>
        <PageLoadingState
          variant="detail"
          label={`Looking for ${noun} in your other environments`}
        />
      </PageBody>
    )
  }
  return <>{notFound}</>
}
