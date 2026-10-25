import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within, screen } from 'storybook/test'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Field } from './Field'
import { FormActions } from './FormActions'
import { FormDialog } from './FormDialog'
import { OptionCombobox } from './OptionCombobox'
import { OptionSelect } from './OptionSelect'
import { DateInput } from './DateInput'

const PERIODS = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'ANNUAL', label: 'Annual' },
]
const CURRENCIES = [
  { value: 'usd', label: 'USD: US dollar' },
  { value: 'eur', label: 'EUR: Euro' },
  { value: 'inr', label: 'INR: Indian rupee' },
]

interface DemoProps {
  /** Names the trigger, the dialog ("New thing") and the submit label ("Create thing"). */
  noun?: string
  mode?: 'create' | 'edit'
  size?: 'sm' | 'md' | 'lg'
  isSubmitting?: boolean
  /** Shown above the actions; empty for none. */
  submitError?: string
}

function Demo({
  noun = 'thing',
  mode = 'create',
  size = 'md',
  isSubmitting = false,
  submitError = 'Could not save.',
}: DemoProps) {
  const [open, setOpen] = useState(false)
  const [period, setPeriod] = useState('')
  const [currency, setCurrency] = useState('')
  const [date, setDate] = useState('')
  return (
    <>
      <Button onClick={() => setOpen(true)}>{`New ${noun}`}</Button>
      <FormDialog open={open} onOpenChange={setOpen} title={`New ${noun}`} size={size}>
        <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
          <Field label="Name" required>
            {(p) => <Input {...p} />}
          </Field>
          <Field label="Billing period">
            {(p) => (
              <OptionSelect {...p} value={period} onValueChange={setPeriod} options={PERIODS} />
            )}
          </Field>
          <Field label="Currency">
            {(p) => (
              <OptionCombobox
                {...p}
                value={currency}
                onValueChange={setCurrency}
                options={CURRENCIES}
              />
            )}
          </Field>
          <Field label="Start date">
            {(p) => <DateInput {...p} value={date} onValueChange={setDate} />}
          </Field>
          <FormActions
            mode={mode}
            noun={noun}
            onCancel={() => setOpen(false)}
            isSubmitting={isSubmitting}
            submitError={submitError}
          />
        </form>
      </FormDialog>
    </>
  )
}

const meta = {
  title: 'Building blocks/Forms/FormKit',
  component: Demo,
  parameters: { layout: 'centered' },
  argTypes: {
    noun: { control: 'text' },
    mode: { control: 'inline-radio', options: ['create', 'edit'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    isSubmitting: { control: 'boolean' },
    submitError: { control: 'text' },
  },
} satisfies Meta<typeof Demo>

export default meta
type Story = StoryObj<typeof meta>

/** Press the trigger, then vary noun, mode, dialog size, submitting and the error: every field kit part is inside. */
export const Playground: Story = {
  args: { noun: 'thing', mode: 'create', size: 'md', isSubmitting: false, submitError: '' },
}

export const CreateDialog: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'New thing' }))
    const dialog = await screen.findByRole('dialog', { name: 'New thing' })
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Create thing' })).toBeVisible(),
    )
    await expect(within(dialog).getByRole('alert')).toHaveTextContent('Could not save.')
  },
}
