import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { money } from '@fp/domain'
import { Money } from './Money'

const currencies = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CHF', 'BRL', 'AED']
const locales = ['en-US', 'en-GB', 'de-DE', 'fr-FR', 'en-IN', 'ja-JP', 'pt-BR']

const meta = {
  title: 'Building blocks/Charts & metrics/Money',
  component: Money,
  parameters: { layout: 'centered' },
  args: { value: money('1234.56', 'USD'), locale: 'en-US' },
  argTypes: {
    value: { control: false },
    locale: { control: 'select', options: locales },
    muteZero: { control: 'boolean' },
    signed: { control: 'boolean' },
    truncate: { control: 'boolean' },
    className: { control: false },
  },
} satisfies Meta<typeof Money>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

interface PlaygroundArgs {
  amount: string
  currency: string
  locale: string
  muteZero: boolean
  signed: boolean
  truncate: boolean
  width: number
}

/** Type any decimal string (invalid input falls back to 0), pick a currency and locale, and squeeze the column to see truncation. */
export const Playground = {
  args: {
    amount: '-1234.56',
    currency: 'USD',
    locale: 'en-US',
    muteZero: true,
    signed: true,
    truncate: false,
    width: 240,
  },
  argTypes: {
    amount: { control: 'text', description: 'Exact decimal string, e.g. -250.00.' },
    currency: { control: 'select', options: currencies },
    locale: { control: 'select', options: locales },
    muteZero: { control: 'boolean' },
    signed: { control: 'boolean' },
    truncate: { control: 'boolean' },
    width: { control: { type: 'range', min: 60, max: 400, step: 10 } },
  },
  parameters: {
    controls: {
      include: ['amount', 'currency', 'locale', 'muteZero', 'signed', 'truncate', 'width'],
    },
  },
  render: ({ amount, currency, locale, muteZero, signed, truncate, width }) => {
    const valid = /^-?\d+(\.\d+)?$/.test(amount)
    return (
      <div className="border p-2" style={{ width }}>
        <Money
          value={money(valid ? amount : '0', currency)}
          locale={locale}
          muteZero={muteZero}
          signed={signed}
          truncate={truncate}
        />
      </div>
    )
  },
} satisfies StoryObj<PlaygroundArgs>

/** The reason this component refuses numbers. */
export const ExactDecimal: Story = {
  args: { value: money('12345678901234567.89', 'USD') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('$12,345,678,901,234,567.89')).toBeInTheDocument()
    // What a float would have rendered instead.
    await expect(canvas.queryByText('$12,345,678,901,234,568.00')).not.toBeInTheDocument()
  },
}

export const Currencies: Story = {
  render: () => (
    <div className="flex flex-col gap-1">
      <Money value={money('1234.56', 'USD')} locale="en-US" />
      <Money value={money('1234.56', 'EUR')} locale="de-DE" />
      <Money value={money('1234.56', 'INR')} locale="en-IN" />
      <Money value={money('1234', 'JPY')} locale="ja-JP" />
    </div>
  ),
}

export const Zero: Story = { args: { value: money('0', 'USD'), muteZero: true } }

/** Sign carries meaning for credits and refunds. */
export const Negative: Story = { args: { value: money('-250.00', 'USD'), signed: true } }

/**
 * Truncation, for table cells.
 *
 * A large contract or a currency with no minor unit produces an amount long
 * enough to break a column. Left alone it pushes into the next cell and makes
 * two unreadable instead of one.
 */
export const TruncatedInANarrowColumn: Story = {
  args: { value: money('185128200000000000.00', 'EUR'), truncate: true },
  render: (args) => (
    <div className="w-40 border p-2">
      <Money {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Clipped visually, but the full amount is still reachable.
    const el = canvas.getByTitle(/185,128,200,000,000,000/)
    await expect(el).toBeInTheDocument()
    await expect(el.scrollWidth).toBeGreaterThan(el.clientWidth)
  },
}

/** A currency code Intl does not know falls back to the plain number and the code. It never throws. */
export const InvalidCurrencyFallsBack: Story = {
  args: { value: money('12.50', 'ZZZZZZ') },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('12.50 ZZZZZZ')).toBeInTheDocument()
  },
}
