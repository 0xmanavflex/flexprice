// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
"use client"

import { ReactNode } from "react"

import { ChartConfig } from "@ui/primitives/chart"
import { StoreIcon, EyeIcon, ShoppingCartIcon, CreditCardIcon } from "lucide-react"

// ── Types ──

export type PeriodKey = "7d" | "30d" | "90d" | "12m"

export interface StageMetric {
  key: string
  label: string
  color: string
  icon: ReactNode
}

// ── Config ──

export const chartConfig = {
  storeVisits: {
    label: "Store Visits",
    color: "var(--color-indigo-400)",
  },
  productViews: {
    label: "Product Views",
    color: "var(--color-indigo-500)",
  },
  addToCart: {
    label: "Add to Cart",
    color: "var(--color-indigo-600)",
  },
  checkout: {
    label: "Checkout",
    color: "var(--color-indigo-700)",
  },
} satisfies ChartConfig

export const stageMetrics: StageMetric[] = [
  {
    key: "storeVisits",
    label: "Store Visits",
    color: chartConfig.storeVisits.color,
    icon: (
      <StoreIcon aria-hidden="true" />
    ),
  },
  {
    key: "productViews",
    label: "Product Views",
    color: chartConfig.productViews.color,
    icon: (
      <EyeIcon aria-hidden="true" />
    ),
  },
  {
    key: "addToCart",
    label: "Add to Cart",
    color: chartConfig.addToCart.color,
    icon: (
      <ShoppingCartIcon aria-hidden="true" />
    ),
  },
  {
    key: "checkout",
    label: "Checkout",
    color: chartConfig.checkout.color,
    icon: (
      <CreditCardIcon aria-hidden="true" />
    ),
  },
]

// ── Data ──

export const conversionFunnelData: Record<
  PeriodKey,
  {
    period: string
    storeVisits: number
    productViews: number
    addToCart: number
    checkout: number
  }[]
> = {
  "7d": [
    {
      period: "Mon",
      storeVisits: 2500,
      productViews: 2100,
      addToCart: 1400,
      checkout: 1200,
    },
    {
      period: "Tue",
      storeVisits: 2800,
      productViews: 2300,
      addToCart: 1600,
      checkout: 1350,
    },
    {
      period: "Wed",
      storeVisits: 1900,
      productViews: 1500,
      addToCart: 950,
      checkout: 780,
    },
    {
      period: "Thu",
      storeVisits: 3100,
      productViews: 2600,
      addToCart: 1800,
      checkout: 1500,
    },
    {
      period: "Fri",
      storeVisits: 2400,
      productViews: 1900,
      addToCart: 1200,
      checkout: 980,
    },
    {
      period: "Sat",
      storeVisits: 3400,
      productViews: 2800,
      addToCart: 1950,
      checkout: 1620,
    },
    {
      period: "Sun",
      storeVisits: 2100,
      productViews: 1700,
      addToCart: 1100,
      checkout: 850,
    },
  ],
  "30d": [
    {
      period: "W1",
      storeVisits: 18500,
      productViews: 15200,
      addToCart: 10800,
      checkout: 8900,
    },
    {
      period: "W2",
      storeVisits: 21200,
      productViews: 17800,
      addToCart: 12400,
      checkout: 10200,
    },
    {
      period: "W3",
      storeVisits: 16800,
      productViews: 13500,
      addToCart: 8900,
      checkout: 7200,
    },
    {
      period: "W4",
      storeVisits: 14200,
      productViews: 11200,
      addToCart: 7800,
      checkout: 6100,
    },
    {
      period: "W5",
      storeVisits: 19800,
      productViews: 16500,
      addToCart: 11200,
      checkout: 9400,
    },
    {
      period: "W6",
      storeVisits: 22800,
      productViews: 19100,
      addToCart: 13500,
      checkout: 11200,
    },
  ],
  "90d": [
    {
      period: "Jan",
      storeVisits: 78000,
      productViews: 65000,
      addToCart: 45000,
      checkout: 37000,
    },
    {
      period: "Feb",
      storeVisits: 82000,
      productViews: 68500,
      addToCart: 48000,
      checkout: 39500,
    },
    {
      period: "Mar",
      storeVisits: 69000,
      productViews: 54000,
      addToCart: 36000,
      checkout: 28500,
    },
    {
      period: "Apr",
      storeVisits: 61000,
      productViews: 47000,
      addToCart: 31000,
      checkout: 24000,
    },
    {
      period: "May",
      storeVisits: 75000,
      productViews: 62000,
      addToCart: 43000,
      checkout: 35500,
    },
    {
      period: "Jun",
      storeVisits: 84000,
      productViews: 71000,
      addToCart: 49000,
      checkout: 41000,
    },
  ],
  "12m": [
    {
      period: "Q1",
      storeVisits: 235000,
      productViews: 195000,
      addToCart: 136000,
      checkout: 112000,
    },
    {
      period: "Q2",
      storeVisits: 268000,
      productViews: 223000,
      addToCart: 156000,
      checkout: 128000,
    },
    {
      period: "Q3",
      storeVisits: 198000,
      productViews: 158000,
      addToCart: 105000,
      checkout: 82000,
    },
    {
      period: "Q4",
      storeVisits: 175000,
      productViews: 138000,
      addToCart: 89000,
      checkout: 68000,
    },
    {
      period: "Q1 24",
      storeVisits: 251000,
      productViews: 209000,
      addToCart: 146000,
      checkout: 120000,
    },
    {
      period: "Q2 24",
      storeVisits: 289000,
      productViews: 241000,
      addToCart: 168000,
      checkout: 138000,
    },
  ],
}

export const periodChanges: Record<PeriodKey, Record<string, number>> = {
  "7d": { storeVisits: -16, productViews: 8, addToCart: -12, checkout: 5 },
  "30d": { storeVisits: 23, productViews: -7, addToCart: 15, checkout: -4 },
  "90d": { storeVisits: 12, productViews: 18, addToCart: -8, checkout: 21 },
  "12m": { storeVisits: -5, productViews: 23, addToCart: 32, checkout: -11 },
}

export const rangeOptions = [
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
  { label: "Last 12 months", value: "12m" },
]