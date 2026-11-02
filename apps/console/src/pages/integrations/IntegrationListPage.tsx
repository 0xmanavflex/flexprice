import { useState } from 'react'
import {
  ApiError,
  useConnectIntegration,
  useDisconnectIntegration,
  useIntegrations,
  useStartOAuth,
  useUpdateConnection,
} from '@fp/query'
import { oauthRedirectUri, type ConnectionPayload, type Integration } from '@fp/domain'
import {
  ConnectIntegrationSheet,
  IntegrationLogo,
  IntegrationsBlock,
  ManageConnectionSheet,
  toast,
  type ConnectionContext,
} from '@fp/ui/pages'
import { useFlexpriceServerURL } from '@fp/query'
import { useSession } from '@/app/session'
import { env } from '@/env'
import { toListFailure } from '@/pages/shared/listFailure'
import { savePendingOAuth } from './oauthSession'

function messageOf(error: unknown): string {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : 'Something went wrong. Try again.'
}

export function IntegrationListPage() {
  const integrations = useIntegrations()
  const failure = toListFailure(integrations.error, 'integrations')
  const { session, environmentId } = useSession()
  const serverURL = useFlexpriceServerURL()

  const [connecting, setConnecting] = useState<string | null>(null)
  const [managing, setManaging] = useState<string | null>(null)

  const connect = useConnectIntegration()
  const startOAuth = useStartOAuth()
  const update = useUpdateConnection()
  const disconnect = useDisconnectIntegration()

  const find = (id: string | null): Integration | null =>
    id === null ? null : (integrations.data?.find((item) => item.id === id) ?? null)
  const connectTarget = find(connecting)
  const manageTarget = find(managing)

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

  return (
    <>
      <IntegrationsBlock
        integrations={integrations.data ?? []}
        // `isLoading`, not `isPending`: the request is in flight, not merely unanswered.
        isLoading={integrations.isLoading}
        error={failure}
        onRetry={() => void integrations.refetch()}
        isRetrying={integrations.isRefetching}
        onConnect={(integration) => setConnecting(integration.id)}
        onConfigure={(integration) => setManaging(integration.id)}
      />

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
  )
}
