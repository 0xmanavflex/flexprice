import { useState } from 'react'
import {
  INVOICE_NUMBER_FORMATS,
  INVOICE_NUMBER_FORMAT_LABEL,
  type InvoiceConfig,
  invoiceConfigSchema,
  previewInvoiceNumber,
  splitDelay,
} from '@fp/domain'
import { useInvoiceConfig, useResetInvoiceConfig, useUpdateInvoiceConfig } from '@fp/query'
import { ConfirmDialog, EmptyState, Field, LoadingRows } from '@fp/ui/compositions'
import { Button, Input } from '@fp/ui/primitives'
import { useSession } from '@/app/session'
import { ActionError, ActionNote, Panel, PanelError, mutationMessage, toFailure, SettingsBlock } from './panelKit'
import { useDraft } from './useDraft'

/**
 * How invoices are numbered, and when they fall due.
 *
 * `GET/PUT/DELETE /settings/invoice_config`, one record per environment — the
 * sandbox and production number their invoices independently so a test invoice
 * can never consume a production sequence number. That is why every hook here
 * takes the session's `environmentId`, and why there is an explicit "pick an
 * environment" state: without an id the route answers 403, not an empty
 * record, so the panel asks rather than spinning.
 *
 * ## The preview is the point
 *
 * Eight settings combine into one string nobody can assemble in their head —
 * `INV-202609-00001`. V1 shows that string as you type and it is the single
 * most useful thing on the screen, so it leads here too. It is rendered from
 * the *parsed* draft: a half-typed sequence length would otherwise preview as
 * `INV-202609-NaN`, which teaches the reader nothing except distrust.
 *
 * It is labelled an example rather than "next", deliberately. `startSequence`
 * is the only number this console can honestly show — the live counter lives
 * in the database and is not exposed.
 *
 * ## The ninth field nobody can see
 *
 * `auto_complete_purchased_credit_transaction` is omitted by the API while it
 * is false, so a default read has eight keys and the model has nine. The
 * mapper sends it on every write regardless, which is what stops a tenant who
 * switched it on having it switched off by an unrelated save — so it is edited
 * here rather than quietly carried.
 */
export function InvoicesPanel() {
  const { environmentId } = useSession()
  const config = useInvoiceConfig(environmentId)

  const failure = toFailure(config.error, 'your invoice settings')

  if (!environmentId) {
    return (
      <Panel>
        <SettingsBlock
          title="Invoice numbering"
          description="Stored per environment, so production and sandbox never share a sequence."
        >
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

  if (config.isPending || !config.data) {
    return (
      <Panel>
        <LoadingRows rows={6} columns={2} />
      </Panel>
    )
  }

  // Keyed on the environment rather than on the record: the draft should
  // survive a save — the mutation writes its own response into this cache
  // entry — and be re-seeded only when the environment underneath it changes.
  return <InvoiceForm key={environmentId} environmentId={environmentId} config={config.data} />
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

function InvoiceForm({ environmentId, config }: { environmentId: string; config: InvoiceConfig }) {
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
            title="Invoice numbering"
            description="The parts an invoice number is built from. Stored per environment, so production and sandbox never share a sequence."
          >
            <div className="bg-muted/40 flex flex-col gap-1 rounded-lg border p-4">
              <span className="text-muted-foreground text-xs">Example invoice number</span>
              {preview ? (
                <code className="font-mono text-base font-medium">{preview}</code>
              ) : (
                <span className="text-muted-foreground text-sm">
                  Fix the fields below to see an example.
                </span>
              )}
              <span className="text-muted-foreground text-xs">
                Built from today&rsquo;s date and the start number. The live sequence continues from
                wherever this environment has reached.
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Prefix"
                required
                hint="The literal an invoice number opens with."
                {...(draft.error('prefix') ? { error: draft.error('prefix') } : {})}
              >
                {({ id, ...field }) => (
                  <Input
                    id={id}
                    disabled={busy}
                    placeholder="INV"
                    value={draft.text('prefix')}
                    onChange={(event) => draft.setText('prefix', event.target.value)}
                    {...field}
                  />
                )}
              </Field>

              <Field
                label="Separator"
                hint="Between the parts. Leave it empty for INV2026090001."
                {...(draft.error('separator') ? { error: draft.error('separator') } : {})}
              >
                {({ id, ...field }) => (
                  <Input
                    id={id}
                    disabled={busy}
                    placeholder="-"
                    value={draft.text('separator')}
                    onChange={(event) => draft.setText('separator', event.target.value)}
                    {...field}
                  />
                )}
              </Field>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-sm font-medium">Date format</span>
                <div role="group" aria-label="Date format" className="flex flex-wrap gap-1.5">
                  {INVOICE_NUMBER_FORMATS.map((option) => (
                    <Button
                      key={option}
                      type="button"
                      size="sm"
                      disabled={busy}
                      variant={draft.value.format === option ? 'default' : 'outline'}
                      aria-pressed={draft.value.format === option}
                      onClick={() => draft.update((current) => ({ ...current, format: option }))}
                    >
                      {INVOICE_NUMBER_FORMAT_LABEL[option]}
                    </Button>
                  ))}
                </div>
                <ActionError message={draft.error('format') ?? null} />
              </div>

              <Field
                label="Timezone"
                required
                hint="Any IANA name — Asia/Kolkata, America/New_York — or an abbreviation such as IST. It decides which day the date segment lands on."
                {...(draft.error('timezone') ? { error: draft.error('timezone') } : {})}
              >
                {({ id, ...field }) => (
                  <Input
                    id={id}
                    disabled={busy}
                    placeholder="UTC"
                    autoComplete="off"
                    spellCheck={false}
                    value={draft.text('timezone')}
                    onChange={(event) => draft.setText('timezone', event.target.value)}
                    {...field}
                  />
                )}
              </Field>

              <Field
                label="Start number"
                required
                hint="The first number the sequence issues."
                {...(draft.error('startSequence') ? { error: draft.error('startSequence') } : {})}
              >
                {({ id, ...field }) => (
                  <Input
                    id={id}
                    disabled={busy}
                    inputMode="numeric"
                    value={numberText('startSequence')}
                    onChange={(event) => setNumber('startSequence', event.target.value)}
                    {...field}
                  />
                )}
              </Field>

              <Field
                label="Sequence length"
                required
                hint="How many digits the number is padded to, from 1 to 10."
                {...(draft.error('suffixLength') ? { error: draft.error('suffixLength') } : {})}
              >
                {({ id, ...field }) => (
                  <Input
                    id={id}
                    disabled={busy}
                    inputMode="numeric"
                    value={numberText('suffixLength')}
                    onChange={(event) => setNumber('suffixLength', event.target.value)}
                    {...field}
                  />
                )}
              </Field>
            </div>
          </SettingsBlock>

          <SettingsBlock
            title="Dates and delivery"
            description="When an invoice falls due, and how long it waits before your customer sees it."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Payment due after (days)"
                required
                hint="Counted from the day the invoice is finalised."
                {...(draft.error('dueDateDays') ? { error: draft.error('dueDateDays') } : {})}
              >
                {({ id, ...field }) => (
                  <Input
                    id={id}
                    disabled={busy}
                    inputMode="numeric"
                    value={numberText('dueDateDays')}
                    onChange={(event) => setNumber('dueDateDays', event.target.value)}
                    {...field}
                  />
                )}
              </Field>

              <div className="flex flex-col gap-1.5">
                <Field
                  label="Finalisation delay"
                  hint="A grace period, not a queue: the window in which a finalised invoice can still be corrected. 0 sends it immediately."
                  {...(draft.error('finalizationDelaySeconds')
                    ? { error: draft.error('finalizationDelaySeconds') }
                    : {})}
                >
                  {({ id, ...field }) => (
                    <Input
                      id={id}
                      disabled={busy}
                      inputMode="numeric"
                      value={delayText}
                      onChange={(event) => setDelay(event.target.value, delayUnit)}
                      {...field}
                    />
                  )}
                </Field>
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
              </div>
            </div>
          </SettingsBlock>

          <SettingsBlock
            title="Purchased credits"
            description="What happens when a customer buys wallet credits."
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
                <Button type="submit" disabled={busy}>
                  {update.isPending ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            }
          >
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                Complete the credit transaction automatically
              </span>
              <div
                role="group"
                aria-label="Complete the credit transaction automatically"
                className="flex gap-1.5"
              >
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  variant={
                    draft.value.autoCompletePurchasedCreditTransaction ? 'default' : 'outline'
                  }
                  aria-pressed={draft.value.autoCompletePurchasedCreditTransaction}
                  onClick={() =>
                    draft.update((current) => ({
                      ...current,
                      autoCompletePurchasedCreditTransaction: true,
                    }))
                  }
                >
                  On
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  variant={
                    draft.value.autoCompletePurchasedCreditTransaction ? 'outline' : 'default'
                  }
                  aria-pressed={!draft.value.autoCompletePurchasedCreditTransaction}
                  onClick={() =>
                    draft.update((current) => ({
                      ...current,
                      autoCompletePurchasedCreditTransaction: false,
                    }))
                  }
                >
                  Off
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                On, buying credits settles its own transaction straight away. Off, it waits to be
                completed.
              </p>
            </div>
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
