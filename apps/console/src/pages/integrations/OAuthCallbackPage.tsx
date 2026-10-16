import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ApiError, useCompleteOAuth } from '@fp/query'
import { Button } from '@fp/ui/primitives'
import { ErrorState, PageBody, PageLoadingState } from '@fp/ui/compositions'
import { toast } from '@fp/ui/pages'
import { clearPendingOAuth, readPendingOAuth } from './oauthSession'

const NAMES: Record<string, string> = { quickbooks: 'QuickBooks', zoho_books: 'Zoho Books' }

/**
 * Where QuickBooks and Zoho send the reader back after consent. The address
 * carries the one-time code; this page hands it to the API with the session
 * the connect sheet saved, then returns to the gallery.
 */
export function OAuthCallbackPage() {
  const navigate = useNavigate()
  const complete = useCompleteOAuth()
  const started = useRef(false)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const params = new URLSearchParams(window.location.search)
    const pending = readPendingOAuth()
    const provider = pending?.provider ?? (params.get('realmId') ? 'quickbooks' : 'zoho_books')
    const name = NAMES[provider] ?? 'The provider'
    const code = params.get('code')
    const state = params.get('state')
    const realmId = params.get('realmId')
    const denied = params.get('error')

    const fail = (message: string) => setProblem(message)

    if (denied) return fail(`${name} did not grant access (${denied}).`)
    if (!code || !state) return fail(`${name} did not send back what is needed to finish.`)
    if (!pending) return fail('This connection attempt expired. Start again from Integrations.')
    if (provider === 'quickbooks' && !realmId) return fail('QuickBooks did not send a company ID.')
    if (provider === 'zoho_books' && !pending.organizationId)
      return fail('The Zoho organisation ID was lost. Start again from Integrations.')

    complete.mutate(
      {
        provider,
        session_id: pending.sessionId,
        code,
        state,
        ...(realmId ? { realm_id: realmId } : {}),
        ...(provider === 'zoho_books' && pending.organizationId
          ? { organization_id: pending.organizationId }
          : {}),
      },
      {
        onSuccess: () => {
          clearPendingOAuth()
          toast(`${name} connected`)
          void navigate({ to: '/integrations' })
        },
        onError: (error) =>
          fail(error instanceof ApiError || error instanceof Error ? error.message : 'Try again.'),
      },
    )
  }, [complete, navigate])

  if (problem) {
    return (
      <PageBody>
        <ErrorState
          variant="page"
          title="The integration was not connected"
          description={`${problem} If you started the connection and it failed, remove the half-finished entry under Integrations before trying again.`}
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                clearPendingOAuth()
                void navigate({ to: '/integrations' })
              }}
            >
              Back to integrations
            </Button>
          }
        />
      </PageBody>
    )
  }
  return <PageLoadingState label="Finishing the connection" />
}
