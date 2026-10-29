import { useCalmForm } from '@ui/compositions/forms/useCalmForm'
import { useState, type ReactNode } from 'react'
import { type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { InfoIcon, TriangleAlert } from '@ui/icons'
import {
  type ConnectionChanges,
  type ConnectionField,
  type ConnectionFormValues,
  type ConnectionSpec,
  type Integration,
  type IntegrationConnection,
  connectionSpecFor,
  connectionToFormValues,
  effectiveEntityId,
  fieldsForStep,
  manageFormSchema,
  rotatableFields,
  toConnectionChanges,
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
import { ConfirmDialog } from '@ui/compositions/feedback/ConfirmDialog'
import { Field } from '@ui/compositions/forms/Field'
import { provenance } from '@ui/provenance'
import type { ListBillingEntity } from '../shared/billingEntityColumn'
import { BillingEntityField, SpecField, SyncOptions, WebhookGuide } from './ConnectionFields'
import type { ConnectionContext } from './ConnectIntegrationSheet'

/**
 * One connection: rename it, move it to another billing entity, change what
 * syncs, copy its webhook address and set its signing secret, replace the few
 * keys the API lets a connection replace, and disconnect.
 *
 * It says what the API cannot do instead of hiding it. Keys are never returned,
 * so there is nothing to reveal; most of them cannot be changed in place, so the
 * sheet says "disconnect and connect again" rather than showing a field that
 * would fail. Disconnecting archives the connection, which is also stated, since
 * the provider's own records are untouched.
 */
export const ManageConnectionSheetProvenance = provenance({
  source: 'composition',
  composes: [
    'primitives/sheet',
    'compositions/Field',
    'compositions/ConfirmDialog',
    'pages/integrations/ConnectionFields',
    'reui/alert',
  ],
  note: 'Manage a connection from its spec: name, sync switches, webhook address, rotatable secrets, and a confirmed disconnect.',
})

export interface ManageConnectionSheetProps {
  /** The connected integration. `null` closes the sheet. */
  integration: Integration | null
  /** The one connection being managed; `null` closes the sheet. */
  connection: IntegrationConnection | null
  logo: ReactNode
  context: ConnectionContext
  /** The environment's billing entities, given only while they are enabled: adds the move and the per-connection webhook. */
  entities?: readonly ListBillingEntity[] | undefined
  onClose: () => void
  onSave: (id: string, changes: ConnectionChanges) => void
  onDisconnect: (id: string) => void
  isSaving?: boolean
  isDisconnecting?: boolean
  saveError?: string | null
  disconnectError?: string | null
}

export function ManageConnectionSheet({
  integration,
  connection,
  logo,
  context,
  entities,
  onClose,
  onSave,
  onDisconnect,
  isSaving = false,
  isDisconnecting = false,
  saveError = null,
  disconnectError = null,
}: ManageConnectionSheetProps) {
  const spec = integration ? connectionSpecFor(integration.providerType) : undefined
  const busy = isSaving || isDisconnecting
  return (
    <Sheet
      open={integration !== null && connection !== null}
      onOpenChange={(open) => !open && !busy && onClose()}
    >
      <SheetContent className="gap-0">
        {integration && connection && spec ? (
          <ManageForm
            key={connection.id}
            integration={integration}
            connection={connection}
            spec={spec}
            logo={logo}
            context={context}
            entities={entities}
            onClose={onClose}
            onSave={onSave}
            onDisconnect={onDisconnect}
            isSaving={isSaving}
            isDisconnecting={isDisconnecting}
            saveError={saveError}
            disconnectError={disconnectError}
          />
        ) : integration && connection ? (
          <SheetHeader>
            <SheetTitle>{integration.name}</SheetTitle>
            <SheetDescription>This connection cannot be managed here.</SheetDescription>
          </SheetHeader>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function ManageForm({
  integration,
  connection,
  spec,
  logo,
  context,
  entities,
  onClose,
  onSave,
  onDisconnect,
  isSaving,
  isDisconnecting,
  saveError,
  disconnectError,
}: Omit<ManageConnectionSheetProps, 'integration' | 'connection'> & {
  integration: Integration
  connection: IntegrationConnection
  spec: ConnectionSpec
  isSaving: boolean
  isDisconnecting: boolean
  saveError: string | null
  disconnectError: string | null
}) {
  const [confirming, setConfirming] = useState(false)
  // Entities on: the connection has its own webhook address and its webhook fields can be set here.
  const perConnectionWebhook = entities !== undefined
  const form = useCalmForm<ConnectionFormValues>({
    resolver: standardSchemaResolver(
      manageFormSchema(spec),
    ) as unknown as Resolver<ConnectionFormValues>,
    defaultValues: {
      ...connectionToFormValues(spec, connection, perConnectionWebhook),
      ...(entities ? { billingEntityId: effectiveEntityId(connection, entities) } : {}),
    },
  })
  const { control, register, watch, formState } = form
  const { errors } = formState

  const webhookFields = perConnectionWebhook ? fieldsForStep(spec, 'webhook', true) : []
  const secrets = rotatableFields(spec).filter((f) => !webhookFields.includes(f))
  const sync = watch('sync')
  const webhook = spec.webhook
    ? {
        url: webhookUrl(
          context.webhookBaseUrl,
          spec.providerType,
          context.tenantId,
          context.environmentId,
          perConnectionWebhook ? connection.id : undefined,
        ),
        events: webhookEvents(spec, sync),
      }
    : null

  const save = form.handleSubmit((values) => {
    const changes = toConnectionChanges(spec, connection, values, entities)
    if (Object.keys(changes).length > 0) onSave(connection.id, changes)
  })
  const changed = Object.keys(toConnectionChanges(spec, connection, watch(), entities)).length > 0
  const keep = (field: ConnectionField) => ({
    ...field,
    required: false,
    placeholder: 'Leave blank to keep the current value',
  })

  return (
    <>
      <form onSubmit={save} noValidate className="flex min-h-0 flex-1 flex-col">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <span className="bg-background flex size-10 shrink-0 items-center justify-center rounded-lg border p-1.5 shadow-xs">
              {logo}
            </span>
            <div className="min-w-0">
              <SheetTitle>{integration.name}</SheetTitle>
              <SheetDescription>
                Connected{connection.createdAt ? ` ${formatDate(connection.createdAt)}` : ''}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto px-4 pb-4">
          {saveError ? (
            <Alert variant="destructive" role="alert">
              <TriangleAlert aria-hidden="true" />
              <AlertTitle>Changes were not saved</AlertTitle>
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          ) : null}

          <section aria-labelledby="manage-general" className="flex flex-col gap-4">
            <h3 id="manage-general" className="text-sm font-medium">
              General
            </h3>
            <Field label="Connection name" required error={errors.name?.message}>
              {(aria) => <Input {...aria} autoComplete="off" {...register('name')} />}
            </Field>
            {entities ? (
              <BillingEntityField
                integration={integration}
                entities={entities}
                connectionId={connection.id}
                control={control}
                error={errors.billingEntityId?.message}
                disabled={isSaving}
              />
            ) : null}
          </section>

          {spec.sync.length > 0 ? (
            <section aria-labelledby="manage-sync" className="flex flex-col gap-3">
              <h3 id="manage-sync" className="text-sm font-medium">
                Sync
              </h3>
              <SyncOptions options={spec.sync} control={control} />
            </section>
          ) : null}

          {webhook ? (
            <section aria-labelledby="manage-webhook" className="flex flex-col gap-4">
              <h3 id="manage-webhook" className="text-sm font-medium">
                Webhook
              </h3>
              <WebhookGuide spec={spec} url={webhook.url} events={webhook.events} />
              {webhookFields.map((field) => (
                <SpecField key={field.key} field={keep(field)} control={control} errors={errors} />
              ))}
            </section>
          ) : null}

          <section aria-labelledby="manage-keys" className="flex flex-col gap-4">
            <h3 id="manage-keys" className="text-sm font-medium">
              Keys
            </h3>
            <p className="text-muted-foreground flex items-start gap-2 text-[13px]">
              <InfoIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              Keys are stored encrypted and cannot be shown.{' '}
              {secrets.length > 0
                ? 'You can replace the ones below; to change any other key, disconnect and connect again.'
                : 'To change them, disconnect and connect again.'}
            </p>
            {secrets.map((field) => (
              <SpecField key={field.key} field={keep(field)} control={control} errors={errors} />
            ))}
          </section>

          <section
            aria-labelledby="manage-disconnect"
            className="flex flex-col gap-3 border-t pt-6"
          >
            <h3 id="manage-disconnect" className="text-sm font-medium">
              Disconnect
            </h3>
            <p className="text-muted-foreground text-[13px]">
              Flexprice stops syncing with {integration.name} and archives this connection. Nothing
              is deleted in {integration.name}. Connect again whenever you like.
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              disabled={isSaving}
              onClick={() => setConfirming(true)}
            >
              Disconnect {integration.name}
            </Button>
          </section>
        </div>

        <SheetFooter className="border-t">
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
              Close
            </Button>
            <Button type="submit" disabled={!changed || isSaving}>
              {isSaving ? <Spinner aria-hidden="true" /> : null}
              {isSaving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </SheetFooter>
      </form>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Disconnect ${integration.name}?`}
        description={`Syncing with ${integration.name} stops and this connection is archived. Connect again to resume.`}
        confirmLabel="Disconnect"
        pendingLabel="Disconnecting…"
        destructive
        isPending={isDisconnecting}
        error={disconnectError}
        onConfirm={() => onDisconnect(connection.id)}
      />
    </>
  )
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
