import { useState, type ReactNode } from 'react'
import {
  ApiError,
  useConnectIntegration,
  useDisconnectIntegration,
  useFlexpriceServerURL,
  useStartOAuth,
  useUpdateConnection,
} from '@fp/query'
import {
  oauthRedirectUri,
  type ConnectionPayload,
  type Integration,
  type IntegrationConnection,
} from '@fp/domain'
import {
  ConnectIntegrationSheet,
  IntegrationLogo,
  ManageConnectionSheet,
  toast,
  type ConnectionContext,
} from '@fp/ui/pages'
import { useSession } from '@/app/session'
import { env } from '@/env'
import { savePendingOAuth } from './oauthSession'

function messageOf(error: unknown): string {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : 'Something went wrong. Try again.'
}

/** The connect and manage sheets of the integrations pages, with the mutations behind them. */
export function useIntegrationSheets(integrations: Integration[]): {
  openConnect: (integrationId: string) => void
  openManage: (integrationId: string, connectionId: string) => void
  sheets: ReactNode
} {
  const { session, environmentId } = useSession()
  const serverURL = useFlexpriceServerURL()

  const [connecting, setConnecting] = useState<string | null>(null)
  const [managing, setManaging] = useState<{ integrationId: string; connectionId: string } | null>(
    null,
  )

  const connect = useConnectIntegration()
  const startOAuth = useStartOAuth()
  const update = useUpdateConnection()
  const disconnect = useDisconnectIntegration()

  const connectTarget = integrations.find((item) => item.id === connecting) ?? null
  const manageTarget = integrations.find((item) => item.id === managing?.integrationId) ?? null
  const manageConnection: IntegrationConnection | null =
    manageTarget?.connections.find((item) => item.id === managing?.connectionId) ?? null

  const context: ConnectionContext = {
    webhookBaseUrl: serverURL,
    tenantId: session?.tenantId ?? '',
    environmentId: environmentId ?? '',
    redirectUri: oauthRedirectUri(window.location.origin),
    marketplace: env.marketplace,
  }

  const closeConnect = () => {
    setConnecting(null)
    connect.reset()
    startOAuth.reset()
  }
  const closeManage = () => {
    setManaging(null)
    update.reset()
    disconnect.reset()
  }

  const submitConnect = (payload: ConnectionPayload, spec: { setup: 'credentials' | 'oauth' }) => {
    const name = connectTarget?.name ?? 'The integration'
    if (spec.setup === 'oauth') {
      startOAuth.mutate(payload, {
        onSuccess: ({ oauthUrl, sessionId }) => {
          savePendingOAuth({
            provider: payload.provider_type,
            sessionId,
            organizationId: payload.metadata?.organization_id,
          })
          window.location.assign(oauthUrl)
        },
      })
      return
    }
    connect.mutate(payload, {
      onSuccess: () => {
        toast(`${name} connected`)
        closeConnect()
      },
    })
  }

  const connectError = connect.error ?? startOAuth.error

  return {
    openConnect: setConnecting,
    openManage: (integrationId, connectionId) => setManaging({ integrationId, connectionId }),
    sheets: (
      <>
        <ConnectIntegrationSheet
          integration={connectTarget}
          logo={connectTarget ? <IntegrationLogo integration={connectTarget} /> : null}
          context={context}
          onClose={closeConnect}
          onSubmit={submitConnect}
          isPending={connect.isPending || startOAuth.isPending || startOAuth.isSuccess}
          error={connectError ? messageOf(connectError) : null}
        />

        <ManageConnectionSheet
          integration={manageTarget}
          connection={manageConnection}
          logo={manageTarget ? <IntegrationLogo integration={manageTarget} /> : null}
          context={context}
          onClose={closeManage}
          onSave={(id, changes) =>
            update.mutate(
              { id, ...changes },
              { onSuccess: () => toast(`${manageTarget?.name ?? 'Connection'} updated`) },
            )
          }
          onDisconnect={(id) =>
            disconnect.mutate(id, {
              onSuccess: () => {
                toast(`${manageTarget?.name ?? 'Integration'} disconnected`)
                closeManage()
              },
            })
          }
          isSaving={update.isPending}
          isDisconnecting={disconnect.isPending}
          saveError={update.error ? messageOf(update.error) : null}
          disconnectError={disconnect.error ? messageOf(disconnect.error) : null}
        />
      </>
    ),
  }
}
