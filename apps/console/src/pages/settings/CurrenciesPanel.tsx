import { useState } from 'react'
import { PlusIcon, XIcon } from '@fp/ui/icons'
import {
  type CustomCurrencyConfig,
  customCurrencyConfigSchema,
  emptyCustomCurrency,
  currencyCodes,
  quotedFiatCurrencies,
} from '@fp/domain'
import {
  useCustomCurrencyConfig,
  useResetCustomCurrencyConfig,
  useUpdateCustomCurrencyConfig,
} from '@fp/query'
import {
  ConfirmDialog,
  EmptyState,
  OptionCombobox,
  SettingRow,
  SettingsFieldGroup,
} from '@fp/ui/compositions'
import { Button, Input } from '@fp/ui/primitives'
import { useSession } from '@/app/session'
import {
  ActionError,
  ActionNote,
  DelayedHint,
  Panel,
  PanelError,
  mutationMessage,
  toFailure,
  PanelLoading,
  PanelUnavailable,
  queryPhase,
  SettingsBlock,
} from './panelKit'
import { useDraft } from './useDraft'

/**
 * A tenant's own currencies, and what they are worth.
 *
 * `GET/PUT/DELETE /settings/custom_currency_config`. A custom currency is a
 * unit you invoice in that no central bank issues: credits, tokens, minutes,
 * seats. It needs a name and a symbol to be printed, and a conversion factor
 * so an invoice denominated in credits can be settled in money.
 *
 * ## One fiat list, not one per row
 *
 * The backend requires **every** custom currency to quote the same set of fiat
 * currencies (`internal/types/custom_currency.go`, and
 * `customCurrencyConfigSchema` re-states it). A per-row fiat picker would let
 * someone price credits in USD and tokens in EUR, build a config the API
 * refuses, and read the 400 as a bug. So the fiat set is edited once, for the
 * whole config, and every currency below gets a rate box per entry. Adding a
 * fiat adds a box everywhere; removing one removes it everywhere. The
 * constraint becomes something the screen cannot express rather than something
 * it has to validate.
 *
 * The settlement currency is picked from that same list for the same reason:
 * the schema requires the default fiat to be among the quoted ones, so
 * choosing it from the list makes that true by construction instead of by
 * error message.
 *
 * ## Rates are strings and stay strings
 *
 * A conversion factor that round-trips through a float is a rounding error
 * applied to every line of every invoice. The backend stores them as
 * arbitrary-precision decimals, the domain model keeps them as decimal
 * strings, and these inputs never parse them.
 *
 * ## A code is fixed once it is added
 *
 * The code is the record key. Editing it live would rename the key on every
 * keystroke: `u`, `us`, `usd`: which changes the React key under the cursor
 * and steals focus mid-word, and briefly writes keys the schema rejects. A
 * currency is three letters, a name and a symbol; removing and re-adding one
 * is cheaper than a rename that fights the person doing it.
 */

/** Every ISO currency, as the fiat picker offers it (stored lower-case, shown upper). */
const FIAT_OPTIONS = currencyCodes().map((code) => ({ value: code.toLowerCase(), label: code }))

export function CurrenciesPanel() {
  const { environmentId } = useSession()
  const config = useCustomCurrencyConfig(environmentId)

  const failure = toFailure(config.error, 'your currency settings')

  if (!environmentId) {
    return (
      <Panel>
        <SettingsBlock label="Currencies">
          <EmptyState
            size="inline"
            title="No environment selected"
            description="Choose an environment from the switcher to see the currencies it invoices in."
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
  if (phase === 'loading' || !config.data) return <PanelLoading rows={4} />

  return <CurrencyForm key={environmentId} environmentId={environmentId} config={config.data} />
}

const CODE = /^[a-z]{3}$/

function normalise(code: string): string {
  return code.trim().toLowerCase()
}

function CurrencyForm({
  environmentId,
  config,
}: {
  environmentId: string
  config: CustomCurrencyConfig
}) {
  const update = useUpdateCustomCurrencyConfig(environmentId)
  const reset = useResetCustomCurrencyConfig(environmentId)
  const draft = useDraft<CustomCurrencyConfig>(customCurrencyConfigSchema, config)

  /**
   * The fiat codes every custom currency quotes.
   *
   * Held here rather than derived on every render because it has to survive
   * having no custom currencies at all: `quotedFiatCurrencies` reads the set
   * off the first currency, so with none there would be nowhere for a
   * just-added fiat to live until a currency existed to hold it.
   */
  const [fiats, setFiats] = useState<string[]>(() => quotedFiatCurrencies(config))

  const [fiatIssue, setFiatIssue] = useState<string | null>(null)
  const [newCode, setNewCode] = useState('')
  const [codeIssue, setCodeIssue] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const saveError = mutationMessage(update.error, 'The currency settings could not be saved.')
  const resetError = mutationMessage(reset.error, 'The currency settings could not be reset.')
  const busy = update.isPending || reset.isPending

  const currencies = Object.entries(draft.value.customCurrencies)
  const settlement = normalise(draft.value.defaultFiatCurrency)

  function reseed(saved: CustomCurrencyConfig) {
    draft.reset(saved)
    setFiats(quotedFiatCurrencies(saved))
    setFiatIssue(null)
    setNewCode('')
    setCodeIssue(null)
    setEditing(null)
    setAdding(false)
  }

  function addFiat(picked: string) {
    const code = normalise(picked)
    if (!CODE.test(code)) {
      setFiatIssue('A currency code is three letters, for example usd.')
      return
    }
    if (fiats.includes(code)) {
      setFiatIssue(`${code.toUpperCase()} is already quoted.`)
      return
    }

    setFiatIssue(null)
    setFiats([...fiats, code].sort())
    // Every currency gains the same empty rate box, which is the rule.
    draft.update((current) => ({
      ...current,
      customCurrencies: Object.fromEntries(
        Object.entries(current.customCurrencies).map(([key, definition]) => [
          key,
          {
            ...definition,
            fiatConversionFactors: { ...definition.fiatConversionFactors, [code]: '' },
          },
        ]),
      ),
    }))
  }

  function removeFiat(code: string) {
    setFiatIssue(null)
    setFiats(fiats.filter((entry) => entry !== code))
    draft.update((current) => ({
      ...current,
      // Dropping the settlement currency leaves nothing to settle in, so the
      // choice is cleared rather than left pointing at a code that is gone.
      defaultFiatCurrency:
        normalise(current.defaultFiatCurrency) === code ? '' : current.defaultFiatCurrency,
      customCurrencies: Object.fromEntries(
        Object.entries(current.customCurrencies).map(([key, definition]) => [
          key,
          {
            ...definition,
            fiatConversionFactors: Object.fromEntries(
              Object.entries(definition.fiatConversionFactors).filter(
                ([fiat]) => normalise(fiat) !== code,
              ),
            ),
          },
        ]),
      ),
    }))
  }

  function addCurrency() {
    const code = normalise(newCode)
    if (!CODE.test(code)) {
      setCodeIssue('A currency code is three letters, for example cre.')
      return
    }
    if (Object.keys(draft.value.customCurrencies).some((key) => normalise(key) === code)) {
      setCodeIssue(`${code.toUpperCase()} is already defined.`)
      return
    }
    if (code === settlement) {
      setCodeIssue('A custom currency cannot reuse the settlement currency code.')
      return
    }

    setCodeIssue(null)
    setNewCode('')
    setAdding(false)
    setEditing(code)
    draft.update((current) => ({
      ...current,
      customCurrencies: {
        ...current.customCurrencies,
        [code]: emptyCustomCurrency(fiats),
      },
    }))
  }

  function removeCurrency(code: string) {
    setCodeIssue(null)
    draft.update((current) => ({
      ...current,
      customCurrencies: Object.fromEntries(
        Object.entries(current.customCurrencies).filter(([key]) => key !== code),
      ),
    }))
  }

  return (
    <>
      <form
        className="contents"
        noValidate
        onSubmit={draft.handleSubmit((value) => {
          // Spread over what was loaded, so anything this form does not render
          // still makes the round trip intact.
          update.mutate({ ...config, ...value }, { onSuccess: reseed })
        })}
      >
        <Panel>
          <SettingsBlock label="Fiat currencies">
            {fiats.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No fiat currencies yet. Add the ones you invoice in: usd, eur: before defining a
                custom currency.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {fiats.map((fiat) => (
                  <li
                    key={fiat}
                    className={`flex items-center gap-1 rounded-lg border py-1 pr-1 pl-2.5 ${
                      settlement === fiat ? 'bg-muted/60 border-foreground/30' : 'bg-background'
                    }`}
                  >
                    <span className="font-mono text-[13px]">{fiat.toUpperCase()}</span>
                    <Button
                      type="button"
                      size="xs"
                      disabled={busy}
                      variant="ghost"
                      className="text-muted-foreground"
                      aria-pressed={settlement === fiat}
                      aria-label={`Settle in ${fiat.toUpperCase()}`}
                      onClick={() =>
                        draft.update((current) => ({ ...current, defaultFiatCurrency: fiat }))
                      }
                    >
                      {settlement === fiat ? 'Settlement' : 'Make settlement'}
                    </Button>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      disabled={busy}
                      aria-label={`Remove ${fiat.toUpperCase()}`}
                      onClick={() => removeFiat(fiat)}
                    >
                      <XIcon aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <ActionError message={draft.error('defaultFiatCurrency') ?? null} />
            <div className="flex max-w-md items-center gap-2">
              {/* A dropdown of real ISO codes rather than free text: a fiat currency
                  is one the world already has, so it is picked, not typed. */}
              <div className="min-w-0 flex-1">
                <label htmlFor="currency-add-fiat" className="sr-only">
                  Add a fiat currency
                </label>
                <OptionCombobox
                  id="currency-add-fiat"
                  value={undefined}
                  onValueChange={(code) => addFiat(code)}
                  options={FIAT_OPTIONS.filter((option) => !fiats.includes(option.value))}
                  placeholder="Add a fiat currency…"
                  emptyText="No currency matches"
                  searchable
                  disabled={busy}
                />
              </div>
              <DelayedHint text="The currencies you invoice in. The settlement currency is what an invoice priced in a custom currency is collected in." />
            </div>
            <ActionError message={fiatIssue} />
          </SettingsBlock>

          <SettingsBlock
            label="Custom currencies"
            flush
            actions={
              <div className="flex w-full flex-wrap items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => setAdding((open) => !open)}
                >
                  <PlusIcon aria-hidden />
                  Add currency
                </Button>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <ActionError message={saveError} />
                  {!saveError && update.isSuccess ? <ActionNote message="Saved." /> : null}
                  {!resetError && reset.isSuccess ? (
                    <ActionNote message="Back to the defaults." />
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setResetting(true)}
                  >
                    Reset to defaults
                  </Button>
                  <Button type="submit" disabled={busy}>
                    {update.isPending ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              </div>
            }
          >
            {currencies.length === 0 ? (
              <div className="px-5 py-4">
                <EmptyState
                  size="inline"
                  title="No custom currencies"
                  description="A custom currency is a unit no central bank issues: credits, tokens, minutes. Add one to price in it; until then invoices use ordinary fiat currency."
                />
              </div>
            ) : (
              <ul className="divide-y">
                {currencies.map(([code, definition]) => {
                  const rowError =
                    draft.error(`customCurrencies.${code}`) ??
                    draft.error(`customCurrencies.${code}.fiatConversionFactors`)
                  const open = editing === code
                  const rates = fiats.filter(
                    (fiat) => (definition.fiatConversionFactors[fiat] ?? '') !== '',
                  )

                  return (
                    <li key={code} className="flex flex-col">
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
                        <div className="flex min-w-48 items-center gap-3">
                          <span
                            aria-hidden
                            className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-md font-mono text-xs"
                          >
                            {definition.symbol || code}
                          </span>
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate text-sm">
                              {definition.name || 'Unnamed currency'}
                            </span>
                            <span className="text-muted-foreground font-mono text-xs">
                              {code.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <ul className="flex min-w-0 flex-1 flex-wrap gap-x-5 gap-y-1 text-sm">
                          {rates.map((fiat) => (
                            <li key={fiat} className="tabular-nums">
                              1 {definition.symbol || code.toUpperCase()} ={' '}
                              {definition.fiatConversionFactors[fiat]}{' '}
                              <span className="text-muted-foreground text-xs">
                                {fiat.toUpperCase()}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            aria-expanded={open}
                            aria-label={`${open ? 'Close' : 'Edit'} ${code.toUpperCase()}`}
                            onClick={() => setEditing(open ? null : code)}
                          >
                            {open ? 'Close' : 'Edit'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground"
                            disabled={busy}
                            aria-label={`Remove ${code.toUpperCase()}`}
                            onClick={() => removeCurrency(code)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                      {open || rowError ? (
                        <div className="bg-muted/20 border-t">
                          <SettingsFieldGroup
                            legend={code.toUpperCase()}
                            description="Name, symbol, and what one unit is worth in each quoted currency."
                          >
                            <CurrencyField
                              id={`currency-${code}-name`}
                              title="Name"
                              required
                              busy={busy}
                              placeholder="Credits"
                              value={draft.text(`customCurrencies.${code}.name`)}
                              error={draft.error(`customCurrencies.${code}.name`)}
                              onChange={(value) =>
                                draft.setText(`customCurrencies.${code}.name`, value)
                              }
                            />
                            <CurrencyField
                              id={`currency-${code}-symbol`}
                              title="Symbol"
                              description="Printed beside the amount on an invoice."
                              required
                              busy={busy}
                              placeholder="✦"
                              value={draft.text(`customCurrencies.${code}.symbol`)}
                              error={draft.error(`customCurrencies.${code}.symbol`)}
                              last={fiats.length === 0}
                              onChange={(value) =>
                                draft.setText(`customCurrencies.${code}.symbol`, value)
                              }
                            />
                            {fiats.length === 0 ? (
                              <p className="text-muted-foreground px-5 pb-4 text-sm">
                                Add a fiat currency above to set what one {code.toUpperCase()} is
                                worth.
                              </p>
                            ) : (
                              fiats.map((fiat, fiatIndex) => {
                                const path = `customCurrencies.${code}.fiatConversionFactors.${fiat}`
                                return (
                                  <CurrencyField
                                    key={fiat}
                                    id={`currency-${code}-${fiat}`}
                                    title={`Value in ${fiat.toUpperCase()}`}
                                    description={`What one ${code.toUpperCase()} is worth in ${fiat.toUpperCase()}.`}
                                    required
                                    decimal
                                    busy={busy}
                                    placeholder="0.01"
                                    value={draft.text(path)}
                                    error={draft.error(path)}
                                    last={fiatIndex === fiats.length - 1}
                                    onChange={(value) => draft.setText(path, value)}
                                  />
                                )
                              })
                            )}
                          </SettingsFieldGroup>
                          {rowError ? (
                            <div className="px-5 pb-4">
                              <ActionError message={rowError} />
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
            {adding ? (
              <div className="flex flex-col gap-1 border-t px-5 py-3">
                <div className="flex max-w-md gap-2">
                  <Input
                    id="currency-add-code"
                    aria-label="Currency code"
                    disabled={busy}
                    placeholder="Three letters, e.g. cre: fixed once added"
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={codeIssue ? true : undefined}
                    value={newCode}
                    onChange={(event) => setNewCode(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addCurrency()
                      }
                    }}
                  />
                  <Button type="button" variant="outline" disabled={busy} onClick={addCurrency}>
                    Add
                  </Button>
                </div>
                <ActionError message={codeIssue} />
              </div>
            ) : null}
          </SettingsBlock>
        </Panel>
      </form>

      <ConfirmDialog
        open={resetting}
        onOpenChange={setResetting}
        title="Reset currency settings?"
        description="Every custom currency and conversion rate in this environment is removed. Invoices already issued keep the amounts they were given; new ones can only be priced in ordinary fiat currency."
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

/** One labelled input on a currency settings row. */
function CurrencyField({
  id,
  title,
  description,
  value,
  onChange,
  busy,
  error,
  required,
  placeholder,
  decimal,
  last,
}: {
  id: string
  title: string
  description?: string
  value: string
  onChange: (value: string) => void
  busy: boolean
  error: string | undefined
  required?: boolean
  placeholder?: string
  decimal?: boolean
  last?: boolean
}) {
  return (
    <SettingRow
      title={title}
      labelFor={id}
      {...(last ? { last: true } : {})}
      {...(required || description
        ? {
            titleAddon: (
              <>
                {required ? (
                  <span className="text-destructive" aria-hidden="true">
                    *
                  </span>
                ) : null}
                {description ? <DelayedHint text={description} /> : null}
              </>
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
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          {...(decimal ? { inputMode: 'decimal' as const } : {})}
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
