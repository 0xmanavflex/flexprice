import { useMemo, useState } from 'react'
import {
  DEFAULT_CUSTOMER_QUERY,
  DEFAULT_TAX_RATE_QUERY,
  type InvoiceTax,
  TaxRateStatus,
  emptyInvoice,
} from '@fp/domain'
import {
  useCreateInvoice,
  useCustomer,
  useCustomerTaxAssociations,
  useCustomers,
  useTaxRates,
  useTenant,
  useUserInfo,
} from '@fp/query'
import { LoadingRows, PageBody } from '@fp/ui/compositions'
import { InvoiceForm } from '@fp/ui/pages'
import { customerParty, tenantParty } from './invoiceParties'

export interface InvoiceFormPageProps {
  /** Start with this customer chosen: the customer page's "Create invoice", as in V1. */
  customerId?: string
  onCancel: () => void
  onDone: (invoiceId: string) => void
}

/**
 * Raise a one-off invoice: `POST /invoices`, as V1's create page does.
 *
 * Feeds the shared invoice form what V1 shows around the fields: who it is
 * from (the tenant), who it bills (the chosen customer's address), and the
 * customer's tax rates, which a new invoice starts with.
 */
export function InvoiceFormPage({ customerId, onCancel, onDone }: InvoiceFormPageProps) {
  const create = useCreateInvoice()
  const [chosen, setChosen] = useState(customerId ?? '')
  const customers = useCustomers({ ...DEFAULT_CUSTOMER_QUERY, page: 1, pageSize: 100 })
  const customer = useCustomer(chosen)
  const associations = useCustomerTaxAssociations(chosen)
  const rates = useTaxRates({
    ...DEFAULT_TAX_RATE_QUERY,
    pageSize: 100,
    statuses: [TaxRateStatus.Published],
  })
  const me = useUserInfo()
  const tenant = useTenant(me.data?.tenantId ?? '')

  const options = useMemo(
    () =>
      (customers.data?.customers ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        email: item.email,
      })),
    [customers.data],
  )
  const customerTaxes = useMemo<InvoiceTax[] | null>(
    () =>
      associations.data
        ? associations.data.map((association) => ({
            taxRateCode: association.taxRateCode,
            name: association.taxRateName,
            percentage: association.percentage,
            taxBehavior: association.taxBehavior,
            priority: association.priority,
            autoApply: association.autoApply,
          }))
        : null,
    [associations.data],
  )

  // A preset customer can only be shown once the list it is picked from has arrived.
  if (customerId && customers.isPending) {
    return (
      <PageBody>
        <div className="pt-4">
          <LoadingRows />
        </div>
      </PageBody>
    )
  }

  return (
    <InvoiceForm
      customers={options}
      trail={[{ label: 'Invoices', onClick: onCancel }, { label: 'New invoice' }]}
      {...(customerId ? { defaultValue: { ...emptyInvoice(), customerId } } : {})}
      onCustomerChange={setChosen}
      billFrom={tenantParty(tenant.data)}
      billTo={chosen ? customerParty(customer.data) : null}
      taxRates={(rates.data?.taxRates ?? []).map((rate) => ({
        code: rate.code,
        name: rate.name,
        percentage: rate.percentageValue,
      }))}
      customerTaxes={chosen ? customerTaxes : null}
      onCancel={onCancel}
      isSubmitting={create.isPending}
      // The API's refusal is a toast (MutationToasts); validation stays in the form.
      submitError={null}
      onSubmit={(draft) =>
        create.mutate(draft, { onSuccess: (created) => onDone(created.id ?? '') })
      }
    />
  )
}
