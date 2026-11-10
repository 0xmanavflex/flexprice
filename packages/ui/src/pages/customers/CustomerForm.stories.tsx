import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { KEY_PREFIX, suggestKey } from '@fp/domain'
import { CustomerForm } from './CustomerForm'

/** Customer create and edit: one page, no preview rail. */
const withHeight: Decorator = (Story) => (
  <div className="flex h-[720px] flex-col">
    <Story />
  </div>
)

const meta = {
  title: 'App/Customers/Customer form',
  component: CustomerForm,
  parameters: { layout: 'fullscreen' },
  decorators: [withHeight],
  args: {
    mode: 'create',
    trail: [{ label: 'Customers' }, { label: 'Create customer' }],
    onSubmit: fn(),
    onCancel: fn(),
  },
  argTypes: {
    mode: { control: 'inline-radio', options: ['create', 'edit'] },
    customerName: { control: 'text', description: 'Edit page title; edit mode only.' },
    isSubmitting: { control: 'boolean' },
    submitError: { control: 'text', description: 'Server-side failure; empty means none.' },
    defaultValue: { control: false },
    trail: { control: false },
    onSubmit: { control: false },
    onCancel: { control: false },
  },
} satisfies Meta<typeof CustomerForm>

export default meta
type Story = StoryObj<typeof meta>

/** Flip create/edit, submitting and a server error from the controls. */
export const Playground: Story = {
  args: { isSubmitting: false, submitError: '', customerName: 'Acme Corp' },
  render: ({ mode, customerName, submitError, ...args }) =>
    mode === 'edit' ? (
      <CustomerForm
        key="edit"
        {...args}
        mode="edit"
        customerName={customerName ?? 'Acme Corp'}
        trail={[{ label: 'Customers' }, { label: 'Customer details' }, { label: 'Edit' }]}
        submitError={submitError || null}
        defaultValue={{ externalId: 'acme', name: 'Acme Corp', email: 'billing@acme.test' }}
      />
    ) : (
      <CustomerForm
        key="create"
        {...args}
        mode="create"
        trail={[{ label: 'Customers' }, { label: 'Create customer' }]}
        submitError={submitError || null}
      />
    ),
}

export const Create: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Create customer' }))
    await expect(await canvas.findByText('Enter a name')).toBeInTheDocument()
    await expect(canvas.getByText('Enter an external ID')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()

    await userEvent.type(canvas.getByRole('textbox', { name: /^name/i }), 'Acme Corp')
    const externalId = canvas.getByRole('textbox', { name: /external id/i })
    await userEvent.clear(externalId)
    await userEvent.type(externalId, 'acme')
    await userEvent.click(canvas.getByRole('button', { name: 'Create customer' }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Acme Corp', externalId: 'acme' }),
    )
  },
}

/** Entities enabled: the default entity is preselected and sent unless another is picked. */
export const CreateWithBillingEntity: Story = {
  args: {
    billingEntities: [
      { id: 'be_default', name: 'Northwind Inc', isDefault: true },
      { id: 'be_india', name: 'Northwind India', isDefault: false },
    ],
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('combobox', { name: /billing entity/i })).toHaveTextContent(
      'Northwind Inc',
    )
    await userEvent.type(canvas.getByRole('textbox', { name: /^name/i }), 'Acme Corp')
    await userEvent.click(canvas.getByRole('button', { name: 'Create customer' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ billingEntityId: 'be_default' }),
      ),
    )
  },
}

/** The external ID is filled from the name until the person types their own. */
export const ExternalIdFollowsName: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const name = canvas.getByRole('textbox', { name: /^name/i })
    const externalId = canvas.getByRole('textbox', { name: /external id/i })

    await userEvent.type(name, 'Acme Corp')
    await expect(externalId).toHaveValue('cust-acme-corp')

    await userEvent.clear(externalId)
    await userEvent.type(externalId, 'acme')
    await userEvent.type(name, ' Robotics')
    await expect(externalId).toHaveValue('acme')
  },
}

export const Edit: Story = {
  args: {
    mode: 'edit',
    customerName: 'Acme Corp',
    trail: [{ label: 'Customers' }, { label: 'Customer details' }, { label: 'Edit' }],
    defaultValue: { externalId: 'acme', name: 'Acme Corp', email: 'billing@acme.test' },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('textbox', { name: /^name/i })).toHaveValue('Acme Corp')
    await expect(canvas.queryByRole('complementary')).toBeNull()
    await expect(canvas.getByRole('textbox', { name: /city/i })).toBeInTheDocument()
    // Renaming a saved customer never rewrites its external ID: events carry it.
    await userEvent.type(canvas.getByRole('textbox', { name: /^name/i }), ' Ltd')
    await expect(canvas.getByRole('textbox', { name: /external id/i })).toHaveValue('acme')
    await userEvent.click(canvas.getByRole('button', { name: 'Save changes' }))
    await expect(args.onSubmit).toHaveBeenCalled()
  },
}

/**
 * An ID generated from the old name stays too: usage events already carry it,
 * and a rename that rewrote it would leave them matching no customer.
 */
export const EditKeepsAGeneratedId: Story = {
  args: {
    mode: 'edit',
    customerName: 'Acme',
    trail: [{ label: 'Customers' }, { label: 'Customer details' }, { label: 'Edit' }],
    defaultValue: { externalId: suggestKey(KEY_PREFIX.customer, 'Acme'), name: 'Acme' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const id = canvas.getByRole('textbox', { name: /external id/i })
    const before = (id as HTMLInputElement).value
    await userEvent.type(canvas.getByRole('textbox', { name: /^name/i }), ' Ltd')
    await expect(id).toHaveValue(before)
  },
}

/** An address without a domain ending is refused under the field, and the save waits for a real one. */
export const InvalidEmail: Story = {
  args: {
    mode: 'edit',
    customerName: 'Acme Corp',
    trail: [{ label: 'Customers' }, { label: 'Customer details' }, { label: 'Edit' }],
    defaultValue: { externalId: 'acme', name: 'Acme Corp', email: 'billing@acme.test' },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const email = canvas.getByRole('textbox', { name: /^email/i })
    await userEvent.clear(email)
    await userEvent.type(email, 'billing@acme')
    await userEvent.click(canvas.getByRole('button', { name: 'Save changes' }))
    await expect(await canvas.findByText('Enter a valid email address')).toBeInTheDocument()
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(args.onSubmit).not.toHaveBeenCalled()

    await userEvent.type(email, '.test ')
    await waitFor(() => expect(canvas.queryByText('Enter a valid email address')).toBeNull())
    await userEvent.click(canvas.getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'billing@acme.test' }),
      ),
    )
  },
}

/**
 * Billing configuration is set while creating, not only after.
 *
 * Tax treatment and timezone sat in a collapsed "More details" fold, so on
 * create they read as edit-only settings. They are now their own card, open on
 * create and edit, and the chosen values go out with the create.
 */
export const CreateWithBillingConfiguration: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Billing configuration')).toBeVisible()
    await userEvent.type(canvas.getByRole('textbox', { name: /^name/i }), 'Acme Corp')
    await userEvent.click(canvas.getByRole('combobox', { name: 'Tax treatment' }))
    await userEvent.click(await within(document.body).findByRole('option', { name: 'Exempt' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Create customer' }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Acme Corp', taxTreatment: 'exempt' }),
    )
  },
}

/**
 * The billing currency is edited with the rest of the billing configuration
 * (QA #16), and clearing it goes out as `''`: bill in each contract's currency.
 */
export const EditBillingCurrency: Story = {
  args: {
    mode: 'edit',
    customerName: 'Acme Corp',
    trail: [{ label: 'Customers' }, { label: 'Edit' }],
    defaultValue: { externalId: 'acme', name: 'Acme Corp', billingCurrency: 'usd' },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const currency = canvas.getByRole('combobox', { name: 'Billing currency' })
    await expect(currency).toHaveValue('USD')
    await userEvent.clear(currency)
    await userEvent.type(currency, 'eur')
    await userEvent.click(await within(document.body).findByRole('option', { name: 'EUR' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Save changes' }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ billingCurrency: 'eur' }),
    )
  },
}

export const SubmitError: Story = {
  args: { submitError: 'A customer with that external ID already exists.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeInTheDocument()
  },
}

/**
 * Country is chosen, not typed.
 *
 * It was a free-text box capped at two characters: it accepted "zz", told
 * nobody which code it wanted, and could not be searched. The stored value
 * is still the alpha-2 code; what changed is that you find it by name.
 */
export const CountryIsSearchable: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The address lives in the collapsed "Billing address" disclosure on create.
    await userEvent.click(canvas.getByRole('button', { name: /Billing address/ }))
    const country = canvas.getByRole('combobox', { name: 'Country' })
    await userEvent.type(country, 'united king')
    const option = await within(document.body).findByRole('option', {
      name: /United Kingdom \(GB\)/,
    })
    await userEvent.click(option)
    await expect(country).toHaveValue('United Kingdom (GB)')
    await waitFor(() => expect(within(document.body).queryByRole('listbox')).toBeNull())
  },
}

/**
 * State follows the country and city follows the state.
 *
 * Both were free text. They are now lists from the bundled region dataset,
 * and a new country clears a state that belonged to the old one.
 */
export const StateAndCityFollowCountry: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const body = within(document.body)
    await userEvent.type(canvas.getByRole('textbox', { name: /^name/i }), 'Acme Corp')
    await userEvent.click(canvas.getByRole('button', { name: /Billing address/ }))
    await expect(canvas.getByRole('combobox', { name: 'State' })).toHaveAttribute('data-disabled')

    await userEvent.type(canvas.getByRole('combobox', { name: 'Country' }), 'India')
    await userEvent.click(await body.findByRole('option', { name: /India \(IN\)/ }))
    const state = canvas.getByRole('combobox', { name: 'State' })
    await waitFor(() => expect(state).toHaveAttribute('placeholder', 'Search states…'), {
      timeout: 5000,
    })
    await userEvent.type(state, 'Karna')
    await userEvent.click(await body.findByRole('option', { name: 'Karnataka' }, { timeout: 5000 }))
    const city = canvas.getByRole('combobox', { name: 'City' })
    await waitFor(() => expect(city).toHaveAttribute('placeholder', 'Search cities…'), {
      timeout: 5000,
    })
    await userEvent.type(city, 'Bengal')
    await userEvent.click(await body.findByRole('option', { name: 'Bengaluru' }, { timeout: 5000 }))
    await userEvent.type(canvas.getByRole('textbox', { name: /postal code/i }), '560001')

    await userEvent.click(canvas.getByRole('button', { name: 'Create customer' }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        addressCountry: 'IN',
        addressState: 'Karnataka',
        addressCity: 'Bengaluru',
        addressPostalCode: '560001',
      }),
    )
  },
}

/** A saved city with no state or country stays editable. */
export const CityOnlyAddressEditable: Story = {
  args: {
    mode: 'edit',
    customerName: 'Acme Corp',
    trail: [{ label: 'Customers' }, { label: 'Customer details' }, { label: 'Edit' }],
    defaultValue: { externalId: 'acme', name: 'Acme Corp', addressCity: 'London' },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const city = canvas.getByRole('textbox', { name: 'City' })
    await expect(city).toHaveValue('London')
    await userEvent.clear(city)
    await userEvent.type(city, 'Birmingham')
    await userEvent.click(canvas.getByRole('button', { name: 'Save changes' }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ addressCity: 'Birmingham' }),
    )
  },
}

/** A saved state the dataset does not list stays shown, and a new country clears it. */
export const SavedRegionKept: Story = {
  args: {
    mode: 'edit',
    customerName: 'Acme Corp',
    trail: [{ label: 'Customers' }, { label: 'Customer details' }, { label: 'Edit' }],
    defaultValue: {
      externalId: 'acme',
      name: 'Acme Corp',
      addressCountry: 'US',
      addressState: 'CA',
      addressCity: 'San Francisco',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const state = canvas.getByRole('combobox', { name: 'State' })
    await expect(state).toHaveValue('CA')
    await expect(canvas.getByRole('combobox', { name: 'City' })).toHaveValue('San Francisco')

    const country = canvas.getByRole('combobox', { name: 'Country' })
    await userEvent.clear(country)
    await userEvent.type(country, 'Canada')
    await userEvent.click(
      await within(document.body).findByRole('option', { name: /Canada \(CA\)/ }),
    )
    await expect(state).toHaveValue('')
    // No state chosen yet: city is typed, since state is optional.
    await expect(canvas.getByRole('textbox', { name: 'City' })).toHaveValue('')
  },
}

/**
 * Time zones are found by abbreviation and offset, which is the reported bug.
 *
 * The options were bare IANA names, so someone looking for their own zone had
 * to know its spelling: "IST" and "+05:30" both found nothing.
 */
export const TimezoneFoundByAbbreviation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const timezone = canvas.getByRole('combobox', { name: 'Timezone' })
    await userEvent.type(timezone, 'IST')
    /*
     * Matched on the abbreviation, not on a zone name.
     * Which IANA spelling a runtime enumerates is its own business: this one
     * offers `Asia/Calcutta` where another offers `Asia/Kolkata`: so the
     * assertion is that searching "IST" finds an IST zone, which is the thing
     * that was broken.
     */
    const options = await within(document.body).findAllByRole('option')
    await expect(options.some((option) => option.textContent?.includes('IST'))).toBe(true)

    /*
     * Close it before the scan.
     * While the popup is open Base UI marks the rest of the page
     * `aria-hidden`, and axe fails the focusable content inside it. The a11y
     * run happens when this returns, so it must see the settled DOM.
     */
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(within(document.body).queryByRole('listbox')).toBeNull())
  },
}
