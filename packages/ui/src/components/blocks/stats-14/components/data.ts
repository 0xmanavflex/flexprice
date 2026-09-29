// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
"use client"

// ── Data ──

export const adoptionRate = "84%"
export const bars = [6, 6, 5, 5, 4, 4, 3, 0]
export const maxBars = Math.max(...bars)

export function getBarColor(j: number, height: number): string {
  if (height === 0) return "bg-muted"
  const barColors = [
    "bg-indigo-600",
    "bg-indigo-500",
    "bg-indigo-400",
    "bg-indigo-300",
    "bg-indigo-200",
    "bg-indigo-100",
  ]
  return j < height ? barColors[j] : "bg-muted"
}