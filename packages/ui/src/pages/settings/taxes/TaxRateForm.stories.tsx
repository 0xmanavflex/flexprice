import { TaxRateStatus, emptyTaxRate } from '@fp/domain'
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { TaxRateCreateForm, TaxRateEditForm } from './TaxRateForm'

/**
 * Tax rate create and edit, each a full page. Create takes the value;
 * edit is limited to what the API lets change and is prepopulated.
 */
const withHeight: Decorator = (Story) => (
  <div className="flex h-[720px] flex-col">
    <Story />
  </div>
)

const meta = {
  title: 'App/Settings/Taxes/Tax rate form',
  component: TaxRateCreateForm,
  parameters: { layout: 'fullscreen' },
  decorators: [withHeight],
  args: {
    trail: [{ label: 'Tax rates' }, { label: 'Create tax rate' }],
    defaultValue: emptyTaxRate(),
    onSubmit: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof TaxRateCreateForm>

export default meta
type Story = StoryObj<typeof meta>

export const Create: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /create tax rate/i }))
    await expect(await canvas.findByText('Enter a name')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()

    await userEvent.type(canvas.getByRole('textbox', { name: /^name/i }), 'VAT standard')
    const code = canvas.getByRole('textbox', { name: /^code/i })
    await userEvent.clear(code)
    await userEvent.type(code, 'VAT20')
    await userEvent.type(canvas.getByRole('textbox', { name: /rate/i }), '20')
    await userEvent.click(canvas.getByRole('button', { name: /create tax rate/i }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'VAT standard', code: 'VAT20', percentageValue: '20' }),
    )
  },
}

export const Edit: Story = {
  render: (args) => (
    <TaxRateEditForm
      trail={[{ label: 'Tax rates' }, { label: 'Tax rate details' }, { label: 'Edit' }]}
      defaultValue={{ name: 'VAT standard', code: 'VAT20', description: '', status: 'published' }}
      onSubmit={fn()}
      {...(args.onCancel ? { onCancel: args.onCancel } : {})}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Edit tax rate' })).toBeInTheDocument()
    await expect(canvas.getByRole('textbox', { name: /^name/i })).toHaveValue('VAT standard')
    await expect(canvas.queryByRole('textbox', { name: /rate \(%\)/i })).not.toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
  },
}

export const Submitting: Story = { args: { isSubmitting: true } }

export const SubmitError: Story = {
  args: { submitError: 'A tax rate with that code already exists.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeInTheDocument()
  },
}

interface PlaygroundArgs {
  mode: 'create' | 'edit'
  name: string
  code: string
  description: string
  /** Create only: the value is fixed once the rate exists. */
  percentageValue: string
  /** Edit only: archive or restore. */
  status: TaxRateStatus
  isSubmitting: boolean
  submitError: string
  onSubmit: (value: unknown) => void
  onCancel: () => void
}

/** Switch between create (value) and edit (rename, recode, archive); flip submitting or a server error. */
/** The code is filled from the name until the person types their own. */
export const CodeFollowsName: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const field = canvas.getByRole('textbox', { name: /^code/i })

    await userEvent.type(canvas.getByRole('textbox', { name: /^name/i }), 'Acme Pro')
    await expect(field).toHaveValue('taxacmepro')

    await userEvent.clear(field)
    await userEvent.type(field, 'mine')
    await userEvent.type(canvas.getByRole('textbox', { name: /^name/i }), ' Plus')
    await expect(field).toHaveValue('mine')
  },
}

export const Playground: StoryObj<PlaygroundArgs> = {
  parameters: { controls: { exclude: /^on[A-Z].*$/ } },
  args: {
    mode: 'create',
    name: 'VAT standard',
    code: 'VAT20',
    description: '',
    percentageValue: '20',
    status: TaxRateStatus.Published,
    isSubmitting: false,
    submitError: '',
    onSubmit: fn(),
    onCancel: fn(),
  },
  argTypes: {
    mode: { control: 'inline-radio', options: ['create', 'edit'] },
    name: { control: 'text' },
    code: { control: 'text' },
    description: { control: 'text' },
    percentageValue: { control: 'text' },
    status: { control: 'inline-radio', options: Object.values(TaxRateStatus) },
    isSubmitting: { control: 'boolean' },
    submitError: { control: 'text', description: 'Empty means no server error.' },
  },
  render: ({
    mode,
    name,
    code,
    description,
    percentageValue,
    status,
    submitError,
    ...rest
  }) =>
    mode === 'edit' ? (
      <TaxRateEditForm
        key={`edit|${name}|${code}|${description}|${status}`}
        {...rest}
        trail={[{ label: 'Tax rates' }, { label: 'Tax rate details' }, { label: 'Edit' }]}
        defaultValue={{ name, code, description, status }}
        submitError={submitError || null}
      />
    ) : (
      <TaxRateCreateForm
        key={`create|${name}|${code}|${description}|${percentageValue}`}
        {...rest}
        trail={[{ label: 'Tax rates' }, { label: 'Create tax rate' }]}
        defaultValue={{ name, code, description, percentageValue }}
        submitError={submitError || null}
      />
    ),
}
