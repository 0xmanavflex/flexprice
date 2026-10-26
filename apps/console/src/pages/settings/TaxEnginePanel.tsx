import { useState } from 'react'
import {
  EXTERNAL_TAX_PROVIDERS,
  TAX_PROVIDER_LABEL,
  type TaxConfig,
  TaxProvider,
  taxConfigSchema,
  usesExternalTaxEngine,
} from '@fp/domain'
import { useIntegrations, useResetTaxConfig, useTaxConfig, useUpdateTaxConfig } from '@fp/query'
import {
  ConfirmDialog,
  EmptyState,
  OptionSelect,
  SettingRow,
  SettingsFieldGroup,
} from '@fp/ui/compositions'
import { Button, Switch } from '@fp/ui/primitives'
import { useSession } from '@/app/session'
import {
  ActionError,
  ActionNote,
  DelayedHint,
  Panel,
  PanelError,
  PanelLoading,
  PanelUnavailable,
  SettingsBlock,
  mutationMessage,
  queryPhase,
  toFailure,
} from './panelKit'
import { useDraft } from './useDraft'

/**
 * Which engine calculates tax, as V1's Tax configuration section:
 * `GET/PUT/DELETE /settings/tax_config`.
 *
 * Off, Flexprice applies the tax rates set up under Taxes. On, Stripe Tax (the
 * only external engine the API supports) calculates tax on invoices and credit
 * notes instead. Turning it on picks Stripe Tax, so the switch means what it
 * says: the native engine named while on would be saved as "on" and change
 * nothing. Without a Stripe connection, tax calculation fails rather than
 * falling back, so that is said before anyone saves.
 */
export function TaxEnginePanel() {
  const { environmentId } = useSession()
  const config = useTaxConfig(environmentId)
  const failure = toFailure(config.error, 'your tax settings')

  if (!environmentId) {
    return (
      <Panel>
        <SettingsBlock label="Tax engine">
          <EmptyState
            size="inline"
            title="No environment selected"
            description="Choose an environment from the switcher to see how its tax is calculated."
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
  if (phase === 'loading' || !config.data) return <PanelLoading rows={2} />

  return <TaxEngineForm key={environmentId} environmentId={environmentId} config={config.data} />
}

const PROVIDER_OPTIONS = EXTERNAL_TAX_PROVIDERS.map((value) => ({
  value,
  label: TAX_PROVIDER_LABEL[value],
}))

function TaxEngineForm({ environmentId, config }: { environmentId: string; config: TaxConfig }) {
  const update = useUpdateTaxConfig(environmentId)
  const reset = useResetTaxConfig(environmentId)
  const draft = useDraft<TaxConfig>(taxConfigSchema, config)
  const [resetting, setResetting] = useState(false)

  const external = usesExternalTaxEngine(draft.value)
  // Asked only once Stripe Tax is chosen: it is the one thing worth checking first.
  const integrations = useIntegrations()
  const stripe = integrations.data?.find((item) => item.providerType === TaxProvider.Stripe)
  const missingConnection =
    external &&
    draft.value.provider === TaxProvider.Stripe &&
    integrations.isSuccess &&
    (stripe?.connections ?? 0) === 0

  const saveError = mutationMessage(update.error, 'The tax settings could not be saved.')
  const resetError = mutationMessage(reset.error, 'The tax settings could not be reset.')
  const busy = update.isPending || reset.isPending

  function setEnabled(enabled: boolean) {
    draft.update((current) => ({
      enabled,
      // On means an external engine: seed the only one there is.
      provider:
        enabled &&
        (current.provider === TaxProvider.Native || current.provider === TaxProvider.Flexprice)
          ? TaxProvider.Stripe
          : current.provider,
    }))
  }

  const info = external ? (
    <>
      <span>
        {TAX_PROVIDER_LABEL[draft.value.provider]} calculates tax on invoices and credit notes. Your
        Flexprice tax rates are no longer applied, and attaching new rates or overriding them is
        refused. Credit notes keep the tax treatment of the invoice they are raised against.
      </span>
      {missingConnection ? (
        <span className="text-foreground">
          No Stripe connection was found in this environment. Without one, tax calculation fails; it
          does not fall back to your Flexprice tax rates. Connect Stripe under Integrations first.
        </span>
      ) : null}
    </>
  ) : (
    'Flexprice calculates tax from the tax rates set up under Taxes.'
  )

  return (
    <>
      <form
        className="contents"
        noValidate
        onSubmit={draft.handleSubmit((value) =>
          update.mutate(value, { onSuccess: (saved) => draft.reset(saved) }),
        )}
      >
        <Panel>
          <SettingsBlock
            label="Tax engine"
            flush
            info={info}
            actions={
              <div className="flex w-full flex-wrap items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setResetting(true)}
                >
                  Reset to defaults
                </Button>
                <div className="flex items-center gap-3">
                  <ActionError message={saveError} />
                  {!saveError && update.isSuccess ? <ActionNote message="Saved." /> : null}
                  {!resetError && reset.isSuccess ? (
                    <ActionNote message="Back to the defaults." />
                  ) : null}
                  <Button type="submit" variant="outline" disabled={busy}>
                    {update.isPending ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              </div>
            }
          >
            <SettingsFieldGroup
              legend="Tax engine"
              description="Use an external tax engine to calculate tax on invoices and credit notes instead of your Flexprice tax rates."
            >
              <SettingRow
                title="Use an external tax engine"
                titleAddon={
                  <DelayedHint text="When off, Flexprice calculates tax from the tax rates you have configured." />
                }
                labelFor="tax-engine-enabled"
                last={!draft.value.enabled}
              >
                <Switch
                  id="tax-engine-enabled"
                  checked={draft.value.enabled}
                  disabled={busy}
                  onCheckedChange={setEnabled}
                />
              </SettingRow>
              {draft.value.enabled ? (
                <SettingRow
                  title="Tax engine"
                  titleAddon={
                    <DelayedHint text="Which engine calculates tax. Stripe Tax is the only external engine currently supported." />
                  }
                  labelFor="tax-engine-provider"
                  last
                >
                  <OptionSelect
                    id="tax-engine-provider"
                    value={
                      draft.value.provider === TaxProvider.Stripe ? draft.value.provider : undefined
                    }
                    onValueChange={(provider) =>
                      draft.update((current) => ({ ...current, provider: provider as TaxProvider }))
                    }
                    options={PROVIDER_OPTIONS}
                    disabled={busy}
                  />
                </SettingRow>
              ) : null}
            </SettingsFieldGroup>
          </SettingsBlock>
        </Panel>
      </form>

      <ConfirmDialog
        open={resetting}
        onOpenChange={setResetting}
        title="Reset tax settings?"
        description="This environment goes back to Flexprice calculating tax from your tax rates."
        confirmLabel="Reset to defaults"
        destructive
        isPending={reset.isPending}
        error={resetError}
        onConfirm={() =>
          reset.mutate(undefined, {
            onSuccess: (defaults) => {
              draft.reset(defaults)
              setResetting(false)
            },
          })
        }
      />
    </>
  )
}
