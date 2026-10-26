import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Pill, type PillTone } from './cells'
import {
  CREDIT_NOTE_STATUS_TONE,
  INVOICE_STATUS_TONE,
  PAYMENT_STATUS_TONE,
  SUBSCRIPTION_STATUS_TONE,
} from './statusTones'

/** Every status in the shared registry, one row per enum: one status is one colour everywhere. */
function Palette() {
  const groups: [string, Record<string, PillTone>][] = [
    ['Invoice', INVOICE_STATUS_TONE],
    ['Payment', PAYMENT_STATUS_TONE],
    ['Contract', SUBSCRIPTION_STATUS_TONE],
    ['Credit note', CREDIT_NOTE_STATUS_TONE],
  ]
  return (
    <div className="flex flex-col gap-4">
      {groups.map(([name, tones]) => (
        <div key={name} className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground w-24 text-sm">{name}</span>
          {Object.entries(tones).map(([status, tone]) => (
            <Pill key={status} tone={tone}>
              {status.toLowerCase()}
            </Pill>
          ))}
        </div>
      ))}
    </div>
  )
}

const meta = {
  title: 'Building blocks/Charts & metrics/Status tones',
  component: Palette,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Palette>

export default meta
type Story = StoryObj<typeof meta>

/** Green done, yellow waiting, blue finalized, violet trialing only, grey ends. */
export const AllStatuses: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByText('trialing')).toHaveLength(1)
  },
}
