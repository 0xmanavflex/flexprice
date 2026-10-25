import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { ActivitySection, type ActivityLogEntry } from './ActivityLog'

const meta = {
  title: 'Building blocks/Detail pages/ActivityLog',
  component: ActivitySection,
  parameters: { layout: 'padded' },
  args: { entries: entries() },
} satisfies Meta<typeof ActivitySection>

export default meta

/** Below the meta: the anatomy registry takes the first `title:` in the file. */
function entries(): ActivityLogEntry[] {
  return [
    {
      id: 'act_3',
      title: 'Invoice voided',
      at: 'Oct 24, 2026, 3:42 PM',
      record: 'INV-202610-00035',
      fields: [
        { label: 'Total', value: '$35.00' },
        { label: 'Due', value: '$35.00' },
        { label: 'Status', value: 'Voided' },
      ],
      by: 'Ada Lovelace · Dashboard',
      href: '/invoices/inv_35',
    },
    {
      id: 'act_2',
      title: 'Contract created',
      at: 'Oct 24, 2026, 3:40 PM',
      fields: [{ label: 'Status', value: 'Active' }],
      href: '/contracts/sub_1',
    },
    {
      id: 'act_1',
      title: 'Customer created',
      at: 'Oct 24, 2026, 3:38 PM',
      record: 'Acme Corp',
      fields: [
        { label: 'Tax', value: 'Taxable' },
        { label: 'Timezone', value: 'UTC' },
      ],
    },
  ]
}
type Story = StoryObj<typeof meta>

/** Each value sits under its own label, so amounts never run together. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const voided = canvas.getByText('Invoice voided').closest('li')!
    const terms = within(voided)
      .getAllByRole('term')
      .map((term) => term.textContent)
    await expect(terms).toEqual(['Total', 'Due', 'Status'])
    await expect(within(voided).getByText('Voided')).toBeVisible()
  },
}

export const Empty: Story = {
  args: { entries: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No activity yet.')).toBeVisible()
  },
}

export const Awaiting: Story = { args: { awaiting: true } }
