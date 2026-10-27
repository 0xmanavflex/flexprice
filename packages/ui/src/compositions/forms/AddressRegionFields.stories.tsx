import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import { Field } from './Field'
import { AddressPicker, type AddressRegionValue, useAddressRegions } from './AddressRegionFields'

interface DemoProps {
  initial: AddressRegionValue
  onChange: (next: AddressRegionValue) => void
}

/** The three pickers in plain `Field` rows; each form puts them in its own rows. */
function AddressRegionDemo({ initial, onChange }: DemoProps) {
  const [value, setValue] = useState(initial)
  const regions = useAddressRegions({
    value,
    onChange: (next) => {
      setValue(next)
      onChange(next)
    },
  })
  return (
    <div className="flex w-80 flex-col gap-4">
      <Field label="Country">
        {(field) => <AddressPicker picker={regions.country} {...field} />}
      </Field>
      <Field label="State">{(field) => <AddressPicker picker={regions.state} {...field} />}</Field>
      <Field label="City">{(field) => <AddressPicker picker={regions.city} {...field} />}</Field>
    </div>
  )
}

const meta = {
  title: 'Building blocks/Forms/AddressRegionFields',
  component: AddressRegionDemo,
  parameters: {
    layout: 'centered',
    a11y: {
      config: {
        rules: [
          { id: 'aria-input-field-name', enabled: false },
          { id: 'scrollable-region-focusable', enabled: false },
        ],
      },
    },
  },
  args: {
    initial: { country: '', state: '', city: '' },
    onChange: fn(),
  },
} satisfies Meta<typeof AddressRegionDemo>

export default meta

type Story = StoryObj<typeof meta>

/** Nothing chosen: state waits for a country; city, needed even without a state, is typed until a state is chosen. */
export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('combobox', { name: 'State' })).toHaveAttribute('data-disabled')
    await expect(canvas.getByRole('textbox', { name: 'City' })).toBeEnabled()
  },
}

/** Country, then a state of that country, then a city of that state. */
export const Dependent: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole('combobox', { name: 'Country' }), 'United States')
    await userEvent.click(await screen.findByRole('option', { name: 'United States (US)' }))
    const state = canvas.getByRole('combobox', { name: 'State' })
    await waitFor(() => expect(state).toHaveAttribute('placeholder', 'Search states…'), {
      timeout: 5000,
    })
    await userEvent.type(state, 'Califor')
    await userEvent.click(
      await screen.findByRole('option', { name: 'California' }, { timeout: 5000 }),
    )
    const city = canvas.getByRole('combobox', { name: 'City' })
    await waitFor(() => expect(city).toHaveAttribute('placeholder', 'Search cities…'), {
      timeout: 5000,
    })
    await userEvent.type(city, 'San Fran')
    await userEvent.click(
      await screen.findByRole('option', { name: 'San Francisco' }, { timeout: 5000 }),
    )
    await expect(args.onChange).toHaveBeenLastCalledWith({
      country: 'US',
      state: 'California',
      city: 'San Francisco',
    })
  },
}

/** A country the dataset lists no states for: state and city are typed instead. */
export const TypedWhereNoList: Story = {
  args: { initial: { country: 'JE', state: '', city: '' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvas.getByRole('textbox', { name: 'State' })).toBeEnabled(), {
      timeout: 5000,
    })
    await userEvent.type(canvas.getByRole('textbox', { name: 'State' }), 'St Helier')
    await expect(canvas.getByRole('textbox', { name: 'City' })).toBeEnabled()
  },
}

/** A place the dataset does not list is entered by typing it and choosing "Use …". */
export const UnlistedPlace: Story = {
  args: { initial: { country: 'US', state: 'California', city: '' } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const city = canvas.getByRole('combobox', { name: 'City' })
    await waitFor(() => expect(city).toHaveAttribute('placeholder', 'Search cities…'), {
      timeout: 5000,
    })
    await userEvent.type(city, 'Smallville')
    await userEvent.click(await screen.findByRole('option', { name: 'Use "Smallville"' }))
    await expect(args.onChange).toHaveBeenLastCalledWith({
      country: 'US',
      state: 'California',
      city: 'Smallville',
    })
    await expect(city).toHaveValue('Smallville')

    // The same for a state, and the city it held is cleared.
    const state = canvas.getByRole('combobox', { name: 'State' })
    await userEvent.clear(state)
    await userEvent.type(state, 'Jefferson')
    await userEvent.click(await screen.findByRole('option', { name: 'Use "Jefferson"' }))
    await expect(args.onChange).toHaveBeenLastCalledWith({
      country: 'US',
      state: 'Jefferson',
      city: '',
    })
  },
}

/** State is optional, so a city can be typed with no state chosen. */
export const CityWithoutState: Story = {
  args: { initial: { country: 'GB', state: '', city: '' } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const city = canvas.getByRole('textbox', { name: 'City' })
    await expect(city).toBeEnabled()
    await userEvent.type(city, 'London')
    await expect(args.onChange).toHaveBeenLastCalledWith({
      country: 'GB',
      state: '',
      city: 'London',
    })
  },
}

/** An older address with only a city stays editable: the city is a typed field. */
export const SavedCityOnly: Story = {
  args: { initial: { country: '', state: '', city: 'London' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const city = canvas.getByRole('textbox', { name: 'City' })
    await expect(city).toHaveValue('London')
    await expect(city).toBeEnabled()
  },
}
