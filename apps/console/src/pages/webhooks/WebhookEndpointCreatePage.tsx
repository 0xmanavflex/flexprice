import { useCreateWebhookEndpoint, useGenerateSvixPlayUrl, useWebhookEventTypes } from '@fp/query'
import { WebhookEndpointForm, toast } from '@fp/ui/pages'
import { WebhookPortalGate } from './WebhookPortalGate'

export interface WebhookEndpointCreatePageProps {
  onCancel: () => void
  onCreated: (endpointId: string) => void
}

/** Add an endpoint: Svix's "Add Endpoint", with V1's Svix Play shortcut. */
export function WebhookEndpointCreatePage(props: WebhookEndpointCreatePageProps) {
  return (
    <WebhookPortalGate>
      {(environmentId) => <CreateEndpoint {...props} environmentId={environmentId} />}
    </WebhookPortalGate>
  )
}

function CreateEndpoint({
  environmentId,
  onCancel,
  onCreated,
}: WebhookEndpointCreatePageProps & { environmentId: string }) {
  const eventTypes = useWebhookEventTypes(environmentId)
  const create = useCreateWebhookEndpoint(environmentId)
  const play = useGenerateSvixPlayUrl()

  return (
    <WebhookEndpointForm
      eventTypes={eventTypes.data ?? []}
      eventTypesLoading={eventTypes.isPending}
      trail={[{ label: 'Webhooks', onClick: onCancel }, { label: 'Add endpoint' }]}
      onCancel={onCancel}
      isSubmitting={create.isPending}
      submitError={create.error?.message ?? null}
      onSubmit={(draft) =>
        create.mutate(draft, {
          onSuccess: (endpoint) => {
            toast.success('Endpoint added')
            onCreated(endpoint.id)
          },
        })
      }
      isGeneratingPlayUrl={play.isPending}
      onGeneratePlayUrl={async () => {
        try {
          const { ingestUrl } = await play.mutateAsync()
          return ingestUrl
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Could not create a test URL.')
          throw error
        }
      }}
    />
  )
}
