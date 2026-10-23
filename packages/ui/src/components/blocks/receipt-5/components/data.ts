export const ECOMMERCE_LINK_CLASS_NAME =
  "underline-offset-4 transition-colors hover:text-primary hover:underline"

// ─────────────────────────────────────────────────────────────────────────
// Types. receipt-5 keeps the same section types receipt-1 introduced for
// order info, address, payment, items, totals, and the shipment estimate.
// The block reads them through a tight, centered email-template layout
// so no new fields are required.
// ─────────────────────────────────────────────────────────────────────────

export type OrderInfo = {
  number: string
  receiptNumber: string
  status: "paid" | "refunded"
  placedAt: string
  paidAt: string
  customerEmail: string
}

export type Address = {
  name: string
  lines: string[]
  city: string
  region: string
  postalCode: string
  country: string
}

export type PaymentMethod = {
  brand: string
  last4: string
  expiry: string
  cardholder: string
}

export type ReceiptItem = {
  id: string
  name: string
  href: string
  brand: string
  variant: string
  quantity: number
  unitPrice: number
  lineTotal: number
  image: { src: string; alt: string }
}

export type ReceiptTotals = {
  subtotal: number
  shipping: number
  discount?: { code: string; amount: number }
  tax: number
  total: number
  currency: "USD"
}

export type ShipmentEstimate = {
  carrier: string
  service: string
  earliestDelivery: string
  latestDelivery: string
  trackingHref: string
}

// ─────────────────────────────────────────────────────────────────────────
// Demo data. Same ReUI / Halden order rhythm as the other receipt blocks
// so the catalog reads as a single family with different presentations.
// ─────────────────────────────────────────────────────────────────────────

export const SHOP = {
  name: "ReUI",
  tagline: "reui.io",
  supportEmail: "support@reui.io",
  supportHref: "#",
}

export const ORDER: OrderInfo = {
  number: "HLD-2026-18042",
  receiptNumber: "RCT-2026-018042",
  status: "paid",
  placedAt: "May 18, 2026",
  paidAt: "May 18, 2026 at 9:42 AM",
  customerEmail: "jordan@example.com",
}

export const SHIP_TO: Address = {
  name: "Jordan Reeves",
  lines: ["180 Bedford Avenue", "Apt 4F"],
  city: "Brooklyn",
  region: "NY",
  postalCode: "11211",
  country: "United States",
}

export const PAYMENT: PaymentMethod = {
  brand: "Visa",
  last4: "4242",
  expiry: "04 / 28",
  cardholder: "Jordan Reeves",
}

export const ITEMS: ReceiptItem[] = [
  {
    id: "field-shell-jacket",
    name: "Field Shell Jacket",
    href: "#",
    brand: "Halden",
    variant: "Olive · M",
    quantity: 1,
    unitPrice: 185.0,
    lineTotal: 185.0,
    image: {
      src: "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=160&h=160&q=80",
      alt: "Field Shell Jacket in olive",
    },
  },
  {
    id: "compass-down-vest",
    name: "Compass Down Vest",
    href: "#",
    brand: "Halden",
    variant: "Slate · M",
    quantity: 1,
    unitPrice: 228.0,
    lineTotal: 228.0,
    image: {
      src: "https://images.unsplash.com/photo-1611926653458-09294b3142bf?auto=format&fit=crop&w=160&h=160&q=80",
      alt: "Compass Down Vest in slate",
    },
  },
  {
    id: "linen-field-shirt",
    name: "Linen Field Shirt",
    href: "#",
    brand: "Halden",
    variant: "Sand · M",
    quantity: 2,
    unitPrice: 128.0,
    lineTotal: 256.0,
    image: {
      src: "https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?auto=format&fit=crop&w=160&h=160&q=80",
      alt: "Linen Field Shirt in sand",
    },
  },
]

export const TOTALS: ReceiptTotals = {
  subtotal: 669.0,
  shipping: 12.0,
  discount: { code: "WELCOME15", amount: 100.35 },
  tax: 51.27,
  total: 631.92,
  currency: "USD",
}

export const SHIPMENT: ShipmentEstimate = {
  carrier: "UPS Ground",
  service: "Standard, 3 to 5 business days",
  earliestDelivery: "May 22",
  latestDelivery: "May 25",
  trackingHref: "#",
}