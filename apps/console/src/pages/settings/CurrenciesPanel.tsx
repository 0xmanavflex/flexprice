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
import { ConfirmDialog, EmptyState, Field, LoadingRows, Section } from '@fp/ui/compositions'
import { Button, Input } from '@fp/ui/primitives'
import { useSession } from '@/app/session'
import { ActionError, ActionNote, Panel, PanelError, mutationMessage, toFailure } from './panelKit'
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
        <Section
          title="Currencies"
          description="Stored per environment, so a sandbox rate cannot reach a real invoice."
        >
          <EmptyState
            size="inline"
            title="No environment selected"
            description="Choose an environment from the switcher to see the currencies it invoices in."
          />
        </Section>
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
          <Section
            title="Settlement currencies"
            description="The fiat currencies your custom currencies convert to. Every custom currency quotes the same set — that is the backend's rule, not a simplification here."
          >
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Quoted fiat currencies</span>
              {fiats.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  None yet. Add one before defining a custom currency.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {fiats.map((fiat) => (
                    <li
                      key={fiat}
                      className="flex items-center gap-1 rounded-md border py-1 pr-1 pl-2"
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
                          draft.update((current) => ({ ...current, defaultFiatCurrency: fiat }))
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
              <p className="text-muted-foreground text-xs">
                One of them is the settlement currency — what an invoice priced in a custom currency
                is actually collected in.
              </p>
              <ActionError message={draft.error('defaultFiatCurrency') ?? null} />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex max-w-sm items-end gap-2">
                <div className="flex-1">
                  <Field label="Add a fiat currency" hint="Three letters, for example usd.">
                    {({ id, ...field }) => (
                      <Input
                        id={id}
                        disabled={busy}
                        placeholder="usd"
                        autoComplete="off"
                        spellCheck={false}
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
                        {...field}
                      />
                    )}
                  </Field>
                </div>
                <Button type="button" variant="outline" disabled={busy} onClick={addFiat}>
                  Add
                </Button>
              </div>
              <ActionError message={fiatIssue} />
            </div>
          </Section>

          <Section
            title="Custom currencies"
            description="Units you invoice in that no central bank issues — credits, tokens, minutes, seats. Each needs a name, a symbol, and what one unit is worth in each fiat currency above."
          >
            {currencies.length === 0 ? (
              <EmptyState
                size="inline"
                title="No custom currencies"
                description="Invoices are denominated in ordinary fiat currency until you define one."
              />
            ) : (
              <ul className="flex flex-col gap-4">
                {currencies.map(([code]) => {
                  const rowError =
                    draft.error(`customCurrencies.${code}`) ??
                    draft.error(`customCurrencies.${code}.fiatConversionFactors`)

                  return (
                    <li key={code} className="flex flex-col gap-4 rounded-lg border p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-col">
                          <span className="font-mono text-sm font-medium">
                            {code.toUpperCase()}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            The code is fixed once added. Remove and re-add it to change it.
                          </span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => removeCurrency(code)}
                        >
                          Remove
                        </Button>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field
                          label="Name"
                          required
                          {...(draft.error(`customCurrencies.${code}.name`)
                            ? { error: draft.error(`customCurrencies.${code}.name`) }
                            : {})}
                        >
                          {({ id, ...field }) => (
                            <Input
                              id={id}
                              disabled={busy}
                              placeholder="Credits"
                              value={draft.text(`customCurrencies.${code}.name`)}
                              onChange={(event) =>
                                draft.setText(`customCurrencies.${code}.name`, event.target.value)
                              }
                              {...field}
                            />
                          )}
                        </Field>

                        <Field
                          label="Symbol"
                          required
                          hint="Printed beside the amount on an invoice."
                          {...(draft.error(`customCurrencies.${code}.symbol`)
                            ? { error: draft.error(`customCurrencies.${code}.symbol`) }
                            : {})}
                        >
                          {({ id, ...field }) => (
                            <Input
                              id={id}
                              disabled={busy}
                              placeholder="✦"
                              value={draft.text(`customCurrencies.${code}.symbol`)}
                              onChange={(event) =>
                                draft.setText(`customCurrencies.${code}.symbol`, event.target.value)
                              }
                              {...field}
                            />
                          )}
                        </Field>
                      </div>

                      {fiats.length === 0 ? (
                        <p className="text-muted-foreground text-sm">
                          Add a fiat currency above to set what one {code.toUpperCase()} is worth.
                        </p>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2">
                          {fiats.map((fiat) => {
                            const path = `customCurrencies.${code}.fiatConversionFactors.${fiat}`
                            return (
                              <Field
                                key={fiat}
                                label={`Value in ${fiat.toUpperCase()}`}
                                required
                                hint={`What one ${code.toUpperCase()} is worth in ${fiat.toUpperCase()}.`}
                                {...(draft.error(path) ? { error: draft.error(path) } : {})}
                              >
                                {({ id, ...field }) => (
                                  <Input
                                    id={id}
                                    disabled={busy}
                                    inputMode="decimal"
                                    placeholder="0.01"
                                    value={draft.text(path)}
                                    onChange={(event) => draft.setText(path, event.target.value)}
                                    {...field}
                                  />
                                )}
                              </Field>
                            )
                          })}
                        </div>
                      )}

                      {/*
                        The row-level complaints — a duplicate code, a clash
                        with the settlement currency, a missing rate — land on
                        the row rather than on any one input, because that is
                        what they are about.
                      */}
                      <ActionError message={rowError ?? null} />
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="flex flex-col gap-1.5">
              <div className="flex max-w-sm items-end gap-2">
                <div className="flex-1">
                  <Field label="Add a custom currency" hint="Three letters, for example cre.">
                    {({ id, ...field }) => (
                      <Input
                        id={id}
                        disabled={busy}
                        placeholder="cre"
                        autoComplete="off"
                        spellCheck={false}
                        value={newCode}
                        onChange={(event) => setNewCode(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            addCurrency()
                          }
                        }}
                        {...field}
                      />
                    )}
                  </Field>
                </div>
                <Button type="button" variant="outline" disabled={busy} onClick={addCurrency}>
                  Add
                </Button>
              </div>
              <ActionError message={codeIssue} />
            </div>
          </Section>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={busy}>
              {update.isPending ? 'Saving…' : 'Save changes'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setResetting(true)}
            >
              Reset to defaults
            </Button>
            <ActionError message={saveError} />
            {!saveError && update.isSuccess ? <ActionNote message="Saved." /> : null}
            {!resetError && reset.isSuccess ? <ActionNote message="Back to the defaults." /> : null}
          </div>
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
