import { useState, type ReactNode } from 'react'
import {
  ApiError,
  useEnvironmentList,
  useConnectIntegration,
  useDisconnectIntegration,
  useFlexpriceServerURL,
  useStartOAuth,
  useUpdateConnection,
} from '@fp/query'
import {
  oauthRedirectUri,
  type BillingEntity,
  type ConnectionPayload,
  type ConnectionSpec,
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

/**
 * The connect and manage sheets of the integrations pages, with the mutations
 * behind them. `entities` is given only while billing entities are enabled.
 */
export function useIntegrationSheets(
  integrations: Integration[],
  entities?: readonly Pick<BillingEntity, 'id' | 'name' | 'isDefault'>[],
): {
  openConnect: (integrationId: string, billingEntityId?: string) => void
  openManage: (integrationId: string, connectionId: string) => void
  sheets: ReactNode
} {
  const { session, environmentId } = useSession()
  const serverURL = useFlexpriceServerURL()
  const environmentList = useEnvironmentList(env.apiKey ?? session?.token ?? null)
  const activeEnvironment = environmentList.data?.find(
    (environment) => environment.id === environmentId,
  )

  const [connecting, setConnecting] = useState<{
    integrationId: string
    billingEntityId?: string | undefined
  } | null>(null)
  const [managing, setManaging] = useState<{ integrationId: string; connectionId: string } | null>(
    null,
  )

  const connect = useConnectIntegration()
  const startOAuth = useStartOAuth()
  const update = useUpdateConnection()
  const disconnect = useDisconnectIntegration()

  const connectTarget = integrations.find((item) => item.id === connecting?.integrationId) ?? null
  const manageTarget = integrations.find((item) => item.id === managing?.integrationId) ?? null
  const manageConnection: IntegrationConnection | null =
    manageTarget?.connections.find((item) => item.id === managing?.connectionId) ?? null

  const context: ConnectionContext = {
    webhookBaseUrl: serverURL,
    environmentType: activeEnvironment?.type,
    tenantId: session?.tenantId ?? '',
    environmentId: environmentId ?? '',
    redirectUri: oauthRedirectUri(window.location.origin),
    marketplace: env.marketplace,
  }

  const closeConnect = () => {
    setConnecting(null)
    connect.reset()
    startOAuth.reset()
    update.reset()
  }
  const closeManage = () => {
    setManaging(null)
    update.reset()
    disconnect.reset()
  }

  const submitConnect = async (
    payload: ConnectionPayload,
    spec: ConnectionSpec,
  ): Promise<string | null> => {
    if (spec.setup === 'oauth') {
      const { oauthUrl, sessionId } = await startOAuth.mutateAsync(payload)
      savePendingOAuth({
        provider: payload.provider_type,
        sessionId,
        organizationId: payload.metadata?.organization_id,
      })
      window.location.assign(oauthUrl)
      return null
    }
    const created = await connect.mutateAsync(payload)
    return created.id
  }

  const connectError = connect.error ?? startOAuth.error

  return {
    openConnect: (integrationId, billingEntityId) => {
      if (integrationId === 'quickbooks' && !activeEnvironment) {
        toast('Wait for the environment to load before connecting QuickBooks.')
        return
      }
      setConnecting({ integrationId, billingEntityId })
    },
    openManage: (integrationId, connectionId) => setManaging({ integrationId, connectionId }),
    sheets: (
      <>
        <ConnectIntegrationSheet
          integration={connectTarget}
          logo={connectTarget ? <IntegrationLogo integration={connectTarget} /> : null}
          context={context}
          entities={entities}
          billingEntityId={connecting?.billingEntityId}
          onClose={closeConnect}
          onSubmit={submitConnect}
          onConnected={() => toast(`${connectTarget?.name ?? 'The integration'} connected`)}
          isPending={connect.isPending || startOAuth.isPending || startOAuth.isSuccess}
          error={connectError ? messageOf(connectError) : null}
        />

        <ManageConnectionSheet
          integration={manageTarget}
          connection={manageConnection}
          logo={manageTarget ? <IntegrationLogo integration={manageTarget} /> : null}
          context={context}
          entities={entities}
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
