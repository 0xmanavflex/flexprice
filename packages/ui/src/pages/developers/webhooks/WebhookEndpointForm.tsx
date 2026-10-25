import { useCalmForm } from '@ui/compositions/forms/useCalmForm'
import { Controller, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { FlaskConicalIcon } from '@ui/icons'
import {
  type CreateWebhookEndpoint,
  type WebhookEventType,
  createWebhookEndpointSchema,
  emptyWebhookEndpoint,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Textarea } from '@ui/components/primitives/textarea'
import { FormCard, FormRow } from '@ui/compositions/forms/FormCard'
import { FormPage } from '@ui/compositions/forms/FormPage'
import type { DetailCrumb } from '@ui/compositions/detail/DetailShell'
import { provenance } from '@ui/provenance'
import { WebhookEventTypePicker } from './WebhookEventTypePicker'

/**
 * New endpoint: Svix's "Add Endpoint" page.
 *
 * The URL, an optional description, and which event types to subscribe to.
 * "Use Svix Play" fills the URL with a throwaway public inbox, for trying the
 * integration before a receiver exists (V1 offers the same).
 */
export const WebhookEndpointFormProvenance = provenance({
  source: 'composition',
  composes: [
    'ui/input',
    'ui/textarea',
    'compositions/form-card',
    'compositions/form-page',
    'pages/webhooks/WebhookEventTypePicker',
  ],
  note: 'RHF + the domain schema. Create only; the detail page edits.',
})

export interface WebhookEndpointFormProps {
  eventTypes: WebhookEventType[]
  eventTypesLoading?: boolean
  onSubmit: (endpoint: CreateWebhookEndpoint) => void
  onCancel?: () => void
  /** Resolves with a test URL to drop into the field. Omit to hide the shortcut. */
  onGeneratePlayUrl?: () => Promise<string>
  isGeneratingPlayUrl?: boolean
  isSubmitting?: boolean
  submitError?: string | null
  trail: DetailCrumb[]
}

const FORM_ID = 'webhook-endpoint-form'

export function WebhookEndpointForm({
  eventTypes,
  eventTypesLoading = false,
  onSubmit,
  onCancel,
  onGeneratePlayUrl,
  isGeneratingPlayUrl = false,
  isSubmitting = false,
  submitError = null,
  trail,
}: WebhookEndpointFormProps) {
  const form = useCalmForm<CreateWebhookEndpoint>({
    resolver: standardSchemaResolver(
      createWebhookEndpointSchema,
    ) as Resolver<CreateWebhookEndpoint>,
    defaultValues: emptyWebhookEndpoint(),
  })
  const errors = form.formState.errors

  return (
    <FormPage
      title="Add endpoint"
      trail={trail}
      width="narrow"
      toolbar={{
        mode: 'create',
        noun: 'endpoint',
        formId: FORM_ID,
        onCancel,
        isSubmitting,
        submitError,
      }}
    >
      <form id={FORM_ID} onSubmit={form.handleSubmit((values) => onSubmit(values))} noValidate>
        <div className="flex flex-col gap-6">
          <FormCard title="Endpoint" status="required">
            <FormRow
              label="Endpoint URL"
              hint="Where Flexprice sends each event, as an HTTPS POST."
              required
              error={errors.url?.message}
            >
              {({ id, ...field }) => (
                <div className="flex flex-col gap-2">
                  <Input
                    id={id}
                    placeholder="https://example.com/webhooks/flexprice"
                    disabled={isSubmitting}
                    {...field}
                    {...form.register('url')}
                  />
                  {onGeneratePlayUrl ? (
                    <div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isSubmitting || isGeneratingPlayUrl}
                        onClick={() =>
                          void onGeneratePlayUrl()
                            .then((url) =>
                              form.setValue('url', url, {
                                shouldValidate: true,
                                shouldDirty: true,
                              }),
                            )
                            // The page reports the failure; the field just stays as it was.
                            .catch(() => undefined)
                        }
                      >
                        <FlaskConicalIcon aria-hidden />
                        {isGeneratingPlayUrl ? 'Creating a test URL…' : 'Use a Svix Play test URL'}
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
            </FormRow>
            <FormRow
              label="Description"
              hint="Optional. Who owns this endpoint, or what it feeds."
              error={errors.description?.message}
              align="start"
            >
              {({ id, ...field }) => (
                <Textarea
                  id={id}
                  rows={3}
                  placeholder="Production billing sync"
                  disabled={isSubmitting}
                  {...field}
                  {...form.register('description')}
                />
              )}
            </FormRow>
          </FormCard>

          <FormCard title="Subscribe to events" status="optional">
            <div className="px-5 py-4 sm:px-6">
              <Controller
                control={form.control}
                name="filterTypes"
                render={({ field }) => (
                  <WebhookEventTypePicker
                    eventTypes={eventTypes}
                    isLoading={eventTypesLoading}
                    selected={field.value}
                    onChange={field.onChange}
                    disabled={isSubmitting}
                  />
                )}
              />
            </div>
          </FormCard>
        </div>
      </form>
    </FormPage>
  )
}
