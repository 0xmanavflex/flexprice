"use client"

import { Badge } from "@ui/components/reui/badge"
import { cn } from "cn"

import { Button } from "@ui/components/primitives/button"
import { Card, CardContent } from "@ui/components/primitives/card"
import { Item, ItemMedia } from "@ui/components/primitives/item"
import { Separator } from "@ui/components/primitives/separator"
import {
  ECOMMERCE_LINK_CLASS_NAME,
  ITEMS,
  ORDER,
  PAYMENT,
  SHIP_TO,
  SHIPMENT,
  SHOP,
  TOTALS,
  type ReceiptItem,
  type ReceiptTotals,
} from "./data"
import { CircleCheckIcon, TruckIcon, DownloadIcon, MailIcon, PrinterIcon } from "lucide-react"

// ─────────────────────────────────────────────────────────────────────────
// Receipt. Statement-style two-column receipt. One Card holds a metadata
// sidebar on the left (brand + status, large Total Paid number, labeled
// order / payment / delivery / address blocks, and the primary Track
// Shipment action) and a content pane on the right (Order Items list +
// right-aligned totals). Secondary actions (Download / Email / Print)
// sit outside the Card as a centered utility row. Reads like a calm
// bank statement or formal invoice, distinct from the email-template
// confirmation feel of the previous receipt blocks.
// ─────────────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency: ReceiptTotals["currency"]) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function dispatchReceiptAction(action: "download" | "email" | "print") {
  if (typeof window === "undefined") return
  if (action === "print") {
    window.print()
    return
  }
  window.dispatchEvent(
    new CustomEvent(`reui:receipt-${action}`, {
      detail: { receiptNumber: ORDER.receiptNumber },
    })
  )
}

export function Receipt() {
  const currency = TOTALS.currency

  return (
    <section
      aria-labelledby="receipt-heading"
      className="mx-auto w-full max-w-4xl px-4 py-10 md:py-14"
    >
      <Card>
        <CardContent>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-10">
            {/* Sidebar: brand + status + total + metadata + primary action */}
            <aside className="flex flex-col gap-5 lg:border-r lg:pr-10">
              {/* Brand + status row */}
              <div className="flex items-center justify-between gap-3">
                <Item
                  className="bg-primary text-primary-foreground size-9 shrink-0 items-center justify-center p-0"
                  aria-hidden="true"
                >
                  <ItemMedia variant="icon" className="size-auto">
                    <svg
                      width="50"
                      height="50"
                      viewBox="25.668 25.1352 49.6644 50"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="size-4"
                      aria-hidden="true"
                    >
                      <circle
                        cx="70.634"
                        cy="29.8334"
                        r="4.69799"
                        fill="currentColor"
                      />
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M25.668 57.0144V29.8332C25.668 27.2386 27.7713 25.1352 30.366 25.1352C32.9606 25.1352 35.0639 27.2386 35.0639 29.8332V57.0144C35.0639 61.833 38.9702 65.7392 43.7888 65.7392H57.2116C62.0302 65.7392 65.9364 61.833 65.9364 57.0144V43.7258C65.9364 41.1312 68.0398 39.0278 70.6344 39.0278C73.229 39.0278 75.3324 41.1312 75.3324 43.7258V57.0144C75.3324 67.0222 67.2194 75.1352 57.2116 75.1352H43.7888C33.7809 75.1352 25.668 67.0222 25.668 57.0144Z"
                        fill="currentColor"
                      />
                    </svg>
                  </ItemMedia>
                </Item>
                <Badge variant="success" radius="full">
                  <CircleCheckIcon className="size-3.5" aria-hidden="true" />
                  Paid
                </Badge>
              </div>

              {/* Total hero */}
              <div className="flex flex-col gap-1.5">
                <span
                  id="receipt-heading"
                  className="text-muted-foreground text-[0.6875rem] font-semibold tracking-[0.2em] uppercase"
                >
                  Total Paid
                </span>
                <span className="text-foreground text-3xl leading-none font-bold tracking-tight tabular-nums md:text-4xl">
                  {formatCurrency(TOTALS.total, currency)}
                </span>
                <span className="text-muted-foreground text-xs">
                  on {ORDER.placedAt}
                </span>
              </div>

              <Separator />

              {/* Metadata stack */}
              <div className="flex flex-col gap-4">
                <MetaSection label="Order">
                  <a
                    href="#"
                    aria-label={`View order ${ORDER.number}`}
                    className={cn(
                      ECOMMERCE_LINK_CLASS_NAME,
                      "text-foreground font-mono text-sm tabular-nums"
                    )}
                  >
                    {ORDER.number}
                  </a>
                  <p className="text-muted-foreground text-xs">
                    Receipt {ORDER.receiptNumber}
                  </p>
                </MetaSection>

                <MetaSection label="Paid With">
                  <p className="text-foreground text-sm font-medium tabular-nums">
                    {PAYMENT.brand} · {PAYMENT.last4}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Expires {PAYMENT.expiry}
                  </p>
                </MetaSection>

                <MetaSection label="Arrives">
                  <p className="text-foreground text-sm font-medium">
                    {SHIPMENT.earliestDelivery} to {SHIPMENT.latestDelivery}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {SHIPMENT.carrier}
                  </p>
                </MetaSection>

                <MetaSection label="Ships To">
                  <p className="text-foreground text-sm font-medium">
                    {SHIP_TO.name}
                  </p>
                  <p className="text-muted-foreground text-xs leading-snug">
                    {SHIP_TO.lines[0]}, {SHIP_TO.city}, {SHIP_TO.region}{" "}
                    {SHIP_TO.postalCode}
                  </p>
                </MetaSection>
              </div>

              <Separator />

              {/* Primary action */}
              <Button
                nativeButton={false}
                size="sm"
                render={
                  <a
                    href={SHIPMENT.trackingHref}
                    aria-label={`Track shipment for order ${ORDER.number}`}
                  />
                }
                className="w-full"
              >
                <TruckIcon className="size-4" aria-hidden="true" />
                Track Your Shipment
              </Button>
            </aside>

            {/* Main: items + totals */}
            <div className="flex min-w-0 flex-col gap-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-muted-foreground text-[0.6875rem] font-semibold tracking-[0.2em] uppercase">
                    Order Items
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {ITEMS.length} {ITEMS.length === 1 ? "item" : "items"} ·
                    Confirmed {ORDER.placedAt}
                  </span>
                </div>

                <div className="flex flex-col divide-y">
                  {ITEMS.map((item, index) => (
                    <LineItem
                      key={item.id}
                      item={item}
                      currency={currency}
                      isFirst={index === 0}
                      isLast={index === ITEMS.length - 1}
                    />
                  ))}
                </div>
              </div>

              <Separator />

              <dl className="ml-auto flex w-full flex-col gap-1.5 text-sm sm:w-72">
                <TotalRow
                  label="Subtotal"
                  value={formatCurrency(TOTALS.subtotal, currency)}
                />
                <TotalRow
                  label="Shipping"
                  value={
                    TOTALS.shipping === 0
                      ? "Free"
                      : formatCurrency(TOTALS.shipping, currency)
                  }
                />
                {TOTALS.discount ? (
                  <TotalRow
                    label={`Discount (${TOTALS.discount.code})`}
                    value={`-${formatCurrency(TOTALS.discount.amount, currency)}`}
                    tone="success"
                  />
                ) : null}
                <TotalRow
                  label="Estimated Tax"
                  value={formatCurrency(TOTALS.tax, currency)}
                />
                <Separator className="my-1" />
                <TotalRow
                  label="Total"
                  value={formatCurrency(TOTALS.total, currency)}
                  strong
                />
              </dl>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Secondary action utility row + support link */}
      <div className="mt-6 flex flex-col items-center gap-3 text-center">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => dispatchReceiptAction("download")}
            aria-label={`Download receipt ${ORDER.receiptNumber}`}
          >
            <DownloadIcon className="size-4" aria-hidden="true" />
            Download
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => dispatchReceiptAction("email")}
            aria-label={`Email receipt ${ORDER.receiptNumber}`}
          >
            <MailIcon className="size-4" aria-hidden="true" />
            Email
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => dispatchReceiptAction("print")}
            aria-label={`Print receipt ${ORDER.receiptNumber}`}
          >
            <PrinterIcon className="size-4" aria-hidden="true" />
            Print
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Tracking updates go to{" "}
          <span className="text-foreground font-medium">
            {ORDER.customerEmail}
          </span>
          . Need help?{" "}
          <a
            href={SHOP.supportHref}
            aria-label={`Contact ${SHOP.name} support`}
            className={cn(
              ECOMMERCE_LINK_CLASS_NAME,
              "text-foreground font-medium"
            )}
          >
            Contact {SHOP.name} support
          </a>
          .
        </p>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────

function MetaSection({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-[0.625rem] font-semibold tracking-[0.22em] uppercase">
        {label}
      </span>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  )
}

function LineItem({
  item,
  currency,
  isFirst,
  isLast,
}: {
  item: ReceiptItem
  currency: ReceiptTotals["currency"]
  isFirst: boolean
  isLast: boolean
}) {
  return (
    <article
      className={cn(
        "flex min-w-0 items-start gap-4",
        isFirst ? "pt-0" : "pt-4",
        isLast ? "pb-0" : "pb-4"
      )}
    >
      <Item
        variant="muted"
        className="relative size-14 w-14 shrink-0 overflow-hidden border-0 p-0 shadow-none"
      >
        <a
          href={item.href}
          aria-label={`View ${item.name}`}
          className="focus-visible:ring-ring absolute inset-0 block outline-none focus-visible:ring-2 focus-visible:ring-inset"
        >
          <img
            src={item.image.src}
            alt={item.image.alt}
            className="absolute inset-0 size-full object-cover"
            loading="lazy"
          />
        </a>
      </Item>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-muted-foreground text-[0.6875rem] font-medium tracking-wide uppercase">
          {item.brand}
        </p>
        <h3 className="text-foreground min-w-0 text-sm leading-snug font-semibold">
          <a
            href={item.href}
            className={cn(ECOMMERCE_LINK_CLASS_NAME, "block truncate")}
          >
            {item.name}
          </a>
        </h3>
        <p className="text-muted-foreground text-xs">
          {item.variant} · Qty {item.quantity}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5 text-sm tabular-nums">
        <span className="text-foreground font-semibold">
          {formatCurrency(item.lineTotal, currency)}
        </span>
        {item.quantity > 1 ? (
          <span className="text-muted-foreground text-xs">
            {formatCurrency(item.unitPrice, currency)} each
          </span>
        ) : null}
      </div>
    </article>
  )
}

function TotalRow({
  label,
  value,
  tone = "default",
  strong = false,
}: {
  label: string
  value: string
  tone?: "default" | "success"
  strong?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt
        className={cn(
          strong
            ? "text-foreground text-base font-semibold"
            : "text-muted-foreground text-sm"
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          "tabular-nums",
          strong
            ? "text-foreground text-lg font-bold"
            : "text-foreground text-sm font-medium",
          tone === "success" && "text-success"
        )}
      >
        {value}
      </dd>
    </div>
  )
}