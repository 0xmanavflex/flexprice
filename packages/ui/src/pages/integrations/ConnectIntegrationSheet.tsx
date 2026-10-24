import { useCalmForm } from '@ui/compositions/forms/useCalmForm'
import type { ReactNode } from 'react'
import { type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { ArrowUpRightIcon, InfoIcon, TriangleAlert } from '@ui/icons'
import {
  type ConnectionFormValues,
  type ConnectionPayload,
  type ConnectionSpec,
  type ConnectStep,
  type Integration,
  connectSteps,
  connectionFormSchema,
  connectionSpecFor,
  defaultConnectionValues,
  fieldsForStep,
  toConnectionPayload,
  webhookEvents,
  webhookUrl,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Spinner } from '@ui/components/primitives/spinner'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@ui/components/primitives/sheet'
import { Alert, AlertDescription, AlertTitle } from '@ui/components/reui/alert'
import {
  CodeBlock,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from '@ui/components/reui/code-block/code-block'
import { Field } from '@ui/compositions/forms/Field'
import { useFormSteps } from '@ui/compositions/forms/useFormSteps'
import { WorkflowStepper } from '@ui/compositions/forms/WorkflowStepper'
import { provenance } from '@ui/provenance'
import { SpecField, SyncOptions, WebhookGuide } from './ConnectionFields'

/**
 * Connect a provider. One sheet, one form, steps only where the provider has
 * something to choose or register:
 *
 *   Credentials  name and keys, from the provider's spec
 *   Sync         what Flexprice sends or pulls, off until switched on
 *   Webhook      the address to register, then the signing secret it yields
 *
 * The webhook secret comes last on purpose. V1 asks for it in the same long
 * form as the API keys, which forces the reader to leave, create the endpoint
 * and come back; here the URL and events are on screen first and the secret
 * field sits beside them.
 *
 * Presentational: the page owns the request. `onSubmit` receives the API body;
 * for QuickBooks and Zoho the page sends it to `/oauth/init` and redirects.
 */
export const ConnectIntegrationSheetProvenance = provenance({
  source: 'composition',
  composes: [
    'primitives/sheet',
    'compositions/workflow-stepper',
    'compositions/Field',
    'pages/integrations/ConnectionFields',
    'reui/alert',
    'reui/code-block',
  ],
  note: 'Schema-driven connect sheet: a stepper over a provider spec, write-only secrets, and the webhook address before its signing secret.',
})

/** What the sheet needs to show addresses it cannot know itself. */
export interface ConnectionContext {
  /** The API base the provider posts webhooks to (the console's server URL). */
  webhookBaseUrl: string
  tenantId: string
  environmentId: string
  /** Where QuickBooks and Zoho send the reader back after consent. */
  redirectUri: string
}

export interface ConnectIntegrationSheetProps {
  /** The integration being connected. `null` closes the sheet. */
  integration: Integration | null
  logo: ReactNode
  context: ConnectionContext
  onClose: () => void
  onSubmit: (payload: ConnectionPayload, spec: ConnectionSpec) => void
  isPending?: boolean
  /** The API's reason the last attempt failed, shown above the form. */
  error?: string | null
}

const STEP_TITLE: Record<ConnectStep, string> = {
  credentials: 'Credentials',
  sync: 'Sync',
  webhook: 'Webhook',
}

export function ConnectIntegrationSheet({
  integration,
  logo,
  context,
  onClose,
  onSubmit,
  isPending = false,
  error = null,
}: ConnectIntegrationSheetProps) {
  const spec = integration ? connectionSpecFor(integration.providerType) : undefined
  return (
    <Sheet open={integration !== null} onOpenChange={(open) => !open && !isPending && onClose()}>
      <SheetContent className="gap-0">
        {integration ? (
          spec ? (
            <ConnectForm
              key={integration.id}
              integration={integration}
              spec={spec}
              logo={logo}
              context={context}
              onClose={onClose}
              onSubmit={onSubmit}
              isPending={isPending}
              error={error}
            />
          ) : (
            <>
              <SheetHeader>
                <SheetTitle>{integration.name}</SheetTitle>
                <SheetDescription>
                  {integration.name} is not self-serve yet. Contact us to set it up.
                </SheetDescription>
              </SheetHeader>
            </>
          )
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function ConnectForm({
  integration,
  spec,
  logo,
  context,
  onClose,
  onSubmit,
  isPending,
  error,
}: Omit<ConnectIntegrationSheetProps, 'integration'> & {
  integration: Integration
  spec: ConnectionSpec
  isPending: boolean
  error: string | null
}) {
  const stepIds = connectSteps(spec)
  const form = useCalmForm<ConnectionFormValues>({
    resolver: standardSchemaResolver(
      connectionFormSchema(spec),
    ) as unknown as Resolver<ConnectionFormValues>,
    defaultValues: defaultConnectionValues(spec, integration.name),
  })
  const { control, register, watch, trigger, formState } = form
  const { errors } = formState

  const fieldNames = (step: ConnectStep) =>
    step === 'sync'
      ? []
      : [
          ...(step === 'credentials' ? (['name'] as const) : []),
          ...fieldsForStep(spec, step).map((f) => `fields.${f.key}` as const),
        ]

  const flow = useFormSteps({
    steps: stepIds.map((id) => ({ id, title: STEP_TITLE[id] })),
    validate: (id) => trigger(fieldNames(id as ConnectStep)),
  })
  const step = flow.step as ConnectStep
  const multi = stepIds.length > 1

  const submit = form.handleSubmit(
    (values) => onSubmit(toConnectionPayload(spec, values), spec),
    (invalid) => {
      const failing = stepIds.find((id) =>
        fieldNames(id).some((name) => {
          const [, key] = name.split('.')
          return name === 'name'
            ? invalid.name
            : key
              ? (invalid.fields as Record<string, unknown> | undefined)?.[key]
              : false
        }),
      )
      if (failing) flow.goTo(failing)
    },
  )

  const sync = watch('sync')
  const webhook = spec.webhook
    ? {
        url: webhookUrl(
          context.webhookBaseUrl,
          spec.providerType,
          context.tenantId,
          context.environmentId,
        ),
        events: webhookEvents(spec, sync),
      }
    : null
  const externalId = `${context.tenantId}_${context.environmentId}`
  const lastLabel =
    spec.setup === 'oauth' ? `Continue to ${integration.name}` : `Connect ${integration.name}`

  return (
    <form
      id="connect-integration"
      onSubmit={flow.guardSubmit(submit)}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
    >
      <SheetHeader>
        <div className="flex items-center gap-3">
          <span className="bg-background dark:bg-foreground dark:text-background flex size-10 shrink-0 items-center justify-center rounded-lg border p-1.5 shadow-xs dark:border-transparent">
            {logo}
          </span>
          <div className="min-w-0">
            <SheetTitle>Connect {integration.name}</SheetTitle>
            <SheetDescription>{integration.description}</SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
        {multi ? (
          <WorkflowStepper
            steps={flow.workflow}
            currentStep={flow.step}
            onStepChange={flow.goTo}
            aria-label={`Connect ${integration.name}`}
          />
        ) : null}

        {error ? (
          <Alert variant="destructive" role="alert">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>{integration.name} was not connected</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {step === 'credentials' ? (
          <div className="flex flex-col gap-5">
            {spec.prerequisites?.map((line) => (
              <Alert key={line} variant="info">
                <InfoIcon aria-hidden="true" />
                <AlertDescription>{line}</AlertDescription>
              </Alert>
            ))}
            {spec.setup === 'oauth' ? (
              <CodeBlock code={context.redirectUri} language="text" label="Redirect URI">
                <CodeBlockHeader>
                  <CodeBlockTitle>Redirect URI</CodeBlockTitle>
                  <CodeBlockCopyButton className="ml-auto" />
                </CodeBlockHeader>
              </CodeBlock>
            ) : null}
            {spec.providerType === 'aws_marketplace' ? (
              <CodeBlock code={externalId} language="text" label="External ID">
                <CodeBlockHeader>
                  <CodeBlockTitle>External ID</CodeBlockTitle>
                  <CodeBlockCopyButton className="ml-auto" />
                </CodeBlockHeader>
              </CodeBlock>
            ) : null}

            <Field label="Connection name" required error={errors.name?.message}>
              {(aria) => <Input {...aria} autoComplete="off" {...register('name')} />}
            </Field>
            {fieldsForStep(spec, 'credentials').map((field) => (
              <SpecField key={field.key} field={field} control={control} errors={errors} />
            ))}
            <p className="text-muted-foreground flex items-start gap-2 text-xs">
              <InfoIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              Keys are encrypted and never shown again. To change one later, disconnect and connect
              again.
            </p>
            {spec.credentialHelp ? (
              <a
                href={spec.credentialHelp}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-[13px] underline-offset-4 hover:underline"
              >
                Where to find these values
                <ArrowUpRightIcon className="size-3.5" aria-hidden="true" />
              </a>
            ) : null}
          </div>
        ) : null}

        {step === 'sync' ? (
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-[13px]">
              Choose what moves between Flexprice and {integration.name}. Nothing syncs until you
              switch it on, and you can change this later.
            </p>
            <SyncOptions options={spec.sync} control={control} />
          </div>
        ) : null}

        {step === 'webhook' && webhook ? (
          <div className="flex flex-col gap-5">
            <p className="text-muted-foreground text-[13px]">
              In {integration.name}, add a webhook that posts to this address and sends these
              events. It will give you a signing secret: enter it below so Flexprice can verify each
              event.
            </p>
            <WebhookGuide spec={spec} url={webhook.url} events={webhook.events} />
            {fieldsForStep(spec, 'webhook').map((field) => (
              <SpecField key={field.key} field={field} control={control} errors={errors} />
            ))}
          </div>
        ) : null}
      </div>

      <SheetFooter className="border-t">
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          {multi && !flow.isFirst ? (
            <Button type="button" variant="outline" onClick={flow.back} disabled={isPending}>
              Back
            </Button>
          ) : null}
          {flow.isLast ? (
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner aria-hidden="true" /> : null}
              {isPending ? 'Connecting…' : lastLabel}
            </Button>
          ) : (
            <Button type="submit">Continue</Button>
          )}
        </div>
      </SheetFooter>
    </form>
  )
}
