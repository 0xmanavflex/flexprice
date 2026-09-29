import {
  PORTAL_TAB_TYPE_LABEL,
  type CustomerPortalConfig,
  type PortalSection,
  type PortalTab,
  customerPortalConfigSchema,
  orderedSections,
  orderedTabs,
  portalTabLabel,
  visibleTabTypes,
  withMetricCards,
  withSectionEnabled,
  withSectionOrder,
  withTabEnabled,
  withTabOrder,
  withUsageGraph,
} from '@fp/domain'
import {
  useCustomerPortalConfig,
  useResetCustomerPortalConfig,
  useUpdateCustomerPortalConfig,
} from '@fp/query'
import { EmptyState, Field, LoadingRows, Section } from '@fp/ui/compositions'
import { Button, Input } from '@fp/ui/primitives'
import { LayoutPanelLeftIcon } from 'lucide-react'
import { useSession } from '@/app/session'
import {
  ActionError,
  ActionNote,
  Fact,
  Panel,
  PanelError,
  mutationMessage,
  toFailure,
} from './panelKit'
import { useDraft } from './useDraft'

/**
 * What a customer sees when they open their own portal.
 *
 * `GET/PUT/DELETE /settings/customer_portal_config`.
 *
 * ## The trap this panel exists to avoid
 *
 * The stored value is not a handful of switches. It is an **ordered tree**:
 * sections, each with a label and a position, each holding ordered tabs, each
 * tab typed, and two tab types carrying a payload of their own — which metric
 * cards to show, which date presets the usage graph offers. Above them sit a
 * format `version` and a typed `theme`.
 *
 * V1's portal screen renders five booleans, because five booleans is what its
 * form needed, and **rebuilds the config object out of those five booleans on
 * save**. Arrays are replaced wholesale by the write, so that is not a partial
 * edit — it is a deletion. Every section label, every ordering and every graph
 * preset a portal was configured with disappears on the next save, with
 * nothing on screen to say so.
 *
 * So this panel never constructs a config. It loads one, edits it through the
 * `with…` helpers in `@fp/domain` — each of which returns the whole tree with
 * one thing changed and everything else carried through untouched — and passes
 * the whole thing back to the write. Reading goes through `orderedSections` /
 * `orderedTabs` rather than array order, because the API does not promise the
 * arrays are sorted; `order` is what the portal renders by.
 *
 * `version` is echoed, not edited: it is the config format's own version, and
 * a console that rewrites it is claiming to have migrated something.
 *
 * ## What is deliberately not editable here
 *
 * Section labels, tab types and the usage graph's preset *vocabulary* are
 * shown but not edited. The tab type list is open — the backend types it as an
 * unconstrained string — and a portal configured by something newer than this
 * console must survive being read, rendered as best we can, and written back
 * unchanged. Offering a picker over a closed list this build happens to know
 * would quietly narrow somebody else's portal.
 */
export function PortalPanel() {
  const { environmentId } = useSession()
  const portal = useCustomerPortalConfig(environmentId)

  const failure = toFailure(portal.error, 'your customer portal settings')

  if (failure) {
    return (
      <Panel>
        <PanelError failure={failure} onRetry={() => void portal.refetch()} />
      </Panel>
    )
  }

  if (!environmentId || portal.isPending || !portal.data) {
    return (
      <Panel>
        <LoadingRows rows={6} columns={2} />
      </Panel>
    )
  }

  return <PortalForm key={environmentId} environmentId={environmentId} config={portal.data} />
}

/** Moves one id within an ordered list, or leaves the list alone at its ends. */
function reorder(ids: readonly string[], id: string, delta: number): string[] {
  const at = ids.indexOf(id)
  const to = at + delta
  if (at === -1 || to < 0 || to >= ids.length) return [...ids]

  const next = [...ids]
  const [moved] = next.splice(at, 1)
  if (moved === undefined) return [...ids]
  next.splice(to, 0, moved)
  return next
}

function PortalForm({
  environmentId,
  config,
}: {
  environmentId: string
  config: CustomerPortalConfig
}) {
  const update = useUpdateCustomerPortalConfig(environmentId)
  const reset = useResetCustomerPortalConfig(environmentId)
  const draft = useDraft<CustomerPortalConfig>(customerPortalConfigSchema, config)

  const busy = update.isPending || reset.isPending
  const saveError =
    mutationMessage(update.error, 'The portal settings could not be saved.') ??
    mutationMessage(reset.error, 'The portal settings could not be reset.')

  const sections = orderedSections(draft.value)
  // Deduplicated: the same tab type may appear in two sections, and a summary
  // reading "Invoices, Invoices" looks like a rendering bug rather than a fact.
  const visible = [...new Set(visibleTabTypes(draft.value))].map(portalTabLabel)

  return (
    <form
      className="contents"
      noValidate
      onSubmit={draft.handleSubmit((value) => {
        // The tree as it was loaded and mutated — never a rebuilt object.
        update.mutate(value, { onSuccess: (saved) => draft.reset(saved) })
      })}
    >
      <Panel>
        <Section
          title="Customer portal"
          description="The sections and tabs a customer sees when they sign in to their own portal. A tab is only reachable if its section is switched on too."
          actions={
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => {
                update.reset()
                reset.mutate(undefined, { onSuccess: (defaults) => draft.reset(defaults) })
              }}
            >
              {reset.isPending ? 'Resetting…' : 'Reset to defaults'}
            </Button>
          }
        >
          <dl className="grid gap-4 sm:grid-cols-2">
            <Fact label="Config version">
              <span className="font-mono text-xs">{draft.value.version || '—'}</span>
            </Fact>
            <Fact label="Visible to customers">
              {visible.length === 0 ? 'Nothing — the portal is empty' : visible.join(', ')}
            </Fact>
          </dl>
        </Section>

        {sections.length === 0 ? (
          <Section title="Sections" description="Nothing is configured for this environment yet.">
            <EmptyState
              size="inline"
              icon={<LayoutPanelLeftIcon aria-hidden />}
              title="This portal has no sections"
              description="Resetting to defaults asks the server for its standard layout, which is the only place a starting tree can honestly come from."
            />
          </Section>
        ) : (
          sections.map((section, index) => (
            <SectionCard
              key={section.id}
              section={section}
              busy={busy}
              isFirst={index === 0}
              isLast={index === sections.length - 1}
              onToggle={(enabled) =>
                draft.update((current) => withSectionEnabled(current, section.id, enabled))
              }
              onMove={(delta) =>
                draft.update((current) =>
                  withSectionOrder(
                    current,
                    reorder(
                      orderedSections(current).map((each) => each.id),
                      section.id,
                      delta,
                    ),
                  ),
                )
              }
              onMoveTab={(tabId, delta) =>
                draft.update((current) => {
                  const live = current.sections.find((each) => each.id === section.id)
                  if (!live) return current
                  return withTabOrder(
                    current,
                    section.id,
                    reorder(
                      orderedTabs(live).map((tab) => tab.id),
                      tabId,
                      delta,
                    ),
                  )
                })
              }
              onToggleTab={(tabId, enabled) =>
                draft.update((current) => withTabEnabled(current, section.id, tabId, enabled))
              }
              onMetricCards={(tabId, patch) =>
                draft.update((current) => withMetricCards(current, section.id, tabId, patch))
              }
              onUsageGraph={(tabId, patch) =>
                draft.update((current) => withUsageGraph(current, section.id, tabId, patch))
              }
            />
          ))
        )}

        <Section
          title="Theme"
          description="The three colours the backend stores. Anything else V1's theme editor offered was never saved, so it is not offered here."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <ColorField label="Primary" path="theme.primaryColor" draft={draft} busy={busy} />
            <ColorField label="Secondary" path="theme.secondaryColor" draft={draft} busy={busy} />
            <ColorField label="Tertiary" path="theme.tertiaryColor" draft={draft} busy={busy} />
          </div>
        </Section>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy}>
            {update.isPending ? 'Saving…' : 'Save changes'}
          </Button>
          <ActionError message={saveError} />
          {!saveError && update.isSuccess ? <ActionNote message="Saved." /> : null}
          {!saveError && reset.isSuccess ? <ActionNote message="Back to the defaults." /> : null}
        </div>
      </Panel>
    </form>
  )
}

function ColorField({
  label,
  path,
  draft,
  busy,
}: {
  label: string
  path: string
  draft: ReturnType<typeof useDraft<CustomerPortalConfig>>
  busy: boolean
}) {
  return (
    <Field
      label={`${label} colour`}
      hint="A CSS colour, or blank."
      {...(draft.error(path) ? { error: draft.error(path) } : {})}
    >
      {({ id, ...field }) => (
        <Input
          id={id}
          disabled={busy}
          placeholder="#0f172a"
          value={draft.text(path)}
          onChange={(event) => draft.setText(path, event.target.value)}
          {...field}
        />
      )}
    </Field>
  )
}

function SectionCard({
  section,
  busy,
  isFirst,
  isLast,
  onToggle,
  onMove,
  onToggleTab,
  onMoveTab,
  onMetricCards,
  onUsageGraph,
}: {
  section: PortalSection
  busy: boolean
  isFirst: boolean
  isLast: boolean
  onToggle: (enabled: boolean) => void
  onMove: (delta: number) => void
  onToggleTab: (tabId: string, enabled: boolean) => void
  onMoveTab: (tabId: string, delta: number) => void
  onMetricCards: (tabId: string, patch: Partial<NonNullable<PortalTab['metricCards']>>) => void
  onUsageGraph: (tabId: string, patch: Partial<NonNullable<PortalTab['usageGraph']>>) => void
}) {
  const tabs = orderedTabs(section)

  return (
    <Section
      title={section.label || `Section ${section.id}`}
      description={
        section.enabled
          ? 'Shown in the portal. Its switched-on tabs are reachable.'
          : 'Hidden. None of its tabs are reachable, however they are set below.'
      }
      actions={
        <>
          <OnOff
            label={`${section.label || 'Section'} visibility`}
            on={section.enabled}
            busy={busy}
            onChange={onToggle}
          />
          <MoveButtons
            label={section.label || 'Section'}
            busy={busy}
            isFirst={isFirst}
            isLast={isLast}
            onMove={onMove}
          />
        </>
      }
    >
      {tabs.length === 0 ? (
        <p className="text-muted-foreground text-xs">This section has no tabs.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tabs.map((tab, index) => (
            <li key={tab.id} className="flex flex-col gap-3 rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{portalTabLabel(tab.type)}</span>
                  <span className="text-muted-foreground font-mono text-xs">
                    {tab.type}
                    {tab.type in PORTAL_TAB_TYPE_LABEL
                      ? ''
                      : ' — a tab type this console does not know; it is kept as it is'}
                  </span>
                </span>
                <span className="flex gap-1.5">
                  <OnOff
                    label={`${portalTabLabel(tab.type)} visibility`}
                    on={tab.enabled}
                    busy={busy}
                    onChange={(enabled) => onToggleTab(tab.id, enabled)}
                  />
                  <MoveButtons
                    label={portalTabLabel(tab.type)}
                    busy={busy}
                    isFirst={index === 0}
                    isLast={index === tabs.length - 1}
                    onMove={(delta) => onMoveTab(tab.id, delta)}
                  />
                </span>
              </div>

              {tab.metricCards ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium">Cards on this tab</span>
                  <div role="group" aria-label="Metric cards" className="flex flex-wrap gap-1.5">
                    <Toggle
                      label="Cost"
                      on={tab.metricCards.showCostMetrics}
                      busy={busy}
                      onChange={(showCostMetrics) => onMetricCards(tab.id, { showCostMetrics })}
                    />
                    <Toggle
                      label="Custom"
                      on={tab.metricCards.showCustomMetrics}
                      busy={busy}
                      onChange={(showCustomMetrics) => onMetricCards(tab.id, { showCustomMetrics })}
                    />
                    <Toggle
                      label="Revenue"
                      on={tab.metricCards.showRevenueMetric}
                      busy={busy}
                      onChange={(showRevenueMetric) => onMetricCards(tab.id, { showRevenueMetric })}
                    />
                  </div>
                </div>
              ) : null}

              {tab.usageGraph ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium">Date range</span>
                    <div>
                      <Toggle
                        label="Customers may pick their own dates"
                        on={tab.usageGraph.allowCustomDateRange}
                        busy={busy}
                        onChange={(allowCustomDateRange) =>
                          onUsageGraph(tab.id, { allowCustomDateRange })
                        }
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium">Opens on</span>
                    {tab.usageGraph.datePresets.length === 0 ? (
                      <p className="text-muted-foreground text-xs">
                        This graph offers no presets, so there is nothing to default to.
                      </p>
                    ) : (
                      <div
                        role="group"
                        aria-label="Default preset"
                        className="flex flex-wrap gap-1.5"
                      >
                        {tab.usageGraph.datePresets.map((preset) => (
                          <Button
                            key={preset}
                            type="button"
                            size="xs"
                            variant={
                              tab.usageGraph?.defaultPreset === preset ? 'default' : 'outline'
                            }
                            aria-pressed={tab.usageGraph?.defaultPreset === preset}
                            disabled={busy}
                            onClick={() => onUsageGraph(tab.id, { defaultPreset: preset })}
                          >
                            {preset.replaceAll('_', ' ')}
                          </Button>
                        ))}
                      </div>
                    )}
                    <p className="text-muted-foreground text-xs">
                      The preset list and the feature filter mode
                      {tab.usageGraph.featureFilterMode
                        ? ` (${tab.usageGraph.featureFilterMode})`
                        : ''}{' '}
                      are the portal&rsquo;s own vocabulary and are carried through untouched.
                    </p>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

/**
 * On/off as two buttons.
 *
 * `@fp/ui/primitives` does not re-export a switch or a checkbox, and
 * `aria-pressed` on a pair of buttons is the pattern the other settings panels
 * already use — see `RolePicker` and `AlertRulesPanel`.
 */
function OnOff({
  label,
  on,
  busy,
  onChange,
}: {
  label: string
  on: boolean
  busy: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <span role="group" aria-label={label} className="flex gap-1.5">
      <Button
        type="button"
        size="xs"
        variant={on ? 'default' : 'outline'}
        aria-pressed={on}
        disabled={busy}
        onClick={() => onChange(true)}
      >
        On
      </Button>
      <Button
        type="button"
        size="xs"
        variant={on ? 'outline' : 'default'}
        aria-pressed={!on}
        disabled={busy}
        onClick={() => onChange(false)}
      >
        Off
      </Button>
    </span>
  )
}

/** A single labelled toggle, for the payload switches inside a tab. */
function Toggle({
  label,
  on,
  busy,
  onChange,
}: {
  label: string
  on: boolean
  busy: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <Button
      type="button"
      size="xs"
      variant={on ? 'default' : 'outline'}
      aria-pressed={on}
      disabled={busy}
      onClick={() => onChange(!on)}
    >
      {label}
    </Button>
  )
}

function MoveButtons({
  label,
  busy,
  isFirst,
  isLast,
  onMove,
}: {
  label: string
  busy: boolean
  isFirst: boolean
  isLast: boolean
  onMove: (delta: number) => void
}) {
  return (
    <span className="flex gap-1.5">
      <Button
        type="button"
        size="xs"
        variant="ghost"
        aria-label={`Move ${label} up`}
        disabled={busy || isFirst}
        onClick={() => onMove(-1)}
      >
        ↑
      </Button>
      <Button
        type="button"
        size="xs"
        variant="ghost"
        aria-label={`Move ${label} down`}
        disabled={busy || isLast}
        onClick={() => onMove(1)}
      >
        ↓
      </Button>
    </span>
  )
}
