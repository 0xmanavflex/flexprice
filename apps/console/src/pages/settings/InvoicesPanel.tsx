import { useState } from 'react'
import {
  INVOICE_NUMBER_FORMATS,
  INVOICE_NUMBER_FORMAT_LABEL,
  BillingEntityMode,
  type InvoiceConfig,
  invoiceConfigSchema,
  previewInvoiceNumber,
  splitDelay,
} from '@fp/domain'
import {
  useBillingEntityStatus,
  useInvoiceConfig,
  useResetInvoiceConfig,
  useUpdateInvoiceConfig,
} from '@fp/query'
import { ConfirmDialog, EmptyState, SettingRow, SettingsFieldGroup } from '@fp/ui/compositions'
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@fp/ui/primitives'
import { useSession } from '@/app/session'
import {
  ActionError,
  ActionNote,
  Panel,
  PanelError,
  SettingsBlock,
  mutationMessage,
  toFailure,
  PanelLoading,
  PanelUnavailable,
  queryPhase,
} from './panelKit'
import { EntityManagedLink } from './EntityManagedLink'
import { useDraft } from './useDraft'

/**
 * How invoices are numbered, and when they fall due.
 *
 * `GET/PUT/DELETE /settings/invoice_config`, one record per environment: the
 * sandbox and production number their invoices independently so a test invoice
 * can never consume a production sequence number. That is why every hook here
 * takes the session's `environmentId`, and why there is an explicit "pick an
 * environment" state: without an id the route answers 403, not an empty
 * record, so the panel asks rather than spinning.
 *
 * ## The preview is the point
 *
 * Eight settings combine into one string nobody can assemble in their head:
 * `INV-202609-00001`. V1 shows that string as you type and it is the single
 * most useful thing on the screen, so it leads here too. It is rendered from
 * the *parsed* draft: a half-typed sequence length would otherwise preview as
 * `INV-202609-NaN`, which teaches the reader nothing except distrust.
 *
 * It is labelled an example rather than "next", deliberately. `startSequence`
 * is the only number this console can honestly show: the live counter lives
 * in the database and is not exposed.
 *
 * ## The ninth field nobody can see
 *
 * `auto_complete_purchased_credit_transaction` is omitted by the API while it
 * is false, so a default read has eight keys and the model has nine. The
 * mapper sends it on every write regardless, which is what stops a tenant who
 * switched it on having it switched off by an unrelated save: so it is edited
 * here rather than quietly carried.
 */
export function InvoicesPanel() {
  const { environmentId } = useSession()
  const config = useInvoiceConfig(environmentId)
  const entityStatus = useBillingEntityStatus()

  const failure = toFailure(config.error, 'your invoice settings')

  if (!environmentId) {
    return (
      <Panel>
        <SettingsBlock label="Invoice numbering">
          <EmptyState
            size="inline"
            title="No environment selected"
            description="Choose an environment from the switcher to see how its invoices are numbered."
          />
        </SettingsBlock>
      </Panel>
    )
  }

  if (failure) {
    return (
      <Panel>
        <PanelError failure={failure} onRetry={() => void config.refetch()} />
      </Panel>
    )
  }

  const phase = queryPhase(config)
  if (phase === 'idle') return <PanelUnavailable reason="unavailable" />
  if (phase === 'loading' || !config.data || entityStatus.isPending)
    return <PanelLoading rows={6} />

  // Keyed on the environment rather than on the record: the draft should
  // survive a save: the mutation writes its own response into this cache
  // entry: and be re-seeded only when the environment underneath it changes.
  return (
    <InvoiceForm
      key={environmentId}
      environmentId={environmentId}
      config={config.data}
      prefixOnEntities={entityStatus.data === BillingEntityMode.Enabled}
    />
  )
}

/** The units a finalisation delay is worth showing in, smallest first. */
const DELAY_UNITS = [
  { unit: 'seconds', label: 'Seconds', seconds: 1 },
  { unit: 'minutes', label: 'Minutes', seconds: 60 },
  { unit: 'hours', label: 'Hours', seconds: 3_600 },
  { unit: 'days', label: 'Days', seconds: 86_400 },
] as const

type DelayUnit = (typeof DELAY_UNITS)[number]['unit']

function secondsPer(unit: DelayUnit): number {
  return DELAY_UNITS.find((option) => option.unit === unit)?.seconds ?? 1
}

/** The three plain numbers on this form. The delay is its own thing. */
type NumericKey = 'startSequence' | 'suffixLength' | 'dueDateDays'

/**
 * Text to number, with "not a number yet" preserved as `NaN`.
 *
 * An empty or half-typed box has to reach the schema as something invalid so
 * the schema can answer `Enter a start number`. Coercing it to 0 would save a
 * zero nobody asked for.
 */
function toNumber(text: string): number {
  const trimmed = text.trim()
  if (trimmed.length === 0) return Number.NaN
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function InvoiceForm({
  environmentId,
  config,
  prefixOnEntities,
}: {
  environmentId: string
  config: InvoiceConfig
  prefixOnEntities: boolean
}) {
  const update = useUpdateInvoiceConfig(environmentId)
  const reset = useResetInvoiceConfig(environmentId)
  const draft = useDraft<InvoiceConfig>(invoiceConfigSchema, config)

  /**
   * What was typed into a numeric box, while it is still being typed.
   *
   * The draft holds numbers, and a number cannot represent "the field has been
   * cleared and 12 is about to be typed". An entry here shadows the draft
   * until the next re-seed, which is what makes backspacing to empty possible
   * without the box refilling itself with `0` or `NaN`.
   */
  const [typed, setTyped] = useState<Partial<Record<NumericKey, string>>>({})

  const initialDelay = splitDelay(config.finalizationDelaySeconds)
  const [delayUnit, setDelayUnit] = useState<DelayUnit>(initialDelay.unit)
  const [delayText, setDelayText] = useState(String(initialDelay.value))

  const [resetting, setResetting] = useState(false)

  const saveError = mutationMessage(update.error, 'The invoice settings could not be saved.')
  const resetError = mutationMessage(reset.error, 'The invoice settings could not be reset.')
  const busy = update.isPending || reset.isPending

  function numberText(key: NumericKey): string {
    const pending = typed[key]
    if (pending !== undefined) return pending
    const value = draft.value[key]
    return Number.isFinite(value) ? String(value) : ''
  }

  function setNumber(key: NumericKey, next: string) {
    setTyped((current) => {
      const pending = { ...current }
      pending[key] = next
      return pending
    })
    draft.update((current) => {
      const updated: InvoiceConfig = { ...current }
      updated[key] = toNumber(next)
      return updated
    })
  }

  function setDelay(text: string, unit: DelayUnit) {
    setDelayText(text)
    setDelayUnit(unit)
    draft.update((current) => ({
      ...current,
      finalizationDelaySeconds: toNumber(text) * secondsPer(unit),
    }))
  }

  /** Put every editor back onto a record the server has confirmed. */
  function reseed(saved: InvoiceConfig) {
    draft.reset(saved)
    setTyped({})
    const delay = splitDelay(saved.finalizationDelaySeconds)
    setDelayUnit(delay.unit)
    setDelayText(String(delay.value))
  }

  // The preview renders only from a draft the schema accepts, so it never
  // shows a number the API would refuse.
  const parsed = invoiceConfigSchema.safeParse(draft.value)
  const preview = parsed.success && parsed.data ? previewInvoiceNumber(parsed.data) : null

  return (
    <>
      <form
        className="contents"
        noValidate
        onSubmit={draft.handleSubmit((value) => {
          // Spread over the record that was loaded, never assembled fresh: a
          // field this form does not render still has to make the round trip.
          update.mutate({ ...config, ...value }, { onSuccess: reseed })
        })}
      >
        <Panel>
          <SettingsBlock
            label="Invoice numbering"
            flush
            info={
              <>
                <span>Example invoice number</span>
                {preview ? (
                  <code className="text-foreground font-mono text-lg font-medium tracking-tight">
                    {preview}
                  </code>
                ) : (
                  <span>Fix the fields below to see an example.</span>
                )}
                <span className="text-xs">
                  Built from today&rsquo;s date and the start number. The live sequence continues
                  from wherever this environment has reached; production and sandbox never share
                  one.
                </span>
              </>
            }
          >
            <SettingsFieldGroup
              legend="Invoice numbering"
              description="The parts an invoice number is built from."
            >
              {prefixOnEntities ? (
                <SettingRow
                  title="Prefix"
                  description="The literal an invoice number opens with."
                  labelFor="invoice-prefix"
                >
                  <div className="flex w-full flex-col gap-1">
                    <Input id="invoice-prefix" readOnly value="Set on each billing entity" />
                    <EntityManagedLink>Manage billing entities</EntityManagedLink>
                  </div>
                </SettingRow>
              ) : (
                <TextRow
                  id="invoice-prefix"
                  title="Prefix"
                  description="The literal an invoice number opens with."
                  required
                  busy={busy}
                  placeholder="INV"
                  value={draft.text('prefix')}
                  error={draft.error('prefix')}
                  onChange={(value) => draft.setText('prefix', value)}
                />
              )}
              <TextRow
                id="invoice-separator"
                title="Separator"
                description="Between the parts. Leave it empty for INV2026090001."
                busy={busy}
                placeholder="-"
                value={draft.text('separator')}
                error={draft.error('separator')}
                onChange={(value) => draft.setText('separator', value)}
              />
              <SettingRow
                title="Date format"
                description="The date segment of the number."
                labelFor="invoice-format"
              >
                <div className="flex w-full flex-col gap-1">
                  <Select
                    value={draft.value.format}
                    disabled={busy}
                    onValueChange={(value) => {
                      if (value == null) return
                      draft.update((current) => ({ ...current, format: value }))
                    }}
                  >
                    <SelectTrigger id="invoice-format" className="w-full">
                      <SelectValue>
                        {INVOICE_NUMBER_FORMAT_LABEL[
                          draft.value.format as (typeof INVOICE_NUMBER_FORMATS)[number]
                        ] ?? draft.value.format}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {INVOICE_NUMBER_FORMATS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {INVOICE_NUMBER_FORMAT_LABEL[option]}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {draft.error('format') ? (
                    <p role="alert" className="text-destructive text-xs">
                      {draft.error('format')}
                    </p>
                  ) : null}
                </div>
              </SettingRow>
              <TextRow
                id="invoice-timezone"
                title="Timezone"
                description="Any IANA name: Asia/Kolkata, America/New_York: or an abbreviation such as IST. It decides which day the date segment lands on."
                required
                busy={busy}
                placeholder="UTC"
                value={draft.text('timezone')}
                error={draft.error('timezone')}
                onChange={(value) => draft.setText('timezone', value)}
                spellCheck={false}
                autoComplete="off"
              />
              <TextRow
                id="invoice-start"
                title="Start number"
                description="The first number the sequence issues."
                required
                numeric
                busy={busy}
                value={numberText('startSequence')}
                error={draft.error('startSequence')}
                onChange={(value) => setNumber('startSequence', value)}
              />
              <TextRow
                id="invoice-length"
                title="Sequence length"
                description="How many digits the number is padded to, from 1 to 10."
                required
                numeric
                last
                busy={busy}
                value={numberText('suffixLength')}
                error={draft.error('suffixLength')}
                onChange={(value) => setNumber('suffixLength', value)}
              />
            </SettingsFieldGroup>
          </SettingsBlock>

          <SettingsBlock label="Dates and delivery" flush>
            <SettingsFieldGroup
              legend="Dates and delivery"
              description="When an invoice falls due, and how long it waits before a customer sees it."
            >
              <TextRow
                id="invoice-due"
                title="Payment due"
                description="Days after the invoice is finalised."
                required
                numeric
                busy={busy}
                value={numberText('dueDateDays')}
                error={draft.error('dueDateDays')}
                onChange={(value) => setNumber('dueDateDays', value)}
              />
              <SettingRow
                title="Finalisation delay"
                description="A grace period, not a queue: the window in which a finalised invoice can still be corrected. 0 sends it immediately."
                labelFor="invoice-delay"
                last
              >
                <div className="flex w-full flex-col gap-2">
                  <Input
                    id="invoice-delay"
                    disabled={busy}
                    inputMode="numeric"
                    aria-invalid={draft.error('finalizationDelaySeconds') ? true : undefined}
                    value={delayText}
                    onChange={(event) => setDelay(event.target.value, delayUnit)}
                  />
                  <div role="group" aria-label="Delay unit" className="flex flex-wrap gap-1.5">
                    {DELAY_UNITS.map((option) => (
                      <Button
                        key={option.unit}
                        type="button"
                        size="xs"
                        disabled={busy}
                        variant={delayUnit === option.unit ? 'default' : 'outline'}
                        aria-pressed={delayUnit === option.unit}
                        onClick={() => setDelay(delayText, option.unit)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                  {draft.error('finalizationDelaySeconds') ? (
                    <p role="alert" className="text-destructive text-xs">
                      {draft.error('finalizationDelaySeconds')}
                    </p>
                  ) : null}
                </div>
              </SettingRow>
            </SettingsFieldGroup>
          </SettingsBlock>

          <SettingsBlock
            label="Purchased credits"
            flush
            actions={
              <div className="flex w-full flex-wrap items-center justify-end gap-3">
                <ActionError message={saveError} />
                {!saveError && update.isSuccess ? <ActionNote message="Saved." /> : null}
                {!resetError && reset.isSuccess ? (
                  <ActionNote message="Back to the defaults." />
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setResetting(true)}
                >
                  Reset to defaults
                </Button>
                <Button type="submit" variant="outline" disabled={busy}>
                  {update.isPending ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            }
          >
            <SettingsFieldGroup
              legend="Purchased credits"
              description="What happens when a customer buys wallet credits."
            >
              <SettingRow
                title="Settle automatically"
                description="On, buying credits settles its own transaction straight away. Off, it waits to be completed."
                labelFor="invoice-auto-complete"
                last
              >
                <Switch
                  id="invoice-auto-complete"
                  checked={draft.value.autoCompletePurchasedCreditTransaction}
                  disabled={busy}
                  onCheckedChange={(checked) =>
                    draft.update((current) => ({
                      ...current,
                      autoCompletePurchasedCreditTransaction: checked,
                    }))
                  }
                />
              </SettingRow>
            </SettingsFieldGroup>
          </SettingsBlock>
        </Panel>
      </form>

      <ConfirmDialog
        open={resetting}
        onOpenChange={setResetting}
        title="Reset invoice settings?"
        description="This environment goes back to the Flexprice defaults for numbering, timezone and due dates. Invoices already issued keep the numbers they were given."
        confirmLabel="Reset to defaults"
        destructive
        isPending={reset.isPending}
        error={resetError}
        onConfirm={() =>
          reset.mutate(undefined, {
            onSuccess: (defaults) => {
              reseed(defaults)
              setResetting(false)
            },
          })
        }
      />
    </>
  )
}

/** One labelled input on a settings row. */
function TextRow({
  id,
  title,
  description,
  value,
  onChange,
  busy,
  error,
  required,
  placeholder,
  numeric,
  last,
  spellCheck,
  autoComplete,
}: {
  id: string
  title: string
  description: string
  value: string
  onChange: (value: string) => void
  busy: boolean
  error: string | undefined
  required?: boolean
  placeholder?: string
  numeric?: boolean
  last?: boolean
  spellCheck?: boolean
  autoComplete?: string
}) {
  return (
    <SettingRow
      title={title}
      description={description}
      labelFor={id}
      {...(last ? { last: true } : {})}
      {...(required
        ? {
            titleAddon: (
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            ),
          }
        : {})}
    >
      <div className="flex w-full flex-col gap-1">
        <Input
          id={id}
          disabled={busy}
          aria-invalid={error ? true : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          {...(placeholder ? { placeholder } : {})}
          {...(numeric ? { inputMode: 'numeric' as const } : {})}
          {...(spellCheck === false ? { spellCheck: false } : {})}
          {...(autoComplete ? { autoComplete } : {})}
        />
        {error ? (
          <p role="alert" className="text-destructive text-xs">
            {error}
          </p>
        ) : null}
      </div>
    </SettingRow>
  )
}
