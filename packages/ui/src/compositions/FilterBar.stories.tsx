import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { createFilterQuery, createFilterRule } from '@ui/components/reui/filters/filters-query'
import type { FilterField } from '@ui/components/reui/filters/filters-types'
import { FilterBar, emptyFilterQuery } from './FilterBar'

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
  title: 'Foundation/Compositions/FilterBar',
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
} satisfies Meta<typeof FilterBar>

export default meta
type Story = StoryObj<typeof meta>

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

/** Seeded from a query, the way a filtered URL restores its state — the inline
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
