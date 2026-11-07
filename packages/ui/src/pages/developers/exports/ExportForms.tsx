import { type FormEvent, useState } from 'react'
import { InfoIcon, PlusIcon, Trash2Icon } from '@ui/icons'
import {
  ALLOWED_METADATA_ENTITIES,
  type CreateDataExport,
  type CreateS3Connection,
  type DataExportErrors,
  EXPORT_ENTITY,
  EXPORT_ENTITY_LABEL,
  EXPORT_INTERVAL,
  EXPORT_INTERVAL_LABEL,
  EXPORT_METADATA_ENTITY_LABEL,
  type ExportEntity,
  type ExportInterval,
  type ExportMetadataEntity,
  type ExportRunRequest,
  type S3Connection,
  type S3ConnectionErrors,
  clampMetadataFields,
  emptyDataExport,
  emptyS3Connection,
  validateDataExport,
  validateS3Connection,
  validateS3ConnectionEdit,
} from '@fp/domain'
import { Alert, AlertDescription, AlertTitle } from '@ui/components/reui/alert'
import { Button } from '@ui/components/primitives/button'
import {
  Field as FieldRoot,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@ui/components/primitives/field'
import { Input } from '@ui/components/primitives/input'
import { Switch } from '@ui/components/primitives/switch'
import { ChoiceCards } from '@ui/compositions/detail/DetailKit'
import { DateInput } from '@ui/compositions/forms/DateInput'
import { Field } from '@ui/compositions/forms/Field'
import { FormDialog } from '@ui/compositions/forms/FormDialog'
import { OptionSelect } from '@ui/compositions/forms/OptionSelect'
import { provenance } from '@ui/provenance'

/**
 * The three forms of the Exports flow, each in a `FormDialog`, as V1's
 * drawers: connect an S3 bucket, create an export on a connection, and run an
 * export now. Every submit is a promise from the page; a rejection's message
 * is shown in the dialog, which stays open.
 */
export const ExportFormsProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/form-dialog',
    'compositions/field',
    'compositions/option-select',
    'compositions/date-input',
    'compositions/detail-kit',
    'ui/switch',
    'ui/field',
    'reui/alert',
  ],
  note: 'S3 connection, new export and run-now dialogs for the Exports flow (V1 S3ConnectionDrawer, ExportDrawer, ForceRunDrawer).',
})

/** The errors without `key`: an optional property is left out, never set to undefined. */
function clear<T extends object>(errors: T, key: PropertyKey): T {
  const next = { ...errors }
  delete (next as Record<PropertyKey, unknown>)[key]
  return next
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

/** A submit that keeps its own pending flag and failure. */
function useSubmit() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (action: () => Promise<unknown>, fallback: string) => {
    setPending(true)
    setError(null)
    try {
      await action()
      return true
    } catch (caught) {
      setError(messageOf(caught, fallback))
      return false
    } finally {
      setPending(false)
    }
  }
  return { pending, error, run }
}

function Footer({
  pending,
  error,
  label,
  pendingLabel,
  onCancel,
}: {
  pending: boolean
  error: string | null
  label: string
  pendingLabel: string
  onCancel: () => void
}) {
  return (
    <>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2 border-t pt-5">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? pendingLabel : label}
        </Button>
      </div>
    </>
  )
}

/* ---- Connect S3 ----------------------------------------------------------- */

export interface S3ConnectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (draft: CreateS3Connection) => Promise<unknown>
  /** Edits this connection: rename it, or rotate its AWS keys. */
  connection?: S3Connection | null
}

/** Connect a bucket: Flexprice-managed, or your own with AWS keys. */
export function S3ConnectionDialog({
  open,
  onOpenChange,
  onSubmit,
  connection = null,
}: S3ConnectionDialogProps) {
  const editing = connection !== null
  const [draft, setDraft] = useState<CreateS3Connection>(() =>
    connection
      ? {
          ...emptyS3Connection(),
          name: connection.name,
          flexpriceManaged: connection.flexpriceManaged,
        }
      : emptyS3Connection(),
  )
  const [errors, setErrors] = useState<S3ConnectionErrors>({})
  const submit = useSubmit()
  const set = <K extends keyof CreateS3Connection>(key: K, value: CreateS3Connection[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => clear(current, key))
  }
  const close = (next: boolean) => {
    if (!next) {
      setDraft(emptyS3Connection())
      setErrors({})
    }
    onOpenChange(next)
  }

  const handle = (event: FormEvent) => {
    event.preventDefault()
    const found = editing ? validateS3ConnectionEdit(draft) : validateS3Connection(draft)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    void submit
      .run(
        () => onSubmit(draft),
        editing ? 'The connection could not be updated.' : 'The connection could not be created.',
      )
      .then((ok) => ok && close(false))
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={close}
      title={editing ? 'Edit S3 connection' : 'Connect Amazon S3'}
      size="sm"
      isPending={submit.pending}
    >
      <form className="flex flex-col gap-5" onSubmit={handle} noValidate>
        <Field
          label="Connection name"
          hint="A name to tell this bucket apart, e.g. Production data lake."
          error={errors.name}
          required
        >
          {(field) => (
            <Input
              {...field}
              value={draft.name}
              placeholder="Production data lake"
              onChange={(event) => set('name', event.target.value)}
            />
          )}
        </Field>
        {editing ? null : (
          <FieldRoot orientation="horizontal" className="rounded-lg border p-4">
            <FieldContent>
              <FieldLabel htmlFor="s3-flexprice-managed">Flexprice-managed bucket</FieldLabel>
              <FieldDescription>
                Flexprice hosts the bucket and its keys. Turn off to export to a bucket you own.
              </FieldDescription>
            </FieldContent>
            <Switch
              id="s3-flexprice-managed"
              checked={draft.flexpriceManaged}
              onCheckedChange={(checked) => set('flexpriceManaged', checked)}
            />
          </FieldRoot>
        )}
        {draft.flexpriceManaged ? null : (
          <>
            <Field
              label={editing ? 'New AWS access key ID' : 'AWS access key ID'}
              hint={
                editing
                  ? 'Leave both keys blank to keep the current ones.'
                  : "An IAM user's key with write access to the bucket."
              }
              error={errors.accessKeyId}
              required={!editing}
            >
              {(field) => (
                <Input
                  {...field}
                  value={draft.accessKeyId}
                  placeholder="AKIA…"
                  autoComplete="off"
                  onChange={(event) => set('accessKeyId', event.target.value)}
                />
              )}
            </Field>
            <Field
              label={editing ? 'New AWS secret access key' : 'AWS secret access key'}
              hint="Stored encrypted. It is never shown again."
              error={errors.secretAccessKey}
              required={!editing}
            >
              {(field) => (
                <Input
                  {...field}
                  type="password"
                  autoComplete="new-password"
                  value={draft.secretAccessKey}
                  onChange={(event) => set('secretAccessKey', event.target.value)}
                />
              )}
            </Field>
            <Field label="Session token" hint="Only for temporary credentials.">
              {(field) => (
                <Input
                  {...field}
                  type="password"
                  autoComplete="new-password"
                  value={draft.sessionToken}
                  onChange={(event) => set('sessionToken', event.target.value)}
                />
              )}
            </Field>
          </>
        )}
        <Alert variant="info">
          <InfoIcon aria-hidden />
          <AlertTitle>Security</AlertTitle>
          <AlertDescription>
            {draft.flexpriceManaged
              ? 'Flexprice creates and secures the bucket; no AWS keys leave your hands.'
              : 'Keys are encrypted at rest and used only to write exports. Give the IAM user write access to this bucket alone.'}
          </AlertDescription>
        </Alert>
        <Footer
          pending={submit.pending}
          error={submit.error}
          label={editing ? 'Save' : 'Connect'}
          pendingLabel={editing ? 'Saving…' : 'Connecting…'}
          onCancel={() => close(false)}
        />
      </form>
    </FormDialog>
  )
}

/* ---- New export ---------------------------------------------------------- */

const ENTITY_OPTIONS = [
  EXPORT_ENTITY.Events,
  EXPORT_ENTITY.Invoice,
  EXPORT_ENTITY.CreditTopups,
  EXPORT_ENTITY.CreditUsage,
  EXPORT_ENTITY.UsageAnalytics,
].map((value) => ({ value, label: EXPORT_ENTITY_LABEL[value] }))

const INTERVAL_OPTIONS = Object.values(EXPORT_INTERVAL).map((value) => ({
  value,
  label: EXPORT_INTERVAL_LABEL[value] ?? value,
}))

export interface DataExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectionId: string
  /** A managed connection owns its bucket, so bucket, region and prefix are not asked for. */
  flexpriceManaged: boolean
  onSubmit: (draft: CreateDataExport) => Promise<unknown>
}

/** A new export on a connection: what, how often, and where in the bucket. */
export function DataExportDialog({
  open,
  onOpenChange,
  connectionId,
  flexpriceManaged,
  onSubmit,
}: DataExportDialogProps) {
  const [draft, setDraft] = useState<CreateDataExport>(() => emptyDataExport(connectionId))
  const [errors, setErrors] = useState<DataExportErrors>({})
  const submit = useSubmit()
  const allowed = ALLOWED_METADATA_ENTITIES[draft.entity]

  const set = <K extends keyof CreateDataExport>(key: K, value: CreateDataExport[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => clear(current, key))
  }
  const setField = (index: number, patch: Partial<CreateDataExport['metadataFields'][number]>) => {
    setDraft((current) => ({
      ...current,
      metadataFields: current.metadataFields.map((field, i) =>
        i === index ? { ...field, ...patch } : field,
      ),
    }))
    setErrors((current) => clear(current, 'metadataFields'))
  }
  const close = (next: boolean) => {
    if (!next) {
      setDraft(emptyDataExport(connectionId))
      setErrors({})
    }
    onOpenChange(next)
  }

  const handle = (event: FormEvent) => {
    event.preventDefault()
    const found = validateDataExport(draft, { flexpriceManaged })
    setErrors(found)
    if (Object.keys(found).length > 0) return
    void submit
      .run(() => onSubmit(draft), 'The export could not be created.')
      .then((ok) => ok && close(false))
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={close}
      title="Add export task"
      size="md"
      isPending={submit.pending}
    >
      <form className="flex flex-col gap-5" onSubmit={handle} noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Data" hint="What each run writes to the bucket.">
            {(field) => (
              <OptionSelect
                {...field}
                value={draft.entity}
                onValueChange={(value) => {
                  const entity = value as ExportEntity
                  setDraft((current) => ({
                    ...current,
                    entity,
                    metadataFields: clampMetadataFields(current.metadataFields, entity),
                  }))
                }}
                options={ENTITY_OPTIONS}
              />
            )}
          </Field>
          <Field label="Runs" hint="How often a new file is written.">
            {(field) => (
              <OptionSelect
                {...field}
                value={draft.interval}
                onValueChange={(value) => set('interval', value as ExportInterval)}
                options={INTERVAL_OPTIONS}
              />
            )}
          </Field>
        </div>

        {flexpriceManaged ? (
          <Alert variant="info">
            <InfoIcon aria-hidden />
            <AlertTitle>Flexprice-managed bucket</AlertTitle>
            <AlertDescription>
              Flexprice chooses the bucket, region and path for this connection.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Bucket"
                hint="The S3 bucket to write to."
                error={errors.bucket}
                required
              >
                {(field) => (
                  <Input
                    {...field}
                    value={draft.bucket}
                    placeholder="my-billing-exports"
                    onChange={(event) => set('bucket', event.target.value)}
                  />
                )}
              </Field>
              <Field label="Region" hint="The bucket's AWS region." error={errors.region} required>
                {(field) => (
                  <Input
                    {...field}
                    value={draft.region}
                    placeholder="us-east-1"
                    onChange={(event) => set('region', event.target.value)}
                  />
                )}
              </Field>
            </div>
            <Field
              label="Key prefix"
              hint="The folder files are written under, e.g. flexprice-exports/events/…"
              error={errors.keyPrefix}
              required
            >
              {(field) => (
                <Input
                  {...field}
                  value={draft.keyPrefix}
                  onChange={(event) => set('keyPrefix', event.target.value)}
                />
              )}
            </Field>
          </>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Compression">
            {(field) => (
              <OptionSelect
                {...field}
                value={draft.compression}
                onValueChange={(value) =>
                  set('compression', value as CreateDataExport['compression'])
                }
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'gzip', label: 'Gzip' },
                ]}
              />
            )}
          </Field>
          <Field label="Encryption" hint="Server-side encryption of each file.">
            {(field) => (
              <OptionSelect
                {...field}
                value={draft.encryption}
                onValueChange={(value) =>
                  set('encryption', value as CreateDataExport['encryption'])
                }
                options={[{ value: 'AES256', label: 'AES-256' }]}
              />
            )}
          </Field>
        </div>

        {allowed.length > 0 ? (
          <FieldSet className="gap-3 rounded-lg border p-4">
            <FieldLegend variant="label">Metadata columns</FieldLegend>
            <FieldDescription>
              Optional. Add a{' '}
              {allowed.map((e) => EXPORT_METADATA_ENTITY_LABEL[e].toLowerCase()).join(' or ')}{' '}
              metadata key as its own column. Leave the column name empty to use the key.
            </FieldDescription>
            {draft.metadataFields.map((field, index) => (
              <div
                key={index}
                className="grid items-start gap-2 sm:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)_auto]"
              >
                <label className="sr-only" htmlFor={`metadata-entity-${index}`}>
                  Metadata source {index + 1}
                </label>
                <OptionSelect
                  id={`metadata-entity-${index}`}
                  value={field.entity}
                  onValueChange={(value) =>
                    setField(index, { entity: value as ExportMetadataEntity })
                  }
                  options={allowed.map((value) => ({
                    value,
                    label: EXPORT_METADATA_ENTITY_LABEL[value],
                  }))}
                />
                <Input
                  aria-label={`Metadata key ${index + 1}`}
                  placeholder="Key, e.g. account_manager"
                  value={field.fieldKey}
                  aria-invalid={errors.metadataFields && !field.fieldKey.trim() ? true : undefined}
                  onChange={(event) => setField(index, { fieldKey: event.target.value })}
                />
                <Input
                  aria-label={`Column name ${index + 1}`}
                  placeholder="Column name (optional)"
                  value={field.columnName}
                  onChange={(event) => setField(index, { columnName: event.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove metadata column ${index + 1}`}
                  onClick={() =>
                    set(
                      'metadataFields',
                      draft.metadataFields.filter((_, i) => i !== index),
                    )
                  }
                >
                  <Trash2Icon aria-hidden />
                </Button>
              </div>
            ))}
            {errors.metadataFields ? (
              <p role="alert" className="text-destructive text-xs">
                {errors.metadataFields}
              </p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() =>
                set('metadataFields', [
                  ...draft.metadataFields,
                  { entity: allowed[0]!, fieldKey: '', columnName: '' },
                ])
              }
            >
              <PlusIcon data-icon="inline-start" aria-hidden />
              Add metadata column
            </Button>
          </FieldSet>
        ) : null}

        {flexpriceManaged ? null : (
          <Field
            label="Custom endpoint"
            hint="Optional. For S3-compatible storage such as MinIO or Cloudflare R2; files are addressed by path."
            error={errors.endpointUrl}
          >
            {(field) => (
              <Input
                {...field}
                value={draft.endpointUrl}
                placeholder="https://"
                onChange={(event) => set('endpointUrl', event.target.value)}
              />
            )}
          </Field>
        )}

        <FieldRoot orientation="horizontal">
          <Switch
            id="export-enabled"
            checked={draft.enabled}
            onCheckedChange={(checked) => set('enabled', checked)}
          />
          <FieldLabel htmlFor="export-enabled">Start exporting right away</FieldLabel>
        </FieldRoot>

        <Footer
          pending={submit.pending}
          error={submit.error}
          label="Create export"
          pendingLabel="Creating…"
          onCancel={() => close(false)}
        />
      </form>
    </FormDialog>
  )
}

/* ---- Run now ------------------------------------------------------------- */

type RunWindow = 'current' | 'custom'

/** `YYYY-MM-DD` and `HH:MM` as a local `Date`. */
function at(day: string, time: string): Date | undefined {
  if (!day) return undefined
  const date = new Date(`${day}T${time || '00:00'}`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export interface RunExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (window: ExportRunRequest) => Promise<unknown>
}

/** Run an export now: for its current interval, or for a window you choose. */
export function RunExportDialog({ open, onOpenChange, onSubmit }: RunExportDialogProps) {
  const [mode, setMode] = useState<RunWindow>('current')
  const [startDay, setStartDay] = useState('')
  const [startTime, setStartTime] = useState('00:00')
  const [endDay, setEndDay] = useState('')
  const [endTime, setEndTime] = useState('00:00')
  const [errors, setErrors] = useState<{ start?: string; end?: string }>({})
  const submit = useSubmit()

  const close = (next: boolean) => {
    if (!next) {
      setMode('current')
      setStartDay('')
      setEndDay('')
      setStartTime('00:00')
      setEndTime('00:00')
      setErrors({})
    }
    onOpenChange(next)
  }

  const handle = (event: FormEvent) => {
    event.preventDefault()
    let window: ExportRunRequest = {}
    if (mode === 'custom') {
      const start = at(startDay, startTime)
      const end = at(endDay, endTime)
      const found = {
        ...(start ? {} : { start: 'Choose when the window starts' }),
        ...(end ? {} : { end: 'Choose when the window ends' }),
        ...(start && end && start >= end ? { end: 'The end must be after the start' } : {}),
      }
      setErrors(found)
      if (Object.keys(found).length > 0 || !start || !end) return
      window = { startTime: start, endTime: end }
    }
    void submit
      .run(() => onSubmit(window), 'The export could not be started.')
      .then((ok) => ok && close(false))
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={close}
      title="Run export now"
      size="sm"
      isPending={submit.pending}
    >
      <form className="flex flex-col gap-5" onSubmit={handle} noValidate>
        <ChoiceCards<RunWindow>
          label="Data to export"
          value={mode}
          onChange={setMode}
          choices={[
            {
              value: 'current',
              title: 'The current interval',
              description: 'What the next scheduled run would write.',
            },
            {
              value: 'custom',
              title: 'A custom window',
              description: 'Re-export a past range, e.g. after a fix.',
            },
          ]}
        />
        {mode === 'custom' ? (
          <div className="flex flex-col gap-4">
            <Field label="Starts" error={errors.start} required>
              {(field) => (
                <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
                  <DateInput
                    {...field}
                    value={startDay}
                    onValueChange={(value) => {
                      setStartDay(value)
                      setErrors((current) => clear(current, 'start'))
                    }}
                  />
                  <Input
                    type="time"
                    aria-label="Start time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                  />
                </div>
              )}
            </Field>
            <Field label="Ends" error={errors.end} required>
              {(field) => (
                <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
                  <DateInput
                    {...field}
                    value={endDay}
                    onValueChange={(value) => {
                      setEndDay(value)
                      setErrors((current) => clear(current, 'end'))
                    }}
                  />
                  <Input
                    type="time"
                    aria-label="End time"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                  />
                </div>
              )}
            </Field>
          </div>
        ) : null}
        <Footer
          pending={submit.pending}
          error={submit.error}
          label="Run export"
          pendingLabel="Starting…"
          onCancel={() => close(false)}
        />
      </form>
    </FormDialog>
  )
}
