import { useState } from 'react'
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

function Harness({
  items = PLAN_SECTIONS,
  onChange,
}: {
  items?: ResourceNavItem[]
  onChange?: (id: string) => void
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
      label="Plan sections"
    />
  )
}

const meta = {
  title: 'Foundation/Compositions/ResourceNavigation',
  component: Harness,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Harness>

export default meta
type Story = StoryObj<typeof meta>

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

/** With counts beside the labels — open invoices, linked charges. */
export const WithCounts: Story = {
  args: {
    items: [
      { id: 'overview', label: 'Overview' },
      { id: 'subscriptions', label: 'Subscriptions', count: 12 },
      { id: 'invoices', label: 'Invoices', count: 3 },
      { id: 'payments', label: 'Payments' },
    ],
  },
}
