import type { ComponentProps } from 'react'
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { type CreatePriceUnit, PRICE_UNIT_CURRENCIES } from '@fp/domain'
import { PriceUnitForm } from './PriceUnitForm'

/**
 * Create a price unit, on a full page. Fixtures in, a validated
 * `CreatePriceUnit` out. Create only: the backend fixes everything but the name
 * once a unit exists, and the name is edited in place on the detail page.
 * No provider, no network.
 */
const withHeight: Decorator = (Story) => (
  <div className="flex h-[720px] flex-col">
    <Story />
  </div>
)

const meta = {
  title: 'Surfaces/PriceUnitForm',
  component: PriceUnitForm,
  parameters: { layout: 'fullscreen' },
  decorators: [withHeight],
  args: {
    trail: [{ label: 'Price Units' }, { label: 'Create price unit' }],
    onSubmit: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof PriceUnitForm>

export default meta
type Story = StoryObj<typeof meta>

const credits: CreatePriceUnit = {
  name: 'Credits',
  code: 'CRD',
  symbol: '⛁',
  baseCurrency: 'USD',
  conversionRate: 0.01,
}

export const Create: Story = {}

export const Prefilled: Story = {
  args: { defaultValue: credits },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('textbox', { name: /^Name/ })).toHaveValue('Credits')
    await userEvent.click(canvas.getByRole('button', { name: 'Create price unit' }))
    await expect(args.onSubmit).toHaveBeenCalled()
  },
}

export const Submitting: Story = {
  // While submitting every field is disabled, so the scrollable page body has
  // nothing focusable left in it; the state is transient and the body is not a
  // control, so the keyboard-access rule does not apply here.
  parameters: {
    a11y: { config: { rules: [{ id: 'scrollable-region-focusable', enabled: false }] } },
  },
  args: { isSubmitting: true, defaultValue: credits },
}

export const SubmitError: Story = {
  args: {
    submitError: 'A price unit with that code already exists.',
    defaultValue: credits,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeInTheDocument()
  },
}

/** Validation is the domain schema's, reached through the form. */
export const ValidationFromDomain: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /create price unit/i }))
    await expect(await canvas.findByText('Enter a name')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

type PlaygroundArgs = Omit<ComponentProps<typeof PriceUnitForm>, 'defaultValue'> & {
  /** Off opens the blank create form; on seeds the fields below. */
  prefilled: boolean
  name: string
  code: string
  symbol: string
  baseCurrency: string
  conversionRate: number
}

/** Create only (the API has no update); prefill the draft and flip submitting or a server error. */
export const Playground: StoryObj<PlaygroundArgs> = {
  parameters: { controls: { exclude: /^(trail|on[A-Z].*)$/ } },
  args: {
    prefilled: true,
    name: credits.name,
    code: credits.code,
    symbol: credits.symbol,
    baseCurrency: credits.baseCurrency,
    conversionRate: credits.conversionRate,
    isSubmitting: false,
    submitError: '',
  },
  argTypes: {
    prefilled: { control: 'boolean' },
    name: { control: 'text' },
    code: { control: 'text' },
    symbol: { control: 'text' },
    baseCurrency: {
      control: 'select',
      options: PRICE_UNIT_CURRENCIES.map((currency) => currency.code),
    },
    conversionRate: { control: { type: 'number', min: 0.0001, max: 1000, step: 0.01 } },
    isSubmitting: { control: 'boolean' },
    submitError: { control: 'text', description: 'Empty means no server error.' },
  },
  render: ({
    prefilled,
    name,
    code,
    symbol,
    baseCurrency,
    conversionRate,
    submitError,
    ...rest
  }) => (
    <PriceUnitForm
      key={`${prefilled}|${name}|${code}|${symbol}|${baseCurrency}|${conversionRate}`}
      {...rest}
      {...(prefilled ? { defaultValue: { name, code, symbol, baseCurrency, conversionRate } } : {})}
      submitError={submitError || null}
    />
  ),
}
