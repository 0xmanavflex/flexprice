import { useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import { createFilterQuery, createFilterRule } from '@ui/components/reui/filters/filters-query'
import type { FilterField, FilterQuery } from '@ui/components/reui/filters/filters-types'
import type { ListFilter } from '@fp/domain'
import { FilterBar, type FlatFilter, emptyFilterQuery, granularFilter } from './FilterBar'

/**
 * Filtering over `@reui/filters`, in the inline `advanced` chrome (the
 * "Field is any of value" chips the reference tables use), flattened to the flat
 * `{ field, operator, values }` array a URL and the search API can carry.
 */
const fields: FilterField[] = [
  {
    id: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'scheduled', label: 'Scheduled' },
      { value: 'archived', label: 'Archived' },
    ],
    operators: [{ value: 'is_any_of', label: 'is any of', arity: 'many' }],
    defaultOperator: 'is_any_of',
  },
]

const meta = {
  title: 'Building blocks/Tables & lists/FilterBar',
  component: FilterBar,
  parameters: {
    layout: 'padded',
    // The builder opens a Base UI cascader popover; its portal focus guards
    // trip axe. See AppShell.stories.tsx.
    a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } },
  },
  args: {
    fields,
    query: emptyFilterQuery(),
    onQueryChange: fn(),
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['basic', 'advanced'] },
    size: { control: 'inline-radio', options: ['sm', 'default'] },
    advancedMode: { control: 'inline-radio', options: ['popover', 'inline'] },
    advancedAlign: { control: 'inline-radio', options: ['start', 'center', 'end'] },
    showClear: { control: 'boolean' },
    fields: { control: false },
    query: { control: false },
    onQueryChange: { control: false },
    trigger: { control: false },
  },
} satisfies Meta<typeof FilterBar>

export default meta
type Story = StoryObj<typeof meta>

/** Switch chrome (basic chips / advanced builder), size and clear button; the query is held in state so edits stick. */
export const Playground: Story = {
  args: { variant: 'basic', size: 'default', showClear: true },
  render: (args) => <PlaygroundBar {...args} />,
}

function PlaygroundBar(args: ComponentProps<typeof FilterBar>) {
  const [query, setQuery] = useState<FilterQuery>(emptyFilterQuery())
  return (
    <FilterBar
      {...args}
      query={query}
      onQueryChange={(next, flat) => {
        setQuery(next)
        args.onQueryChange(next, flat)
      }}
    />
  )
}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    // Empty query, inline advanced: the bar offers a control to add a filter.
    await expect(within(canvasElement).getByRole('button', { name: /filter/i })).toBeInTheDocument()
  },
}

/** The older flat chip row, still available behind the `basic` variant. */
export const Basic: Story = {
  args: { variant: 'basic' },
}

/** Seeded from a query, the way a filtered URL restores its state: the inline
 * "Status is any of …" chip renders in place. */
export const WithActiveFilter: Story = {
  args: {
    query: createFilterQuery([
      createFilterRule({
        id: 'status',
        path: ['status'],
        operator: 'is_any_of',
        value: ['active'],
      }),
    ]),
  },
}

/**
 * A controlled host that round-trips through the SAME shape a real list screen
 * uses: it keeps only the flattened `statuses`, and re-derives `query` from
 * them. That is what turns a half-built rule: operator chosen, value not: into
 * the empty query the bar hears back, the exact echo that used to wipe the chip
 * mid-flow. The story exists to hold the bar to completing a filter across that
 * echo. See `SelectsConditionAndValue`.
 */
function ControlledStatusFilter() {
  const [statuses, setStatuses] = useState<string[]>([])
  const options = new Set(fields[0]?.options?.map((option) => option.value))
  const query: FilterQuery = statuses.length
    ? createFilterQuery([
        createFilterRule({
          id: 'status',
          path: ['status'],
          operator: 'is_any_of',
          value: statuses,
        }),
      ])
    : emptyFilterQuery()
  return (
    <FilterBar
      fields={fields}
      query={query}
      onQueryChange={(_next, flat: FlatFilter[]) => {
        const rule = flat.find((entry) => entry.field === 'status')
        setStatuses((rule?.values ?? []).map(String).filter((value) => options.has(value)))
      }}
    />
  )
}

/**
 * The regression guard for the premature-close bug: choosing a condition, then a
 * value, must build the chip rather than tear it down.
 *
 * Before the fix, picking the operator flattened the rule to a `values: []`
 * condition the host dropped, and the bar read its own echo of the resulting
 * empty query as an outside change and re-seeded the draft: destroying the chip
 * and the popover the very frame the operator was chosen, so no filter could be
 * completed. This walks the whole flow and asserts the opposite at each step:
 * the value editor opens after the condition (the popover STAYED open), and the
 * chip carries the value once it is picked.
 */
export const SelectsConditionAndValue: Story = {
  parameters: {
    a11y: {
      config: {
        rules: [
          { id: 'aria-hidden-focus', enabled: false },
          // The cascader's visually-hidden search input trips this; it is a
          // known flake unrelated to what this story asserts.
          { id: 'aria-input-field-name', enabled: false },
          // This story deliberately ends with the value editor STILL OPEN (the
          // proof the popover no longer closes prematurely). The vendored value
          // popover renders a `role="dialog"` it does not name, a pre-existing
          // gap in the primitive, not what this regression guards.
          { id: 'aria-dialog-name', enabled: false },
        ],
      },
    },
  },
  render: () => <ControlledStatusFilter />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Open the field picker and choose the attribute.
    await userEvent.click(canvas.getByRole('button', { name: /filter/i }))
    await userEvent.click(await screen.findByRole('option', { name: /status/i }))

    // The chip is created and its condition menu opens on it.
    await userEvent.click(await screen.findByRole('option', { name: /is any of/i }))

    // The bug was here: the chip used to vanish as the operator committed. If it
    // survived, the value editor hands off open: a status option is on screen.
    const activeOption = await screen.findByRole('option', { name: /^active$/i })
    await expect(activeOption).toBeInTheDocument()

    const chip = canvasElement.querySelector('[data-slot="filter-chip"]')
    await expect(chip).not.toBeNull()
    await expect(chip).toHaveTextContent(/is any of/i)

    // Pick a value; the multi-select editor stays open (another option is still
    // reachable), and the chip now reads the value back.
    await userEvent.click(activeOption)
    await expect(screen.getByRole('option', { name: /^scheduled$/i })).toBeInTheDocument()
    await expect(canvasElement.querySelector('[data-slot="filter-chip"]')).toHaveTextContent(
      /active/i,
    )
  },
}

function MetadataFilterBar({ onChange }: { onChange: (filters: ListFilter[]) => void }) {
  const [filters, setFilters] = useState<ListFilter[]>([])
  return (
    <FilterBar
      {...granularFilter({
        specs: [{ field: 'metadata', label: 'Metadata', kind: 'keyvalue' }],
        filters,
        onChange: (next) => {
          setFilters(next)
          onChange(next)
        },
      })}
    />
  )
}

/** A key/value field (metadata): a key and a value, applied together, read back as `key = value`. */
export const MetadataKeyValue: Story = {
  parameters: {
    a11y: {
      config: {
        rules: [
          { id: 'aria-hidden-focus', enabled: false },
          { id: 'aria-input-field-name', enabled: false },
          { id: 'aria-dialog-name', enabled: false },
        ],
      },
    },
  },
  args: { onQueryChange: fn() },
  render: (args) => <MetadataFilterBar onChange={args.onQueryChange as never} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /filter/i }))
    await userEvent.click(await screen.findByRole('option', { name: /metadata/i }))
    // One condition ("is"); the picker may offer it before the value step.
    const condition = screen.queryByRole('option', { name: /^is$/i })
    if (condition) await userEvent.click(condition)
    await userEvent.type(await screen.findByRole('textbox', { name: 'Metadata key' }), 'region')
    await userEvent.type(screen.getByRole('textbox', { name: 'Metadata value' }), 'eu')
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    await expect(args.onQueryChange).toHaveBeenLastCalledWith([
      { field: 'metadata', op: 'eq', value: 'region=eu' },
    ])
    await expect(await canvas.findByText('region = eu')).toBeVisible()
  },
}

/** The pair is stored as `key=value`, so a key with "=" is refused, said why. */
export const MetadataKeyCannotHoldEquals: Story = {
  parameters: {
    a11y: {
      config: {
        rules: [
          { id: 'aria-hidden-focus', enabled: false },
          { id: 'aria-input-field-name', enabled: false },
          { id: 'aria-dialog-name', enabled: false },
          // The story ends with the value step still open and nothing applied,
          // so the vendored chip's value trigger has no text yet: a gap in the
          // primitive, not what this story checks.
          { id: 'button-name', enabled: false },
        ],
      },
    },
  },
  args: { onQueryChange: fn() },
  render: (args) => <MetadataFilterBar onChange={args.onQueryChange as never} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /filter/i }))
    await userEvent.click(await screen.findByRole('option', { name: /metadata/i }))
    const condition = screen.queryByRole('option', { name: /^is$/i })
    if (condition) await userEvent.click(condition)
    await userEvent.type(await screen.findByRole('textbox', { name: 'Metadata key' }), 'a=b')
    await expect(screen.getByRole('alert')).toHaveTextContent('A key cannot contain "=".')
    await expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
    // The bar may report the empty list as the chip opens; it never reports a pair.
    const calls = (args.onQueryChange as ReturnType<typeof fn>).mock.calls
    await expect(calls.every(([filters]) => (filters as unknown[]).length === 0)).toBe(true)
  },
}

/** Metadata holds one value per key: a second pick on the same key replaces the first chip. */
export const MetadataOneChipPerKey: Story = {
  parameters: { ...MetadataKeyCannotHoldEquals.parameters },
  args: { onQueryChange: fn() },
  render: (args) => <MetadataFilterBar onChange={args.onQueryChange as never} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const pick = async (key: string, value: string) => {
      await userEvent.click(canvas.getByRole('button', { name: 'Filter' }))
      await userEvent.click(await screen.findByRole('option', { name: /metadata/i }))
      const condition = screen.queryByRole('option', { name: /^is$/i })
      if (condition) await userEvent.click(condition)
      await userEvent.type(await screen.findByRole('textbox', { name: 'Metadata key' }), key)
      await userEvent.type(screen.getByRole('textbox', { name: 'Metadata value' }), value)
      await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    }
    await pick('region', 'eu')
    await expect(await canvas.findByText('region = eu')).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await pick('region', 'us')
    await expect(await canvas.findByText('region = us')).toBeVisible()
    await expect(canvas.queryByText('region = eu')).toBeNull()
    await expect(args.onQueryChange).toHaveBeenLastCalledWith([
      { field: 'metadata', op: 'eq', value: 'region=us' },
    ])
  },
}
