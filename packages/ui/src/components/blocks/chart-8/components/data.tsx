// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
export type MetricTone = "success" | "destructive"

export interface MetricGauge {
  active: number
  color: string
  count: number
  start: number
}

export interface ResponseMetric {
  title: string
  value: string
  unit: string
  trendLabel: string
  trendValue: string
  trendTone: MetricTone
  gauges: MetricGauge[]
}

const success = "var(--success)"
const destructive = "var(--destructive)"

export const responseMetrics: ResponseMetric[] = [
  {
    title: "API Response Time",
    value: "132",
    unit: "ms",
    trendLabel: "up from",
    trendValue: "148 ms",
    trendTone: "success",
    gauges: [
      {
        active: 12,
        color: success,
        count: 20,
        start: 9,
      },
    ],
  },
  {
    title: "Error Rate",
    value: "1.4",
    unit: "%",
    trendLabel: "down from",
    trendValue: "2.1%",
    trendTone: "destructive",
    gauges: [
      {
        active: 4,
        color: destructive,
        count: 20,
        start: 4,
      },
    ],
  },
  {
    title: "Request Throughput",
    value: "4.3k",
    unit: "req/s",
    trendLabel: "up from",
    trendValue: "3.9k req/s",
    trendTone: "success",
    gauges: [
      {
        active: 12,
        color: success,
        count: 20,
        start: 9,
      },
    ],
  },
]