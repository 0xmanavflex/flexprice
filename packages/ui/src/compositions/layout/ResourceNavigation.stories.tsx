import { useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ResourceNavigation } from './ResourceNavigation'
import type { ResourceNavItem } from './ResourceNavigation'

/**
 * The section strip on a detail page. Controlled: the page owns which section is
 * current and what it renders. Here a small wrapper holds the value so the story
 * behaves like a real page.
 */
const PLAN_SECTIONS: ResourceNavItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'entitlements', label: 'Entitlements' },
  { id: 'credit-grants', label: 'Credit Grants' },
  { id: 'information', label: 'Information' },
]

const SECTION_POOL: ResourceNavItem[] = [
  ...PLAN_SECTIONS,
  { id: 'subscriptions', label: 'Contracts', count: 12 },
  { id: 'invoices', label: 'Invoices', count: 3 },
  { id: 'payments', label: 'Payments' },
  { id: 'activity', label: 'Activity', count: 40 },
]

function Harness({
  items = PLAN_SECTIONS,
  onChange,
  label = 'Plan sections',
}: {
  items?: ResourceNavItem[]
  onChange?: (id: string) => void
  label?: string
}) {
  const [value, setValue] = useState(items[0]?.id ?? '')
  return (
    <ResourceNavigation
      items={items}
      value={value}
      onChange={(id) => {
        setValue(id)
        onChange?.(id)
      }}
      label={label}
    />
  )
}

const meta = {
  title: 'Building blocks/Layout/ResourceNavigation',
  component: Harness,
  parameters: { layout: 'padded' },
  argTypes: {
    items: {
      control: 'object',
      description: 'Sections: id, label, optional count, icon, disabled.',
    },
    label: { control: 'text', description: 'Accessible name of the nav landmark.' },
    onChange: { control: false },
  },
} satisfies Meta<typeof Harness>

export default meta
type Story = StoryObj<typeof meta>

type PlaygroundArgs = ComponentProps<typeof Harness> & {
  sectionCount: number
  showCounts: boolean
  disableLast: boolean
}

/** Take 1 to 8 sections from the pool, drop the counts, or disable the last one; clicking still switches. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    items: SECTION_POOL,
    label: 'Plan sections',
    sectionCount: 4,
    showCounts: true,
    disableLast: false,
    onChange: fn(),
  },
  argTypes: {
    sectionCount: { control: { type: 'range', min: 1, max: 8, step: 1 } },
    showCounts: { control: 'boolean' },
    disableLast: { control: 'boolean' },
    items: { control: 'object', description: 'The pool; `sectionCount` takes the first N.' },
  },
  render: ({ sectionCount, showCounts, disableLast, items: pool = SECTION_POOL, ...args }) => {
    const items = pool
      .slice(0, sectionCount)
      .map(({ count, ...item }, i, all): ResourceNavItem => ({
        ...item,
        ...(showCounts && count !== undefined ? { count } : {}),
        ...(disableLast && i === all.length - 1 && all.length > 1 ? { disabled: true } : {}),
      }))
    return <Harness key={sectionCount} {...args} items={items} />
  },
}

export const Default: Story = {}

/** Overview is current on first render, marked with `aria-current`. */
export const MarksCurrent: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const overview = canvas.getByRole('button', { name: 'Overview' })
    await expect(overview).toHaveAttribute('aria-current', 'page')
    await expect(canvas.getByRole('button', { name: 'Entitlements' })).not.toHaveAttribute(
      'aria-current',
    )
  },
}

/** Clicking a section reports it and moves the current mark. */
export const SwitchesSection: Story = {
  args: { onChange: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Credit Grants' }))
    await expect(args.onChange).toHaveBeenCalledWith('credit-grants')
    await expect(canvas.getByRole('button', { name: 'Credit Grants' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  },
}

/** With counts beside the labels: open invoices, linked charges. */
export const WithCounts: Story = {
  args: {
    items: [
      { id: 'overview', label: 'Overview' },
      { id: 'subscriptions', label: 'Contracts', count: 12 },
      { id: 'invoices', label: 'Invoices', count: 3 },
      { id: 'payments', label: 'Payments' },
    ],
  },
}
