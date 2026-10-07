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
  { value: 'usd', label: 'USD — US dollar' },
  { value: 'eur', label: 'EUR — Euro' },
  { value: 'inr', label: 'INR — Indian rupee' },
]

function Demo() {
  const [open, setOpen] = useState(false)
  const [period, setPeriod] = useState('')
  const [currency, setCurrency] = useState('')
  const [date, setDate] = useState('')
  return (
    <>
      <Button onClick={() => setOpen(true)}>New thing</Button>
      <FormDialog open={open} onOpenChange={setOpen} title="New thing">
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
            mode="create"
            noun="thing"
            onCancel={() => setOpen(false)}
            submitError="Could not save."
          />
        </form>
      </FormDialog>
    </>
  )
}

const meta = {
  title: 'Foundation/Compositions/Form kit',
  component: Demo,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Demo>

export default meta
type Story = StoryObj<typeof meta>

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
