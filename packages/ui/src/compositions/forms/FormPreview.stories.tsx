import type { ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Badge } from '@ui/components/reui/badge'
import { FormPreview, PreviewAmount, PreviewRow, PreviewRows, PreviewSection } from './FormPreview'

/**
 * The live preview rail beside a form (the solution-billing-8 rail): heading
 * with a badge, a dashed headline figure, titled sections of label/value rows.
 * Props in, markup out; each form feeds it from its own draft.
 */
const meta = {
  title: 'Foundation/Compositions/Form preview',
  component: FormPreview,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    title: { control: 'text' },
    label: { control: 'text', description: 'Accessible name; defaults to the title.' },
    badge: { control: false },
    children: { control: false },
    className: { control: false },
  },
} satisfies Meta<typeof FormPreview>

export default meta
type Story = StoryObj<typeof meta>

type PlaygroundArgs = Pick<ComponentProps<typeof FormPreview>, 'title' | 'label'> & {
  badgeLabel: string
  amount: string
  amountHint: string
  rowCount: number
  boldTotal: boolean
}

/** Retitle the rail, change the headline figure and badge, and drag `rowCount` 0 to 16 to see a short and a long summary. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    title: 'Contract summary',
    badgeLabel: 'Draft',
    amount: '$29.00',
    amountHint: 'Billed in advance',
    rowCount: 3,
    boldTotal: true,
  },
  argTypes: {
    label: { control: 'text' },
    badgeLabel: { control: 'text', description: 'Empty hides the badge.' },
    amount: { control: 'text' },
    amountHint: { control: 'text' },
    rowCount: { control: { type: 'range', min: 0, max: 16, step: 1 } },
    boldTotal: { control: 'boolean', description: 'Emphasise the last row as a total.' },
  },
  render: ({ badgeLabel, amount, amountHint, rowCount, boldTotal, ...args }) => (
    <FormPreview {...args} badge={badgeLabel ? <Badge>{badgeLabel}</Badge> : undefined}>
      <PreviewAmount label="Per month" value={amount} hint={amountHint} />
      {rowCount > 0 ? (
        <PreviewSection title="Billing">
          <PreviewRows>
            {Array.from({ length: rowCount }, (_, index) => {
              const isLast = index === rowCount - 1
              return (
                <PreviewRow
                  key={index}
                  label={isLast && boldTotal ? 'Total' : `Line ${index + 1}`}
                  value={isLast && boldTotal ? amount : `$${(index + 1) * 5}.00`}
                  strong={isLast && boldTotal}
                />
              )
            })}
          </PreviewRows>
        </PreviewSection>
      ) : null}
    </FormPreview>
  ),
}

export const Rail: Story = {
  args: {
    title: 'Contract summary',
    badge: <Badge>Draft</Badge>,
    children: (
      <>
        <PreviewAmount label="Per month" value="$29.00" hint="Billed in advance" />
        <PreviewSection title="Billing">
          <PreviewRows>
            <PreviewRow label="Cycle" value="Monthly" />
            <PreviewRow label="Starts" value="Now" />
            <PreviewRow label="Total" value="$29.00" strong />
          </PreviewRows>
        </PreviewSection>
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('complementary', { name: 'Contract summary' })).toBeVisible()
    await expect(canvas.getByText('Monthly')).toBeVisible()
  },
}
