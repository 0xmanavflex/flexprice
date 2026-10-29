import {
  type BonusCreditsConfig,
  bonusCreditsConfigSchema,
  bonusExpiryText,
  bonusText,
  emptyBonusSlab,
  sortBonusSlabs,
} from '@fp/domain'
import {
  useBonusCreditsConfig,
  useResetBonusCreditsConfig,
  useUpdateBonusCreditsConfig,
} from '@fp/query'
import { FormCard, FormRow, Section, SectionEmpty } from '@fp/ui/compositions'
import { BonusSlabTable, type BonusSlabRowError } from '@fp/ui/pages'
import { Button, Switch } from '@fp/ui/primitives'
import { InfoIcon, PlusIcon } from '@fp/ui/icons'
import { useSession } from '@/app/session'
import {
  ActionError,
  ActionNote,
  Panel,
  PanelError,
  PanelLoading,
  PanelUnavailable,
  mutationMessage,
  queryPhase,
  toFailure,
} from './panelKit'
import { useDraft } from './useDraft'

/**
 * Bonus credits on purchased wallet top-ups, for every wallet in the environment.
 *
 * `GET/PUT/DELETE /settings/bonus_credits_topup_config`. Slabs say "a top-up of
 * at least N credits earns this bonus"; the backend takes the highest one a
 * top-up clears and wants them stored highest first, which the request does,
 * so they can be typed in any order. Free credit grants never earn a bonus.
 *
 * Laid out as Wallet alerts is: one `FormCard`, the switch, then the slabs.
 * The whole config goes back on every save.
 */
export function BonusCreditsPanel() {
  const { environmentId } = useSession()
  const config = useBonusCreditsConfig(environmentId)

  const failure = toFailure(config.error, 'your bonus credit settings')
  if (failure) {
    return (
      <Panel>
        <PanelError failure={failure} onRetry={() => void config.refetch()} />
      </Panel>
    )
  }

  if (!environmentId) {
    return (
      <PanelUnavailable reason="setup" description="Choose an environment to see these settings." />
    )
  }

  const phase = queryPhase(config)
  if (phase === 'idle') return <PanelUnavailable reason="unavailable" />
  if (phase === 'loading' || !config.data) return <PanelLoading rows={4} />

  return <BonusCreditsForm key={environmentId} environmentId={environmentId} config={config.data} />
}

function BonusCreditsForm({
  environmentId,
  config,
}: {
  environmentId: string
  config: BonusCreditsConfig
}) {
  const update = useUpdateBonusCreditsConfig(environmentId)
  const reset = useResetBonusCreditsConfig(environmentId)
  const draft = useDraft<BonusCreditsConfig>(bonusCreditsConfigSchema, config)

  const busy = update.isPending || reset.isPending
  const saveError =
    mutationMessage(update.error, 'The bonus credit settings could not be saved.') ??
    mutationMessage(reset.error, 'The bonus credit settings could not be reset.')

  const rowErrors: Record<number, BonusSlabRowError> = {}
  draft.value.slabs.forEach((_, index) => {
    const threshold = draft.error(`slabs.${index}.threshold`)
    const bonusValue = draft.error(`slabs.${index}.bonusValue`)
    const expiryDuration = draft.error(`slabs.${index}.expiryDuration`)
    if (threshold || bonusValue || expiryDuration)
      rowErrors[index] = { threshold, bonusValue, expiryDuration }
  })
  const listError = draft.error('slabs')
  // What the saved order reads as, highest first: the rule the backend applies.
  const preview = sortBonusSlabs(draft.value.slabs).filter((slab) => slab.threshold.trim())

  return (
    <form
      className="contents"
      noValidate
      onSubmit={draft.handleSubmit((value) => {
        update.mutate(value, { onSuccess: (saved) => draft.reset(saved) })
      })}
    >
      <Panel>
        <FormCard>
          <div className="text-muted-foreground flex items-start gap-2 px-5 py-4 text-[13px] sm:px-6">
            <InfoIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <p>
              Purchased top-ups earn bonus credits by size: the highest slab a top-up reaches
              applies. Free grants never earn a bonus. A bonus amount or expiry entered on a top-up
              overrides these.
            </p>
          </div>

          <FormRow
            label="Bonus credits"
            hint="Off grants no bonus from slabs. Slabs are kept, so turning it back on restores them."
          >
            {(props) => (
              <div className="flex items-center gap-2">
                <Switch
                  id={props.id}
                  aria-describedby={props['aria-describedby']}
                  checked={draft.value.enabled}
                  disabled={busy}
                  onCheckedChange={(checked) =>
                    draft.update((current) => ({ ...current, enabled: checked }))
                  }
                />
                <span className="text-muted-foreground text-sm">
                  {draft.value.enabled ? 'On' : 'Off'}
                </span>
              </div>
            )}
          </FormRow>
        </FormCard>

        {/* Full width: four columns of inputs do not fit a form row's control column. */}
        <Section
          title="Slabs"
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                draft.update((current) => ({
                  ...current,
                  slabs: [...current.slabs, emptyBonusSlab()],
                }))
              }
            >
              <PlusIcon aria-hidden />
              Add slab
            </Button>
          }
          bodyClassName="flex flex-col gap-3"
        >
          {draft.value.slabs.length === 0 ? (
            <SectionEmpty
              title="No slabs yet"
              description="A slab says how big a top-up must be to earn a bonus, and how much it earns."
            />
          ) : (
            <BonusSlabTable
              slabs={draft.value.slabs}
              rowErrors={rowErrors}
              disabled={busy}
              onChange={(slabs) => draft.update((current) => ({ ...current, slabs }))}
            />
          )}
          {listError ? (
            <p role="alert" className="text-destructive text-sm">
              {listError}
            </p>
          ) : null}
          {preview.length > 0 ? (
            <ul className="text-muted-foreground flex flex-col gap-0.5 text-[13px]">
              {preview.map((slab, index) => (
                <li key={`${slab.threshold}-${index}`}>
                  From {slab.threshold} credits: {bonusText(slab)}, {bonusExpiryText(slab)}.
                </li>
              ))}
            </ul>
          ) : null}
        </Section>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <ActionError message={saveError} />
          {!saveError && update.isSuccess ? <ActionNote message="Saved." /> : null}
          {!saveError && reset.isSuccess ? <ActionNote message="Back to the defaults." /> : null}
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              update.reset()
              reset.mutate(undefined, { onSuccess: (defaults) => draft.reset(defaults) })
            }}
          >
            {reset.isPending ? 'Resetting…' : 'Reset to defaults'}
          </Button>
          <Button type="submit" disabled={busy}>
            {update.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </Panel>
    </form>
  )
}
