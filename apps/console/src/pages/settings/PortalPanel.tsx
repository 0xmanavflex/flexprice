import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import {
  PORTAL_PROPERTY_KEY,
  PORTAL_SECTION_PARTS,
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
  withTabTypeEnabled,
  withUsageGraph,
  withUsageProperties,
} from '@fp/domain'
import {
  useCustomerPortalConfig,
  useResetCustomerPortalConfig,
  useUpdateCustomerPortalConfig,
  useUsagePropertyKeys,
} from '@fp/query'
import {
  CheckboxRow,
  EmptyState,
  Field,
  OptionSelect,
  SortableItem,
  SortableList,
} from '@fp/ui/compositions'
import { Button, Input } from '@fp/ui/primitives'
import { EyeIcon, EyeOffIcon } from '@fp/ui/icons'
import { useSession } from '@/app/session'
import {
  ActionError,
  ActionNote,
  DelayedHint,
  Fact,
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
 * What a customer sees when they open their own portal.
 *
 * `GET/PUT/DELETE /settings/customer_portal_config`.
 *
 * ## The trap this panel exists to avoid
 *
 * The stored value is not a handful of switches. It is an **ordered tree**:
 * sections, each with a label and a position, each holding ordered tabs, each
 * tab typed, and two tab types carrying a payload of their own: which metric
 * cards to show, which date presets the usage graph offers. Above them sit a
 * format `version` and a typed `theme`.
 *
 * V1's portal screen renders five booleans, because five booleans is what its
 * form needed, and **rebuilds the config object out of those five booleans on
 * save**. Arrays are replaced wholesale by the write, so that is not a partial
 * edit: it is a deletion. Every section label, every ordering and every graph
 * preset a portal was configured with disappears on the next save, with
 * nothing on screen to say so.
 *
 * So this panel never constructs a config. It loads one, edits it through the
 * `with…` helpers in `@fp/domain`: each of which returns the whole tree with
 * one thing changed and everything else carried through untouched: and passes
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
 * shown but not edited. The tab type list is open: the backend types it as an
 * unconstrained string: and a portal configured by something newer than this
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

  if (!environmentId) {
    return (
      <PanelUnavailable reason="setup" description="Choose an environment to see these settings." />
    )
  }

  const phase = queryPhase(portal)
  if (phase === 'idle') return <PanelUnavailable reason="unavailable" />
  if (phase === 'loading' || !portal.data) return <PanelLoading rows={6} />

  return <PortalForm key={environmentId} environmentId={environmentId} config={portal.data} />
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
        // The tree as it was loaded and mutated: never a rebuilt object.
        update.mutate(value, { onSuccess: (saved) => draft.reset(saved) })
      })}
    >
      <Panel>
        <SettingsBlock
          label="Customer portal"
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
              <span className="flex items-center gap-1.5">
                {visible.length === 0 ? 'Nothing: the portal is empty' : visible.join(', ')}
                <DelayedHint text="Drag to reorder. The eye shows or hides a part of the portal; hiding a section hides all its tabs, and a tab is only reachable if its section is on." />
              </span>
            </Fact>
          </dl>
        </SettingsBlock>

        <SettingsBlock label="Sections and tabs">
          {sections.length === 0 ? (
            <EmptyState
              size="inline"
              title="This portal has no sections"
              description="Resetting to defaults asks the server for its standard layout, which is the only place a starting tree can honestly come from."
            />
          ) : (
            <SortableList
              ids={sections.map((section) => section.id)}
              disabled={busy}
              onReorder={(ids) => draft.update((current) => withSectionOrder(current, ids))}
              className="-mx-5 -my-4 divide-y"
            >
              {sections.map((section) => (
                <SortableItem
                  key={section.id}
                  id={section.id}
                  label={section.label || `section ${section.id}`}
                  disabled={busy}
                  className="px-5 py-3"
                >
                  {(grip) => (
                    <SectionRow
                      grip={grip}
                      section={section}
                      busy={busy}
                      onToggle={(enabled) =>
                        draft.update((current) => withSectionEnabled(current, section.id, enabled))
                      }
                      onReorderTabs={(ids) =>
                        draft.update((current) => withTabOrder(current, section.id, ids))
                      }
                      onToggleTab={(tabId, enabled) =>
                        draft.update((current) =>
                          withTabEnabled(current, section.id, tabId, enabled),
                        )
                      }
                      onToggleType={(type, enabled) =>
                        draft.update((current) =>
                          withTabTypeEnabled(current, section.id, type, enabled),
                        )
                      }
                      onMetricCards={(tabId, patch) =>
                        draft.update((current) =>
                          withMetricCards(current, section.id, tabId, patch),
                        )
                      }
                      onUsageGraph={(tabId, patch) =>
                        draft.update((current) => withUsageGraph(current, section.id, tabId, patch))
                      }
                    />
                  )}
                </SortableItem>
              ))}
            </SortableList>
          )}
        </SettingsBlock>

        {/* Only about the Usage tab: hidden with it, as V1 does. The setting is kept either way. */}
        {(draft.value.sections.find((section) => section.id === 'usage')?.enabled ?? true) ? (
          <UsagePropertiesBlock
            environmentId={environmentId}
            value={draft.value.usageProperties}
            busy={busy}
            onChange={(patch) => draft.update((current) => withUsageProperties(current, patch))}
          />
        ) : null}

        <SettingsBlock
          label="Theme"
          actions={
            <div className="flex w-full flex-wrap items-center justify-end gap-3">
              <ActionError message={saveError} />
              {!saveError && update.isSuccess ? <ActionNote message="Saved." /> : null}
              {!saveError && reset.isSuccess ? (
                <ActionNote message="Back to the defaults." />
              ) : null}
              <Button type="submit" variant="outline" disabled={busy}>
                {update.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          }
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <ColorField label="Primary" path="theme.primaryColor" draft={draft} busy={busy} />
            <ColorField label="Secondary" path="theme.secondaryColor" draft={draft} busy={busy} />
            <ColorField label="Tertiary" path="theme.tertiaryColor" draft={draft} busy={busy} />
          </div>
        </SettingsBlock>
      </Panel>
    </form>
  )
}

/**
 * `analytics_config.usage_properties`: whether customers may group their usage
 * by an event property, and which keys they see. The server applies both lists
 * when the portal asks for keys, so what is saved here is what customers get.
 */
function UsagePropertiesBlock({
  environmentId,
  value,
  busy,
  onChange,
}: {
  environmentId: string
  value: CustomerPortalConfig['usageProperties']
  busy: boolean
  onChange: (patch: Partial<NonNullable<CustomerPortalConfig['usageProperties']>>) => void
}) {
  const enabled = value?.enabled ?? false
  const suggestions = useUsagePropertyKeys(environmentId, enabled)
  const seen = suggestions.data ?? []
  const hint = (base: string) =>
    seen.length > 0 ? `${base} Seen in the last 7 days: ${seen.slice(0, 8).join(', ')}.` : base

  return (
    <SettingsBlock label="Usage properties">
      <div className="flex flex-col gap-4">
        <CheckboxRow
          checked={enabled}
          disabled={busy}
          onCheckedChange={(next) => onChange({ enabled: next })}
        >
          Customers can group their usage by event property
        </CheckboxRow>
        {enabled ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <KeysField
              label="Only these keys"
              hint={hint('Comma-separated. Empty shows every key.')}
              keys={value?.allowedKeys ?? []}
              busy={busy}
              onChange={(allowedKeys) => onChange({ allowedKeys })}
            />
            <KeysField
              label="Never these keys"
              hint="Comma-separated. Hidden even when listed in the keys above."
              keys={value?.hiddenKeys ?? []}
              busy={busy}
              onChange={(hiddenKeys) => onChange({ hiddenKeys })}
            />
          </div>
        ) : null}
      </div>
    </SettingsBlock>
  )
}

const parseKeys = (text: string): string[] => [
  ...new Set(
    text
      .split(/[\s,]+/)
      .map((key) => key.trim())
      .filter(Boolean),
  ),
]

/**
 * A list of property keys typed as one comma-separated line. The text is kept
 * as typed (a trailing comma is how the next key starts) and only follows the
 * keys when they change from elsewhere, such as a reset.
 */
function KeysField({
  label,
  hint,
  keys,
  busy,
  onChange,
}: {
  label: string
  hint: string
  keys: readonly string[]
  busy: boolean
  onChange: (keys: string[]) => void
}) {
  const [text, setText] = useState(() => keys.join(', '))
  const joined = keys.join(',')
  useEffect(() => {
    setText((current) => (parseKeys(current).join(',') === joined ? current : keys.join(', ')))
    // `joined` stands for `keys`: the array is a new object on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined])
  const invalid = parseKeys(text).filter((key) => !PORTAL_PROPERTY_KEY.test(key))

  return (
    <Field
      label={label}
      hint={hint}
      {...(invalid.length > 0
        ? { error: `${invalid.join(', ')}: letters, digits, _ and . only.` }
        : {})}
    >
      {({ id, ...field }) => (
        <Input
          id={id}
          disabled={busy}
          placeholder="region, model"
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            onChange(parseKeys(event.target.value))
          }}
          {...field}
        />
      )}
    </Field>
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
      hint="A hex code such as #0f172a, or blank."
      {...(draft.error(path) ? { error: draft.error(path) } : {})}
    >
      {({ id, ...field }) => (
        <div className="flex items-center gap-2">
          <ColorSwatch value={draft.text(path)} />
          <Input
            id={id}
            disabled={busy}
            placeholder="#0f172a"
            value={draft.text(path)}
            onChange={(event) => draft.setText(path, event.target.value)}
            {...field}
          />
        </div>
      )}
    </Field>
  )
}

/**
 * A preview of the colour typed beside it, so a hex code reads as the colour
 * it is. The colour is the merchant's own data, not a theme value, hence the
 * inline style; an empty or unreadable value shows an empty, dashed square.
 */
function ColorSwatch({ value }: { value: string }) {
  const colour = value.trim()
  const valid = colour !== '' && typeof CSS !== 'undefined' && CSS.supports('color', colour)
  return (
    <span
      aria-hidden
      className={`size-9 shrink-0 rounded-md border ${valid ? '' : 'border-dashed'}`}
      style={valid ? { backgroundColor: colour } : undefined}
    />
  )
}

function EyeToggle({
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
      size="icon"
      variant="ghost"
      aria-label={label}
      aria-pressed={on}
      disabled={busy}
      className={on ? undefined : 'text-muted-foreground'}
      onClick={() => onChange(!on)}
    >
      {on ? <EyeIcon aria-hidden /> : <EyeOffIcon aria-hidden />}
    </Button>
  )
}

function SectionRow({
  grip,
  section,
  busy,
  onToggle,
  onReorderTabs,
  onToggleTab,
  onToggleType,
  onMetricCards,
  onUsageGraph,
}: {
  grip: ReactNode
  section: PortalSection
  busy: boolean
  onToggle: (enabled: boolean) => void
  onReorderTabs: (ids: string[]) => void
  onToggleTab: (tabId: string, enabled: boolean) => void
  /** Hides a part the portal shows although the tree stores no tab for it. */
  onToggleType: (type: string, enabled: boolean) => void
  onMetricCards: (tabId: string, patch: Partial<NonNullable<PortalTab['metricCards']>>) => void
  onUsageGraph: (tabId: string, patch: Partial<NonNullable<PortalTab['usageGraph']>>) => void
}) {
  const tabs = orderedTabs(section)
  const name = section.label || `Section ${section.id}`
  // Parts the portal shows for this section with no tab stored: listed so they can be hidden too.
  const unstored = (PORTAL_SECTION_PARTS[section.id] ?? []).filter(
    (type) => !section.tabs.some((tab) => tab.type === type),
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {grip}
        <span
          className={cx('flex-1 text-sm font-medium', !section.enabled && 'text-muted-foreground')}
        >
          {name}
        </span>
        <EyeToggle
          label={`${name} visibility`}
          on={section.enabled}
          busy={busy}
          onChange={onToggle}
        />
      </div>

      {tabs.length === 0 ? (
        unstored.length > 0 ? null : (
          <p className="text-muted-foreground ml-9 text-xs">This section has no tabs.</p>
        )
      ) : (
        <SortableList
          ids={tabs.map((tab) => tab.id)}
          disabled={busy}
          onReorder={onReorderTabs}
          className={cx('ml-3 border-l pl-6', !section.enabled && SUBDUED)}
        >
          {tabs.map((tab) => {
            const label = portalTabLabel(tab.type)
            return (
              <SortableItem
                key={tab.id}
                id={tab.id}
                label={label}
                disabled={busy}
                className="py-1.5"
              >
                {(tabGrip) => (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      {tabGrip}
                      <span className={cx('flex-1 text-sm', !tab.enabled && SUBDUED)}>
                        {label}
                        {tab.type in PORTAL_TAB_TYPE_LABEL ? null : (
                          <span className="text-muted-foreground ml-2 font-mono text-xs">
                            {tab.type} (unknown type, kept)
                          </span>
                        )}
                      </span>
                      <EyeToggle
                        label={`${label} visibility`}
                        on={tab.enabled}
                        busy={busy}
                        onChange={(enabled) => onToggleTab(tab.id, enabled)}
                      />
                    </div>

                    {tab.metricCards ? (
                      <TabSetting label="Cards" off={!tab.enabled}>
                        <div
                          role="group"
                          aria-label="Metric cards"
                          className="flex flex-wrap gap-1.5"
                        >
                          <Chip
                            label="Cost"
                            on={tab.metricCards.showCostMetrics}
                            busy={busy}
                            onChange={(showCostMetrics) =>
                              onMetricCards(tab.id, { showCostMetrics })
                            }
                          />
                          <Chip
                            label="Custom"
                            on={tab.metricCards.showCustomMetrics}
                            busy={busy}
                            onChange={(showCustomMetrics) =>
                              onMetricCards(tab.id, { showCustomMetrics })
                            }
                          />
                          <Chip
                            label="Revenue"
                            on={tab.metricCards.showRevenueMetric}
                            busy={busy}
                            onChange={(showRevenueMetric) =>
                              onMetricCards(tab.id, { showRevenueMetric })
                            }
                          />
                        </div>
                      </TabSetting>
                    ) : null}

                    {tab.usageGraph ? (
                      <>
                        {tab.usageGraph.datePresets.length > 0 ? (
                          <TabSetting label="Opens on" off={!tab.enabled}>
                            <div className="w-56">
                              <OptionSelect
                                value={tab.usageGraph.defaultPreset ?? undefined}
                                onValueChange={(defaultPreset) =>
                                  onUsageGraph(tab.id, { defaultPreset })
                                }
                                options={tab.usageGraph.datePresets.map((preset) => ({
                                  value: preset,
                                  label: presetLabel(preset),
                                }))}
                                placeholder="Choose a preset"
                                disabled={busy}
                                aria-label="Opens on"
                              />
                            </div>
                          </TabSetting>
                        ) : null}
                        <TabSetting label="Date range" off={!tab.enabled}>
                          <CheckboxRow
                            checked={tab.usageGraph.allowCustomDateRange}
                            disabled={busy}
                            onCheckedChange={(allowCustomDateRange) =>
                              onUsageGraph(tab.id, { allowCustomDateRange })
                            }
                          >
                            Customers can pick their own dates
                          </CheckboxRow>
                        </TabSetting>
                      </>
                    ) : null}
                  </div>
                )}
              </SortableItem>
            )
          })}
        </SortableList>
      )}

      {unstored.length > 0 ? (
        <ul className={cx('ml-3 border-l pl-6', !section.enabled && SUBDUED)}>
          {unstored.map((type) => {
            const label = portalTabLabel(type)
            return (
              <li key={type} className="flex items-center gap-3 py-1.5 pl-9">
                <span className="flex-1 text-sm">
                  {label}
                  <span className="text-muted-foreground ml-2 text-xs">shown by default</span>
                </span>
                <EyeToggle
                  label={`${label} visibility`}
                  on
                  busy={busy}
                  onChange={(enabled) => onToggleType(type, enabled)}
                />
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

const presetLabel = (preset: string): string => {
  const words = preset.replaceAll('_', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * How a part of the portal that is switched off looks: the same treatment for
 * a hidden section's tabs, a hidden tab and a metric card that is off, so
 * "this will not be shown" reads the same at every level. The eye stays at
 * full strength so it is obvious how to turn the row back on.
 */
const SUBDUED = 'text-muted-foreground opacity-60 blur-[0.5px]'

/** A quiet label beside a tab's own setting, aligned with the tab's name. */
function TabSetting({
  label,
  off = false,
  children,
}: {
  label: string
  /** The tab is hidden, so its settings are subdued with it. */
  off?: boolean
  children: ReactNode
}) {
  return (
    <div className={cx('flex items-center gap-3 pl-9', off && SUBDUED)}>
      <span className="text-muted-foreground w-20 shrink-0 text-[13px]">{label}</span>
      {children}
    </div>
  )
}

/** A pill that is solid when the card is on and dashed when it is off. */
function Chip({
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
    <button
      type="button"
      aria-pressed={on}
      disabled={busy}
      onClick={() => onChange(!on)}
      className={cx(
        'focus-visible:ring-ring/50 rounded-full border px-3 py-1 text-sm outline-none focus-visible:ring-3 disabled:opacity-50',
        on ? 'bg-muted text-foreground' : cx('border-dashed', SUBDUED),
      )}
    >
      {label}
    </button>
  )
}

const cx = (...parts: (string | false | undefined)[]): string => parts.filter(Boolean).join(' ')
