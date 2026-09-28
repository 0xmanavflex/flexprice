// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
export type WizardStepId = "customer" | "items" | "tax" | "review"

export type WizardStep = {
  id: WizardStepId
  value: number
  label: string
  title: string
  description: string
}

export type SelectOption = {
  value: string
  label: string
}

export type PlanTier = "Starter" | "Growth" | "Scale" | "Enterprise"

export type InvoiceCustomer = {
  id: string
  name: string
  email: string
  accountId: string
  plan: PlanTier
  taxId: string
  billingAddress: string
}

export type InvoiceProduct = {
  id: string
  name: string
  description: string
  unitPrice: number
  taxRate: string
}

export type InvoiceLineItem = {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  taxRate: string
}

export type InvoicePreparer = {
  name: string
  role: string
  monogram: string
  avatar: string
}

// The billing operator preparing the invoice. Mara Whitfield, billing
// operations lead from the Beacon world pack, carries her pinned portrait.
export const INVOICE_PREPARER: InvoicePreparer = {
  name: "Mara Whitfield",
  role: "Billing operations lead",
  monogram: "MW",
  avatar:
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&dpr=2&q=80",
}

// The composer maps each step to one invoice field group: who is billed, what
// they are billed for, the tax and discount, then a receipt-style review.
export const WIZARD_STEPS: WizardStep[] = [
  {
    id: "customer",
    value: 1,
    label: "Customer",
    title: "Customer",
    description: "Billable account and invoice reference.",
  },
  {
    id: "items",
    value: 2,
    label: "Line items",
    title: "Line Items",
    description: "Seats, usage, storage, and support add-ons.",
  },
  {
    id: "tax",
    value: 3,
    label: "Tax and discount",
    title: "Tax And Discount",
    description: "Set the discount and confirm per-line tax.",
  },
  {
    id: "review",
    value: 4,
    label: "Review",
    title: "Review And Send",
    description: "Confirm the invoice, then send it to the customer.",
  },
]

// Beacon issues a draft invoice INV-20437 for Northwind Retail by default; the
// operator can switch the bill-to account in the customer step.
export const DEFAULT_INVOICE_FORM_VALUES = {
  customerId: "northwind-retail",
  invoiceNumber: "INV-20437",
  poNumber: "PO-4471",
  issueDate: "2026-06-16",
  dueDate: "2026-06-30",
  currency: "usd",
  paymentTerms: "net-14",
  collectionMethod: "ach",
  discountPercent: 5,
} as const

// Fictional Beacon customers, consistent with solution-billing-1 (Northwind
// Retail, Vela Analytics, Cedar Labs). ACC- account scheme from the world pack.
export const INVOICE_CUSTOMERS: InvoiceCustomer[] = [
  {
    id: "northwind-retail",
    name: "Northwind Retail",
    email: "billing@northwind.example",
    accountId: "ACC-3092",
    plan: "Scale",
    taxId: "US-88-2947135",
    billingAddress: "14 Warren Street, Suite 620, New York, NY",
  },
  {
    id: "vela-analytics",
    name: "Vela Analytics",
    email: "finance@vela.example",
    accountId: "ACC-3088",
    plan: "Growth",
    taxId: "US-31-6084291",
    billingAddress: "221 Mission Row, Chicago, IL",
  },
  {
    id: "cedar-labs",
    name: "Cedar Labs",
    email: "ap@cedarlabs.example",
    accountId: "ACC-3104",
    plan: "Enterprise",
    taxId: "US-47-2210984",
    billingAddress: "88 Harbor Way, Seattle, WA",
  },
]

// SaaS billing lines: seats, API usage overage, storage, and a support add-on.
export const INVOICE_PRODUCTS: InvoiceProduct[] = [
  {
    id: "scale-seats",
    name: "Scale plan seats",
    description: "Monthly Scale seats at the per-seat list rate",
    unitPrice: 49,
    taxRate: "8.25",
  },
  {
    id: "api-overage",
    name: "API usage overage",
    description: "Metered API calls above the 2M plan allowance",
    unitPrice: 38,
    taxRate: "8.25",
  },
  {
    id: "storage-blocks",
    name: "Storage add-on",
    description: "Extra storage billed per 100 GB block",
    unitPrice: 24,
    taxRate: "8.25",
  },
  {
    id: "priority-support",
    name: "Priority support",
    description: "Prepaid support block with a 1-day response SLA",
    unitPrice: 320,
    taxRate: "0",
  },
]

export const PRODUCT_BY_ID = new Map(
  INVOICE_PRODUCTS.map((product) => [product.id, product])
)

// Default draft lines. Subtotal = 28×49 + 14×38 + 6×24 + 1×320 = 1372 + 532 +
// 144 + 320 = 2368. Tax applies only to the taxed lines (all but support):
// (1372 + 532 + 144) × 8.25% = 2048 × 0.0825 = 168.96. A 5% discount applies
// before tax, so the review preview reconciles against the line table.
export const DEFAULT_INVOICE_LINES: InvoiceLineItem[] = [
  {
    id: "line-1",
    productId: "scale-seats",
    quantity: 28,
    unitPrice: 49,
    taxRate: "8.25",
  },
  {
    id: "line-2",
    productId: "api-overage",
    quantity: 14,
    unitPrice: 38,
    taxRate: "8.25",
  },
  {
    id: "line-3",
    productId: "storage-blocks",
    quantity: 6,
    unitPrice: 24,
    taxRate: "8.25",
  },
  {
    id: "line-4",
    productId: "priority-support",
    quantity: 1,
    unitPrice: 320,
    taxRate: "0",
  },
]

export const CURRENCY_OPTIONS: SelectOption[] = [
  { value: "usd", label: "USD" },
  { value: "eur", label: "EUR" },
  { value: "gbp", label: "GBP" },
]

export const PAYMENT_TERMS_OPTIONS: SelectOption[] = [
  { value: "due-receipt", label: "Due on receipt" },
  { value: "net-7", label: "Net 7" },
  { value: "net-14", label: "Net 14" },
  { value: "net-30", label: "Net 30" },
]

export const COLLECTION_METHOD_OPTIONS: SelectOption[] = [
  { value: "ach", label: "ACH transfer" },
  { value: "card", label: "Card on file" },
  { value: "wire", label: "Wire transfer" },
  { value: "manual", label: "Manual collection" },
]

export const TAX_RATE_OPTIONS: SelectOption[] = [
  { value: "0", label: "No tax" },
  { value: "5", label: "5%" },
  { value: "8.25", label: "8.25%" },
  { value: "10", label: "10%" },
]

export function createInvoiceLine(id: string): InvoiceLineItem {
  const product = INVOICE_PRODUCTS[0]

  return {
    id,
    productId: product.id,
    quantity: 1,
    unitPrice: product.unitPrice,
    taxRate: product.taxRate,
  }
}