// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
export type AllocationPeriod = {
  value: "week" | "month" | "year"
  label: string
  allocation: string
  delta: string
  comparison: string
  exposure: string
  filledSegments: number
}

export type AllocationMember = {
  name: string
  initials: string
  avatar?: string
}

export const SEGMENT_COUNT = 56
export const allocationMemberCount = 6

export const allocationPeriods: AllocationPeriod[] = [
  {
    value: "week",
    label: "Week",
    allocation: "46%",
    delta: "+3.4%",
    comparison: "vs prior period",
    exposure: "$4.7M",
    filledSegments: 26,
  },
  {
    value: "month",
    label: "Month",
    allocation: "52%",
    delta: "+5.1%",
    comparison: "vs prior period",
    exposure: "$5.2M",
    filledSegments: 29,
  },
  {
    value: "year",
    label: "Year",
    allocation: "68%",
    delta: "+8.7%",
    comparison: "vs prior period",
    exposure: "$7.9M",
    filledSegments: 38,
  },
]

export const allocationMembers: AllocationMember[] = [
  {
    name: "Maya Stone",
    initials: "MS",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&dpr=2&q=80",
  },
  {
    name: "Ivan Brooks",
    initials: "IB",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=96&h=96&dpr=2&q=80",
  },
  {
    name: "Kira Patel",
    initials: "K",
  },
  {
    name: "Noah Reed",
    initials: "NR",
    avatar:
      "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=96&h=96&dpr=2&q=80",
  },
]