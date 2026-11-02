import { useCalmForm } from '@ui/compositions/forms/useCalmForm'
import { useState, type ReactNode } from 'react'
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
  connectionForEntity,
  fieldsForStep,
  newConnectionId,
  toConnectionPayload,
  webhookEvents,
  webhookUrl,
  rotatableFields,
  awsPermissionsPolicy,
  awsTrustPolicy,
  gcpSetupScript,
  marketplaceExternalId,
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
import type { ListBillingEntity } from '../shared/billingEntityColumn'
import { BillingEntityField, SpecField, SyncOptions, WebhookGuide } from './ConnectionFields'

/**
 * Connect a provider. Steps only where the provider has something to choose or
 * register:
 *
 *   Credentials  name and keys (and, with entities on, the billing entity)
 *   Sync         what Flexprice sends or pulls, off until switched on
 *   Webhook      the address to register, then the signing secret it yields
 *
 * The webhook secret comes last on purpose: the URL and events are on screen
 * first and the secret field sits beside them. With entities off, one submit
 * at the end creates the connection with the secret. With them on, each
 * connection has its own address ending with its id, so the connection is
 * created on leaving the step before Webhook and the secret is saved onto it;
 * "Do this later" leaves it without one, and Configure shows the same address.
 *
 * Presentational: the page owns the requests. `onSubmit` receives the API body
 * and resolves to the new connection's id, or `null` when QuickBooks and Zoho
 * hand the reader to the provider (with entities on, their webhook is set up
 * from Configure).
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
  /**
   * Flexprice's own AWS account and metering role, which the AWS trust policy
   * and the GCP federation script name. Unset, those steps say so.
   */
  marketplace?: { awsAccountId: string | null; awsRoleName: string | null } | undefined
}

export interface ConnectIntegrationSheetProps {
  /** The integration being connected. `null` closes the sheet. */
  integration: Integration | null
  logo: ReactNode
  context: ConnectionContext
  onClose: () => void
  /** Creates the connection; resolves to its id, or `null` when the reader leaves for the provider. */
  onSubmit: (payload: ConnectionPayload, spec: ConnectionSpec) => Promise<string | null>
  /** The connection exists. */
  onConnected?: ((connectionId: string) => void) | undefined
  /** The environment's billing entities, given only while they are enabled: adds the entity picker and the per-connection webhook. */
  entities?: readonly ListBillingEntity[] | undefined
  /** The entity to preselect, e.g. the provider page row's. */
  billingEntityId?: string | undefined
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
  onConnected,
  entities,
  billingEntityId,
  isPending = false,
  error = null,
}: ConnectIntegrationSheetProps) {
  const spec = integration ? connectionSpecFor(integration.providerType) : undefined
  return (
    <Sheet open={integration !== null} onOpenChange={(open) => !open && !isPending && onClose()}>
      <SheetContent className="gap-0">
        {integration ? (
          spec ? (
            <ConnectFlow
              key={integration.id}
              integration={integration}
              spec={spec}
              logo={logo}
              context={context}
              onClose={onClose}
              onSubmit={onSubmit}
              onConnected={onConnected}
              entities={entities}
              billingEntityId={billingEntityId}
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

type FlowProps = Omit<ConnectIntegrationSheetProps, 'integration'> & {
  integration: Integration
  spec: ConnectionSpec
  isPending: boolean
  error: string | null
}

/**
 * One form and one submit at the end. With entities on, the connection id is
 * generated when the sheet opens so its own webhook URL shows before create.
 */
function ConnectFlow(props: FlowProps) {
  const perConnectionWebhook = props.entities !== undefined
  const [connectionId] = useState(() => (perConnectionWebhook ? newConnectionId() : undefined))
  return (
    <ConnectForm
      {...props}
      steps={connectSteps(props.spec)}
      perConnectionWebhook={perConnectionWebhook}
      connectionId={connectionId}
      onCreated={(id) => {
        props.onConnected?.(id)
        props.onClose()
      }}
    />
  )
}

function ConnectHeader({ integration, logo }: { integration: Integration; logo: ReactNode }) {
  return (
    <SheetHeader>
      <div className="flex items-center gap-3">
        <span className="bg-background flex size-10 shrink-0 items-center justify-center rounded-lg border p-1.5 shadow-xs">
          {logo}
        </span>
        <div className="min-w-0">
          <SheetTitle>Connect {integration.name}</SheetTitle>
          <SheetDescription>{integration.description}</SheetDescription>
        </div>
      </div>
    </SheetHeader>
  )
}

function ConnectForm({
  integration,
  spec,
  logo,
  context,
  onClose,
  onSubmit,
  onCreated,
  steps,
  perConnectionWebhook,
  connectionId,
  entities,
  billingEntityId,
  isPending,
  error,
}: FlowProps & {
  steps: ConnectStep[]
  perConnectionWebhook: boolean
  connectionId: string | undefined
  onCreated: (id: string) => void
}) {
  const firstFree = entities?.find(
    (entity) => !connectionForEntity(integration, entity.id, entities),
  )
  const form = useCalmForm<ConnectionFormValues>({
    resolver: standardSchemaResolver(
      connectionFormSchema(spec, { entity: entities !== undefined }),
    ) as unknown as Resolver<ConnectionFormValues>,
    defaultValues: {
      ...defaultConnectionValues(spec, integration.name),
      ...(entities ? { billingEntityId: billingEntityId ?? firstFree?.id ?? '' } : {}),
    },
  })
  const { control, register, watch, trigger, formState } = form
  const { errors } = formState

  const fieldNames = (step: ConnectStep) =>
    step === 'sync'
      ? []
      : [
          ...(step === 'credentials' ? (['name'] as const) : []),
          ...(step === 'credentials' && entities ? (['billingEntityId'] as const) : []),
          ...fieldsForStep(spec, step, perConnectionWebhook).map((f) => `fields.${f.key}` as const),
        ]

  const flow = useFormSteps({
    steps: steps.map((id) => ({ id, title: STEP_TITLE[id] })),
    validate: (id) => trigger(fieldNames(id as ConnectStep)),
  })
  const step = flow.step as ConnectStep
  const multi = steps.length > 1

  const submit = form.handleSubmit(
    async (values) => {
      let id: string | null
      try {
        id = await onSubmit(
          toConnectionPayload(spec, values, {
            billingEntityId: entities ? values.billingEntityId : undefined,
            connectionId,
            externalId: marketplaceExternalId(context.tenantId, context.environmentId),
          }),
          spec,
        )
      } catch {
        // The page shows the API's reason through `error`.
        return
      }
      if (id !== null) onCreated(id)
    },
    (invalid) => {
      const failing = steps.find((id) =>
        fieldNames(id).some((name) => {
          const [, key] = name.split('.')
          return name === 'name' || name === 'billingEntityId'
            ? invalid[name]
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
          connectionId,
        ),
        events: webhookEvents(spec, sync),
      }
    : null
  const externalId = marketplaceExternalId(context.tenantId, context.environmentId)
  const awsAccountId = context.marketplace?.awsAccountId ?? null
  const awsRoleName = context.marketplace?.awsRoleName ?? null
  const lastLabel =
    spec.setup === 'oauth' ? `Continue to ${integration.name}` : `Connect ${integration.name}`

  return (
    <form
      id="connect-integration"
      onSubmit={flow.guardSubmit(submit)}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
    >
      <ConnectHeader integration={integration} logo={logo} />

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
        {multi ? (
          // Centred at the width its labels need, not stretched across the sheet.
          <div className="mx-auto w-full max-w-sm">
            <WorkflowStepper
              steps={flow.workflow}
              currentStep={flow.step}
              onStepChange={flow.goTo}
              aria-label={`Connect ${integration.name}`}
            />
          </div>
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
              <>
                <CodeBlock code={externalId} language="text" label="External ID">
                  <CodeBlockHeader>
                    <CodeBlockTitle>External ID</CodeBlockTitle>
                    <CodeBlockCopyButton className="ml-auto" />
                  </CodeBlockHeader>
                </CodeBlock>
                <CodeBlock code={awsPermissionsPolicy()} language="json" label="Permissions policy">
                  <CodeBlockHeader>
                    <CodeBlockTitle>Permissions policy</CodeBlockTitle>
                    <CodeBlockCopyButton className="ml-auto" />
                  </CodeBlockHeader>
                </CodeBlock>
                {awsAccountId ? (
                  <CodeBlock
                    code={awsTrustPolicy(awsAccountId, externalId)}
                    language="json"
                    label="Trust relationship"
                  >
                    <CodeBlockHeader>
                      <CodeBlockTitle>Trust relationship</CodeBlockTitle>
                      <CodeBlockCopyButton className="ml-auto" />
                    </CodeBlockHeader>
                  </CodeBlock>
                ) : (
                  <MarketplaceNotConfigured />
                )}
              </>
            ) : null}
            {spec.providerType === 'gcp_marketplace' ? (
              awsAccountId && awsRoleName ? (
                <CodeBlock
                  code={gcpSetupScript(awsAccountId, awsRoleName)}
                  language="bash"
                  label="Cloud Shell setup"
                >
                  <CodeBlockHeader>
                    <CodeBlockTitle>Run in Cloud Shell</CodeBlockTitle>
                    <CodeBlockCopyButton className="ml-auto" />
                  </CodeBlockHeader>
                </CodeBlock>
              ) : (
                <MarketplaceNotConfigured />
              )
            ) : null}

            {entities ? (
              <BillingEntityField
                integration={integration}
                entities={entities}
                control={control}
                error={errors.billingEntityId?.message}
              />
            ) : null}
            <Field label="Connection name" required error={errors.name?.message}>
              {(aria) => <Input {...aria} autoComplete="off" {...register('name')} />}
            </Field>
            {fieldsForStep(spec, 'credentials', perConnectionWebhook).map((field) => (
              <SpecField key={field.key} field={field} control={control} errors={errors} />
            ))}
            <p className="text-muted-foreground flex items-start gap-2 text-xs">
              <InfoIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              {rotatableFields(spec).length > 0
                ? 'Keys are encrypted and never shown again. You can replace them later from Configure.'
                : 'Keys are encrypted and never shown again. To change one later, disconnect and connect again.'}
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
            {fieldsForStep(spec, 'webhook', perConnectionWebhook).map((field) => (
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

/** Flexprice's own AWS identity is deployment config; without it the setup cannot be shown. */
function MarketplaceNotConfigured() {
  return (
    <Alert variant="warning">
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>Setup details are not configured</AlertTitle>
      <AlertDescription>
        This console does not know Flexprice&apos;s AWS account. Contact support for the values to
        use in the setup.
      </AlertDescription>
    </Alert>
  )
}
