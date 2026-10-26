import {
  DEFAULT_INVOICE_QUERY,
  type Invoice,
  type InvoiceQuery,
  InvoiceStatus,
  PaymentStatus,
  money,
} from '@fp/domain'

/**
 * Invoices as plain domain values.
 *
 * Note what building these requires: no API client, no query client, no
 * network, no provider. That is the claim `@fp/ui` makes: that it is
 * genuinely presentational rather than merely linted to be: and a fixture
 * file is where the claim is either true or obviously false.
 *
 * Dates are fixed rather than relative so a story renders identically today and
 * next March; an "overdue" row that quietly becomes "open" is a flaky test.
 */
const date = (iso: string) => new Date(iso)

export const invoiceFixtures: Invoice[] = [
  {
    id: 'inv_01',
    number: 'INV-1041',
    customerId: 'cus_acme',
    customerName: 'Acme Corp',
    status: InvoiceStatus.Overdue,
    paymentStatus: PaymentStatus.Pending,
    total: money('12480.00', 'USD'),
    amountDue: money('12480.00', 'USD'),
    amountRemaining: money('12480.00', 'USD'),
    dueDate: date('2026-02-01T00:00:00Z'),
    issuedAt: date('2026-01-01T00:00:00Z'),
    periodStart: date('2025-12-01T00:00:00Z'),
    periodEnd: date('2025-12-31T00:00:00Z'),
  },
  {
    id: 'inv_02',
    number: 'INV-1042',
    customerId: 'cus_globex',
    customerName: 'Globex',
    status: InvoiceStatus.Paid,
    paymentStatus: PaymentStatus.Succeeded,
    total: money('980.50', 'USD'),
    amountDue: money('980.50', 'USD'),
    amountRemaining: money('0', 'USD'),
    dueDate: date('2026-03-01T00:00:00Z'),
    issuedAt: date('2026-02-01T00:00:00Z'),
    periodStart: date('2026-01-01T00:00:00Z'),
    periodEnd: date('2026-01-31T00:00:00Z'),
  },
  {
    id: 'inv_03',
    number: 'INV-1043',
    customerId: 'cus_initech',
    customerName: 'Initech',
    status: InvoiceStatus.Open,
    paymentStatus: PaymentStatus.Pending,
    total: money('4200.00', 'USD'),
    amountDue: money('4200.00', 'USD'),
    amountRemaining: money('4200.00', 'USD'),
    dueDate: date('2027-01-01T00:00:00Z'),
    issuedAt: date('2026-03-01T00:00:00Z'),
    periodStart: date('2026-02-01T00:00:00Z'),
    periodEnd: date('2026-02-28T00:00:00Z'),
  },
  {
    // A draft has no number yet, so the grid shows a dash.
    id: 'inv_04',
    number: '',
    customerId: 'cus_umbrella',
    customerName: 'Umbrella Ltd',
    status: InvoiceStatus.Draft,
    paymentStatus: null,
    total: money('0', 'USD'),
    amountDue: money('0', 'USD'),
    amountRemaining: money('0', 'USD'),
    dueDate: null,
    issuedAt: null,
    periodStart: date('2026-03-01T00:00:00Z'),
    periodEnd: date('2026-03-31T00:00:00Z'),
  },
  {
    // Large enough that a float would round it. Renders the exact decimal.
    id: 'inv_05',
    number: 'INV-1045',
    customerId: 'cus_hooli',
    customerName: 'Hooli',
    status: InvoiceStatus.Void,
    paymentStatus: null,
    total: money('12345678901234567.89', 'USD'),
    amountDue: money('0', 'USD'),
    amountRemaining: money('0', 'USD'),
    dueDate: date('2026-04-01T00:00:00Z'),
    issuedAt: date('2026-03-15T00:00:00Z'),
    periodStart: date('2026-03-01T00:00:00Z'),
    periodEnd: date('2026-03-31T00:00:00Z'),
  },
]

export const fixtureQuery: InvoiceQuery = { ...DEFAULT_INVOICE_QUERY }

/** A page of rows, for the pagination story. */
export function manyInvoices(count: number): Invoice[] {
  return Array.from({ length: count }, (_, index) => {
    const base = invoiceFixtures[index % invoiceFixtures.length] as Invoice
    return { ...base, id: `inv_page_${index}`, number: `INV-${2000 + index}` }
  })
}
