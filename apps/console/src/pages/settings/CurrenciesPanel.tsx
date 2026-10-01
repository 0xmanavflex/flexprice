import { useState } from 'react'
import {
  type CustomCurrencyConfig,
  customCurrencyConfigSchema,
  emptyCustomCurrency,
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
  LoadingRows,
  SettingRow,
  SettingsCard,
  SettingsFieldGroup,
} from '@fp/ui/compositions'
import { Button, Input } from '@fp/ui/primitives'
import { useSession } from '@/app/session'
import { ActionError, ActionNote, Panel, PanelError, mutationMessage, toFailure, SettingsBlock } from './panelKit'
import { useDraft } from './useDraft'

/**
 * A tenant's own currencies, and what they are worth.
 *
 * `GET/PUT/DELETE /settings/custom_currency_config`. A custom currency is a
 * unit you invoice in that no central bank issues — credits, tokens, minutes,
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
 * keystroke — `u`, `us`, `usd` — which changes the React key under the cursor
 * and steals focus mid-word, and briefly writes keys the schema rejects. A
 * currency is three letters, a name and a symbol; removing and re-adding one
 * is cheaper than a rename that fights the person doing it.
 */
export function CurrenciesPanel() {
  const { environmentId } = useSession()
  const config = useCustomCurrencyConfig(environmentId)

  const failure = toFailure(config.error, 'your currency settings')

  if (!environmentId) {
    return (
      <Panel>
        <SettingsBlock
          title="Currencies"
          description="Stored per environment, so a sandbox rate cannot reach a real invoice."
        >
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

  if (config.isPending || !config.data) {
    return (
      <Panel>
        <LoadingRows rows={4} columns={3} />
      </Panel>
    )
  }

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
   * having no custom currencies at all — `quotedFiatCurrencies` reads the set
   * off the first currency, so with none there would be nowhere for a
   * just-added fiat to live until a currency existed to hold it.
   */
  const [fiats, setFiats] = useState<string[]>(() => quotedFiatCurrencies(config))

  const [newFiat, setNewFiat] = useState('')
  const [fiatIssue, setFiatIssue] = useState<string | null>(null)
  const [newCode, setNewCode] = useState('')
  const [codeIssue, setCodeIssue] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)

  const saveError = mutationMessage(update.error, 'The currency settings could not be saved.')
  const resetError = mutationMessage(reset.error, 'The currency settings could not be reset.')
  const busy = update.isPending || reset.isPending

  const currencies = Object.entries(draft.value.customCurrencies)
  const settlement = normalise(draft.value.defaultFiatCurrency)

  function reseed(saved: CustomCurrencyConfig) {
    draft.reset(saved)
    setFiats(quotedFiatCurrencies(saved))
    setNewFiat('')
    setFiatIssue(null)
    setNewCode('')
    setCodeIssue(null)
  }

  function addFiat() {
    const code = normalise(newFiat)
    if (!CODE.test(code)) {
      setFiatIssue('A currency code is three letters, for example usd.')
      return
    }
    if (fiats.includes(code)) {
      setFiatIssue(`${code.toUpperCase()} is already quoted.`)
      return
    }

    setFiatIssue(null)
    setNewFiat('')
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
          <SettingsCard
            title="Settlement currencies"
            description="The fiat currencies your custom currencies convert to. Every custom currency quotes the same set — that is the backend's rule, not a simplification here."
          >
            <SettingsFieldGroup
              legend="Settlement currencies"
              description="The fiat currencies custom currencies convert to."
            >
              <SettingRow
                title="Quoted currencies"
                description="One of them is the settlement currency — what an invoice priced in a custom currency is actually collected in."
                contentClassName="@md/field-group:w-96"
                last={false}
              >
                <div className="flex w-full flex-col gap-2">
                  {fiats.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      None yet. Add one before defining a custom currency.
                    </p>
                  ) : (
                    <ul className="flex flex-wrap justify-end gap-2">
                      {fiats.map((fiat) => (
                        <li
                          key={fiat}
                          className="bg-muted/40 flex items-center gap-1 rounded-lg border py-1 pr-1 pl-2"
                        >
                          <span className="font-mono text-sm">{fiat.toUpperCase()}</span>
                          <Button
                            type="button"
                            size="xs"
                            disabled={busy}
                            variant={settlement === fiat ? 'default' : 'ghost'}
                            aria-pressed={settlement === fiat}
                            aria-label={`Settle in ${fiat.toUpperCase()}`}
                            onClick={() =>
                              draft.update((current) => ({
                                ...current,
                                defaultFiatCurrency: fiat,
                              }))
                            }
                          >
                            {settlement === fiat ? 'Settlement' : 'Use'}
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            disabled={busy}
                            aria-label={`Remove ${fiat.toUpperCase()}`}
                            onClick={() => removeFiat(fiat)}
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <ActionError message={draft.error('defaultFiatCurrency') ?? null} />
                </div>
              </SettingRow>
              <SettingRow
                title="Add a fiat currency"
                description="Three letters, for example usd."
                labelFor="currency-add-fiat"
                last
              >
                <div className="flex w-full flex-col gap-1">
                  <div className="flex gap-2">
                    <Input
                      id="currency-add-fiat"
                      disabled={busy}
                      placeholder="usd"
                      autoComplete="off"
                      spellCheck={false}
                      aria-invalid={fiatIssue ? true : undefined}
                      value={newFiat}
                      onChange={(event) => setNewFiat(event.target.value)}
                      onKeyDown={(event) => {
                        // A three-letter code plus Enter should not submit
                        // the whole form — it should add the code.
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          addFiat()
                        }
                      }}
                    />
                    <Button type="button" variant="outline" disabled={busy} onClick={addFiat}>
                      Add
                    </Button>
                  </div>
                  <ActionError message={fiatIssue} />
                </div>
              </SettingRow>
            </SettingsFieldGroup>
          </SettingsCard>

          {currencies.length === 0 ? (
            <SettingsCard
              title="Custom currencies"
              description="Units you invoice in that no central bank issues — credits, tokens, minutes, seats."
            >
              <div className="px-5 py-4">
                <EmptyState
                  size="inline"
                  title="No custom currencies"
                  description="Invoices are denominated in ordinary fiat currency until you define one."
                />
              </div>
            </SettingsCard>
          ) : (
            currencies.map(([code]) => {
              const rowError =
                draft.error(`customCurrencies.${code}`) ??
                draft.error(`customCurrencies.${code}.fiatConversionFactors`)
              const nameError = draft.error(`customCurrencies.${code}.name`)
              const symbolError = draft.error(`customCurrencies.${code}.symbol`)

              return (
                <SettingsCard
                  key={code}
                  title={code.toUpperCase()}
                  description="The code is fixed once added. Remove it and add it again to change the code."
                  footer={
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => removeCurrency(code)}
                    >
                      Remove {code.toUpperCase()}
                    </Button>
                  }
                >
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
                      error={nameError}
                      onChange={(value) => draft.setText(`customCurrencies.${code}.name`, value)}
                    />
                    <CurrencyField
                      id={`currency-${code}-symbol`}
                      title="Symbol"
                      description="Printed beside the amount on an invoice."
                      required
                      busy={busy}
                      placeholder="✦"
                      value={draft.text(`customCurrencies.${code}.symbol`)}
                      error={symbolError}
                      last={fiats.length === 0}
                      onChange={(value) => draft.setText(`customCurrencies.${code}.symbol`, value)}
                    />
                    {fiats.length === 0 ? (
                      <p className="text-muted-foreground px-5 pb-4 text-sm">
                        Add a fiat currency above to set what one {code.toUpperCase()} is worth.
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
                </SettingsCard>
              )
            })
          )}

          <SettingsCard
            title="Add a currency"
            description="Three letters, for example cre. Each currency needs a name, a symbol, and a rate in every quoted fiat currency."
            footer={
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
            <SettingsFieldGroup legend="Add a currency" description="Three letters, for example cre.">
              <SettingRow
                title="Currency code"
                description="Three letters. It cannot be changed after it is added."
                labelFor="currency-add-code"
                last
              >
                <div className="flex w-full flex-col gap-1">
                  <div className="flex gap-2">
                    <Input
                      id="currency-add-code"
                      disabled={busy}
                      placeholder="cre"
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
              </SettingRow>
            </SettingsFieldGroup>
          </SettingsCard>
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
      {...(description ? { description } : {})}
      {...(last ? { last: true } : {})}
      {...(required
        ? { titleAddon: <span className="text-destructive" aria-hidden="true">*</span> }
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
